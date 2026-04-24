"""Resolve and load worker engines at task boundaries."""

from __future__ import annotations

import logging
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol, TypeVar, cast

from nola.config import settings
from nola.config.common.types import ConfigMap
from nola.engines.base import (
    ALLOWED_ENGINE_COMPUTE_TYPES,
    ALLOWED_ENGINE_DEVICES,
    EngineComputeType,
    EngineConfig,
    EngineDevice,
    TranscriptionEngine,
)
from nola.engines.faster_whisper import FasterWhisperEngine
from nola.model_hub import ModelInfo, ModelStorage, UnknownModelError, require_model
from nola.model_hub.contracts import ModelCacheState
from nola.model_hub.storage import resolve_model_dir
from nola.models.tasks import TaskRowRaw

logger = logging.getLogger("nola.worker")


class SupportsWorkerConfig(Protocol):
    """Expose config operations required by worker engine loading."""

    def get_all(self, prefix: str) -> ConfigMap:
        """Return all config values matching the provided prefix."""

    def set_many(self, prefix: str, values: ConfigMap) -> list[str]:
        """Persist worker runtime state values."""


class SupportsModelStorage(Protocol):
    """Expose model cache reads required by worker engine loading."""

    def get_cache_state(self, repo_id: str) -> ModelCacheState:
        """Return the local cache state for one model repository."""


_EngineOptionValue = TypeVar(
    "_EngineOptionValue",
    EngineDevice,
    EngineComputeType,
)
EngineFactory = Callable[[EngineConfig], TranscriptionEngine]
ModelStorageFactory = Callable[[Path], SupportsModelStorage]


class WorkerEngineError(Exception):
    """Represent a task-scoped worker engine loading failure."""

    def __init__(self, message: str, *, should_retry: bool = False) -> None:
        """Store retry policy with the user-facing failure message."""
        self.should_retry = should_retry
        super().__init__(message)


@dataclass(frozen=True, slots=True)
class EngineFingerprint:
    """Identify one loaded worker engine configuration."""

    model_id: str
    model_dir: Path
    device: EngineDevice
    compute_type: EngineComputeType


@dataclass(frozen=True, slots=True)
class DesiredEngineState:
    """Represent the engine state required for one task."""

    fingerprint: EngineFingerprint
    model_info: ModelInfo


@dataclass(frozen=True, slots=True)
class LoadedEngineState:
    """Pair one loaded engine instance with its fingerprint."""

    fingerprint: EngineFingerprint
    engine: TranscriptionEngine


def create_faster_whisper_engine(config: EngineConfig) -> TranscriptionEngine:
    """Create the concrete worker engine from one resolved config."""
    return FasterWhisperEngine(config=config)


def _require_engine_option(
    value: str,
    *,
    field_name: str,
    allowed_values: tuple[_EngineOptionValue, ...],
) -> _EngineOptionValue:
    if value in allowed_values:
        return cast(_EngineOptionValue, value)
    expected = ", ".join(allowed_values)
    raise WorkerEngineError(
        f"Invalid task execution {field_name}: {value}. Expected one of: {expected}",
        should_retry=False,
    )


def _pick_task_or_fallback(task_value: str | None, fallback_value: str) -> str:
    if task_value is not None:
        return task_value
    return fallback_value


def _resolve_fallback_model_id(model_config: ConfigMap) -> str:
    configured_raw = model_config.get("configured_model_id")
    if isinstance(configured_raw, str):
        return configured_raw
    return settings.model_size


def build_desired_engine_state(
    task: TaskRowRaw,
    config_db: SupportsWorkerConfig,
) -> DesiredEngineState:
    """Resolve the target engine state for one queued task."""
    model_config = config_db.get_all("model.")
    raw_model_id = _pick_task_or_fallback(
        task["model_id"],
        _resolve_fallback_model_id(model_config),
    )
    raw_device = _pick_task_or_fallback(task["engine_device"], settings.device)
    raw_compute_type = _pick_task_or_fallback(
        task["engine_compute_type"],
        settings.compute_type,
    )

    try:
        model_info = require_model(raw_model_id)
    except UnknownModelError as exc:
        raise WorkerEngineError(
            f"Unknown task execution model_id: {raw_model_id}",
            should_retry=False,
        ) from exc

    db_model_dir = model_config.get("configured_model_dir")
    model_dir, _ = resolve_model_dir(
        settings.model_dir,
        db_model_dir if isinstance(db_model_dir, str) else None,
        settings.default_model_dir,
    )

    return DesiredEngineState(
        fingerprint=EngineFingerprint(
            model_id=model_info.model_id,
            model_dir=model_dir,
            device=_require_engine_option(
                raw_device,
                field_name="device",
                allowed_values=ALLOWED_ENGINE_DEVICES,
            ),
            compute_type=_require_engine_option(
                raw_compute_type,
                field_name="compute_type",
                allowed_values=ALLOWED_ENGINE_COMPUTE_TYPES,
            ),
        ),
        model_info=model_info,
    )


def _assert_model_downloaded(
    desired: DesiredEngineState,
    *,
    storage_factory: ModelStorageFactory,
) -> None:
    storage = storage_factory(desired.fingerprint.model_dir)
    if storage.get_cache_state(desired.model_info.repo_id) != "downloaded":
        raise WorkerEngineError(
            "Task execution model is not downloaded: "
            f"{desired.fingerprint.model_id} in {desired.fingerprint.model_dir}",
            should_retry=False,
        )


def _persist_loaded_state(
    config_db: SupportsWorkerConfig,
    fingerprint: EngineFingerprint,
) -> None:
    try:
        config_db.set_many(
            "worker.",
            {
                "last_loaded_model_id": fingerprint.model_id,
                "last_loaded_model_dir": str(fingerprint.model_dir),
                "last_loaded_device": fingerprint.device,
                "last_loaded_compute_type": fingerprint.compute_type,
            },
        )
    except Exception:
        logger.warning(
            "Failed to persist worker engine state for runtime tracking.",
            exc_info=True,
        )


def ensure_engine_loaded(
    *,
    task: TaskRowRaw,
    loaded: LoadedEngineState | None,
    config_db: SupportsWorkerConfig,
    engine_factory: EngineFactory = create_faster_whisper_engine,
    storage_factory: ModelStorageFactory = ModelStorage,
) -> LoadedEngineState:
    """Return a loaded engine matching the task execution fingerprint."""
    desired = build_desired_engine_state(task, config_db)
    if loaded is not None and loaded.fingerprint == desired.fingerprint:
        return loaded

    _assert_model_downloaded(desired, storage_factory=storage_factory)
    fingerprint = desired.fingerprint
    action = "Loading" if loaded is None else "Reloading"
    logger.info(
        "%s engine model=%s dir=%s device=%s compute_type=%s",
        action,
        fingerprint.model_id,
        fingerprint.model_dir,
        fingerprint.device,
        fingerprint.compute_type,
    )

    try:
        engine = engine_factory(
            EngineConfig(
                model_size=fingerprint.model_id,
                device=fingerprint.device,
                compute_type=fingerprint.compute_type,
                download_root=fingerprint.model_dir,
            )
        )
    except Exception as exc:
        raise WorkerEngineError(
            f"Failed to load task execution engine: {exc}",
            should_retry=False,
        ) from exc

    _persist_loaded_state(config_db, fingerprint)
    return LoadedEngineState(fingerprint=fingerprint, engine=engine)
