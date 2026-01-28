"""Independent worker process for transcription tasks.

Run with: poetry run python -m nola.services.worker
"""

import logging
import signal
import socket
import threading
import time
from dataclasses import asdict
from pathlib import Path
from typing import Any

from nola.engines.base import TranscribeOptions
from nola.engines.faster_whisper import FasterWhisperEngine
from nola.models import FileDatabase, TaskDatabase, init_db

logger = logging.getLogger("nola.worker")

# Global flag for graceful shutdown
_running = True


def get_worker_id() -> str:
    """Generate unique worker ID."""
    return f"worker-{socket.gethostname()}-{threading.current_thread().ident}"


def run_transcription(
    task: dict[str, Any],
    file_db: FileDatabase,
    task_db: TaskDatabase,
) -> None:
    """Execute transcription for a single task.

    Args:
        task: Task dictionary from database
        file_db: File database instance
        task_db: Task database instance
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

        logger.info(f"Loading Whisper model for file: {file_path}")
        engine = FasterWhisperEngine()
        options = TranscribeOptions()

        logger.info("Starting transcription with default options")
        segments_list = []
        duration = 0.0

        for segment in engine.transcribe(file_path, options, on_progress=on_progress):
            current = task_db.get_task(task_id)
            if current and current["status"] == "cancelled":
                logger.warning(f"Task {task_id} cancelled mid-transcription")
                return

            segments_list.append(asdict(segment))
            duration = max(duration, segment.end)

        if not segments_list:
            logger.warning(
                f"No segments found for task {task_id}. "
                "File may be silent or VAD filtered all content."
            )

        if task_db.complete(task_id, segments_list, duration):
            logger.info(
                f"Task {task_id} completed: {len(segments_list)} segments, "
                f"duration={duration:.2f}s"
            )
        else:
            logger.warning(f"Task {task_id} was cancelled before completion")

    except Exception as e:
        logger.error(f"Transcription failed for task {task_id}: {e}")
        task_db.fail(task_id, str(e), should_retry=True)


def worker_loop(db_path: str | Path = "data/nola.db") -> None:
    """Main worker loop.

    Args:
        db_path: Path to database file
    """
    global _running

    worker_id = get_worker_id()
    logger.info(f"Worker started: {worker_id}")

    file_db = FileDatabase(db_path)
    task_db = TaskDatabase(db_path)

    while _running:
        try:
            task = task_db.dequeue(worker_id)

            if task:
                run_transcription(task, file_db, task_db)
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
