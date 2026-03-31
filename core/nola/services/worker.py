"""Independent worker process for transcription tasks.

Run with: poetry run python -m nola.services.worker
"""

import json
import logging
import signal
import socket
import threading
import time
from dataclasses import asdict, fields
from pathlib import Path
from typing import Any

from nola.common.merge import deep_merge
from nola.engines.base import EngineConfig, TranscribeOptions
from nola.engines.faster_whisper import FasterWhisperEngine
from nola.model_hub import get_model, resolve_model_dir
from nola.models import AppConfigDatabase, FileDatabase, TaskDatabase, init_db
from nola.models.tasks import TaskRowRaw

logger = logging.getLogger("nola.worker")

# Global flag for graceful shutdown
_running = True


def get_worker_id() -> str:
    """Generate unique worker ID."""
    return f"worker-{socket.gethostname()}-{threading.current_thread().ident}"


def _filter_valid_options(raw_options: dict[str, Any] | None) -> dict[str, Any]:
    """Discard top-level keys that are not part of TranscribeOptions."""
    if not raw_options:
        return {}

    valid_fields = {field.name for field in fields(TranscribeOptions)}
    return {key: value for key, value in raw_options.items() if key in valid_fields}


def _deserialize_special_values(value: Any, *, key: str | None = None) -> Any:
    """Convert API sentinel values back to runtime types.

    Symmetric counterpart to ``_serialize_special_values`` in defaults.py,
    including recursive list/tuple handling. The ``"inf"`` sentinel is only
    converted for known numeric fields to avoid mutating user text values.
    The current API contract only serializes positive infinity as ``"inf"``.
    """
    if isinstance(value, dict):
        return {
            child_key: _deserialize_special_values(child_value, key=child_key)
            for child_key, child_value in value.items()
        }
    if isinstance(value, list):
        return [_deserialize_special_values(item, key=key) for item in value]
    if isinstance(value, tuple):
        return [_deserialize_special_values(item, key=key) for item in value]
    if key == "max_speech_duration_s" and value == "inf":
        return float("inf")
    return value


def build_transcribe_options(
    task_options: dict[str, Any] | None,
    config_db: AppConfigDatabase | None = None,
) -> TranscribeOptions:
    """Build TranscribeOptions from engine defaults, app defaults, and task options.

    Args:
        task_options: Dict of per-task overrides from the task record
        config_db: App config store used to load persisted defaults

    Returns:
        TranscribeOptions with the three-layer merge applied
    """
    # Plain deep_merge is intentional here: None values in engine defaults
    # (e.g. initial_prompt=None) are real defaults, not "remove override"
    # instructions. The null-removes-key semantics only apply to the PATCH
    # endpoint in config routes.
    merged_options = asdict(TranscribeOptions())

    if config_db is not None:
        app_defaults = _filter_valid_options(config_db.get_all("transcription."))
        merged_options = deep_merge(merged_options, app_defaults)

    task_overrides = _filter_valid_options(task_options)
    if task_overrides:
        merged_options = deep_merge(merged_options, task_overrides)

    # Convert API sentinel values (e.g. "inf") back to runtime types
    # before constructing the dataclass.
    merged_options = _deserialize_special_values(merged_options)

    return TranscribeOptions(**merged_options)


def run_transcription(
    task: TaskRowRaw,
    file_db: FileDatabase,
    task_db: TaskDatabase,
    app_config_db: AppConfigDatabase,
    engine: FasterWhisperEngine,
) -> None:
    """Execute transcription for a single task.

    Args:
        task: Task dictionary from database
        file_db: File database instance
        task_db: Task database instance
        engine: Pre-loaded transcription engine
    """
    task_id = task["id"]
    file_id = task["file_id"]

    logger.info(f"Starting transcription for task {task_id}")

    def on_progress(progress: float) -> None:
        try:
            task_db.heartbeat(task_id, progress)
        except Exception:
            pass  # Ignore transient heartbeat failures
        logger.debug(f"Progress: {progress:.1f}%")

    try:
        file_path = file_db.get_file_path(file_id)
        if not file_path:
            task_db.fail(task_id, f"File not found: {file_id}", should_retry=False)
            return

        if not Path(file_path).exists():
            task_db.fail(
                task_id, f"File does not exist: {file_path}", should_retry=False
            )
            return

        # Build options from task, filtering to valid fields only
        task_options = task.get("options")
        if isinstance(task_options, str):
            try:
                task_options = json.loads(task_options)
            except json.JSONDecodeError as e:
                task_db.fail(task_id, f"Invalid options JSON: {e}", should_retry=False)
                return

        if task_options is not None and not isinstance(task_options, dict):
            actual_type = type(task_options).__name__
            task_db.fail(
                task_id,
                f"Options must be a JSON object, got {actual_type}",
                should_retry=False,
            )
            return

        options = build_transcribe_options(task_options, app_config_db)

        if task_options:
            logger.info(f"Starting transcription with options: {task_options}")
        else:
            logger.info("Starting transcription with default options")
        segments_list = []
        duration = 0.0

        for segment in engine.transcribe(file_path, options, on_progress=on_progress):
            current = task_db.get_task(task_id)
            if current and current["status"] == "cancelled":
                logger.warning(f"Task {task_id} cancelled mid-transcription")
                return

            segments_list.append(segment)
            duration = max(duration, segment.end)

        if not segments_list:
            logger.warning(
                f"No segments found for task {task_id}. "
                "File may be silent or VAD filtered all content."
            )

        segment_dicts = [
            {
                "start": s.start,
                "end": s.end,
                "text": s.text,
            }
            for s in segments_list
        ]

        if task_db.complete(task_id, segment_dicts, duration):
            logger.info(
                f"Task {task_id} completed: {len(segments_list)} segments, "
                f"duration={duration:.2f}s"
            )
        else:
            logger.warning(f"Task {task_id} was cancelled before completion")

    except Exception as e:
        logger.error(f"Transcription failed for task {task_id}: {e}")
        task_db.fail(task_id, str(e), should_retry=True)


def worker_loop(db_path: str | Path | None = None) -> None:
    """Run the main worker loop."""
    from nola.config import settings

    db_path = db_path or settings.db_path
    global _running

    worker_id = get_worker_id()
    logger.info(f"Worker started: {worker_id}")

    file_db = FileDatabase(db_path)
    task_db = TaskDatabase(db_path)
    app_config_db = AppConfigDatabase(db_path)

    # Resolve configured model and cache directory
    model_config = app_config_db.get_all("model.")
    configured_raw = model_config.get("configured_model_id")
    configured_model = settings.model_size
    if isinstance(configured_raw, str):
        resolved = get_model(configured_raw)
        if resolved is not None:
            configured_model = resolved.model_id

    db_model_dir = model_config.get("configured_model_dir")
    model_dir, _ = resolve_model_dir(
        settings.model_dir,
        db_model_dir if isinstance(db_model_dir, str) else None,
        settings.default_model_dir,
    )

    logger.info(f"Loading model '{configured_model}' from {model_dir}")

    # Verify the model is cached locally before loading.
    # WhisperModel would silently download from HF if missing; the plan
    # requires users to download via the model management page first.
    from nola.model_hub import ModelStorage
    from nola.model_hub import require_model as _require_model

    model_info = _require_model(configured_model)
    storage = ModelStorage(model_dir)
    if not storage.is_downloaded(model_info.repo_id):
        logger.error(
            f"Model '{configured_model}' is not downloaded in {model_dir}. "
            "Download it via the model management page before starting the Worker."
        )
        return

    engine_config = EngineConfig(
        model_size=configured_model,
        download_root=model_dir,
    )
    engine = FasterWhisperEngine(config=engine_config)
    logger.info("Model loaded successfully")

    # Report loaded state for restart_required calculation
    app_config_db.set_many(
        "worker.",
        {
            "last_loaded_model_id": configured_model,
            "last_loaded_model_dir": str(model_dir),
        },
    )

    while _running:
        try:
            task = task_db.dequeue(worker_id)

            if task:
                run_transcription(task, file_db, task_db, app_config_db, engine)
            else:
                time.sleep(1)

        except KeyboardInterrupt:
            break
        except Exception as e:
            logger.error(f"Worker error: {e}")
            time.sleep(5)

    logger.info("Worker stopped")


def signal_handler(signum: int, frame: Any) -> None:
    """Handle shutdown signals."""
    global _running
    logger.info(f"Received signal {signum}, shutting down...")
    _running = False


def main() -> None:
    """Worker entry point."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    init_db()
    worker_loop()


if __name__ == "__main__":
    main()
