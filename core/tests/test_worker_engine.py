"""Tests for worker engine loading and reload decisions."""

from collections.abc import Callable
from pathlib import Path
from unittest.mock import Mock, PropertyMock, patch

import pytest

from nola.config.common.types import ConfigMap
from nola.config.settings import Settings
from nola.engines.base import (
    DEFAULT_ENGINE_COMPUTE_TYPE,
    DEFAULT_ENGINE_DEVICE,
    EngineConfig,
    TranscriptionEngine,
)
from nola.model_hub.contracts import ModelCacheState
from nola.models.tasks import TaskRowRaw
from nola.services import worker_engine
from nola.services.worker_engine import (
    EngineFingerprint,
    LoadedEngineState,
    WorkerEngineError,
    build_desired_engine_state,
    ensure_engine_loaded,
    release_loaded_engine,
)


class StubWorkerConfig:
    """Provide model config reads and worker state writes."""

    def __init__(self, model_config: ConfigMap | None = None) -> None:
        self.model_config = model_config or {}
        self.writes: list[tuple[str, ConfigMap]] = []

    def get_all(self, prefix: str) -> ConfigMap:
        assert prefix == "model."
        return self.model_config

    def set_many(self, prefix: str, values: ConfigMap) -> list[str]:
        self.writes.append((prefix, values))
        return [f"{prefix}{key}" for key in values]


class FailingWorkerConfig(StubWorkerConfig):
    """Fail worker state writes after successful engine load."""

    def set_many(self, prefix: str, values: ConfigMap) -> list[str]:
        raise RuntimeError("db busy")


class StubModelStorage:
    """Return one configured cache state for every model lookup."""

    def __init__(self, state: ModelCacheState = "downloaded") -> None:
        self.state = state
        self.repo_ids: list[str] = []

    def get_cache_state(self, repo_id: str) -> ModelCacheState:
        self.repo_ids.append(repo_id)
        return self.state


def _raw_task(
    *,
    model_id: str | None = "small",
    engine_device: str | None = "cpu",
    engine_compute_type: str | None = "default",
) -> TaskRowRaw:
    return {
        "id": "task-1",
        "file_id": "file-1",
        "model_id": model_id,
        "engine_device": engine_device,
        "engine_compute_type": engine_compute_type,
        "status": "processing",
        "priority": 0,
        "retry_count": 0,
        "max_retries": 3,
        "worker_id": "worker-1",
        "started_at": None,
        "last_heartbeat": None,
        "timeout_seconds": 3600,
        "options": None,
        "progress": 0.0,
        "duration": None,
        "segments": None,
        "error": None,
        "created_at": "2026-01-01T00:00:00",
        "completed_at": None,
    }


def _engine_factory(
    configs: list[EngineConfig],
) -> Callable[[EngineConfig], TranscriptionEngine]:
    def create_engine(config: EngineConfig) -> TranscriptionEngine:
        configs.append(config)
        return Mock(spec=TranscriptionEngine)

    return create_engine


def test_build_desired_engine_state_uses_task_execution_config(
    tmp_path: Path,
) -> None:
    """Task execution fields should become the target engine fingerprint."""
    with (
        patch.object(worker_engine.settings, "model_dir", None),
        patch.object(
            Settings,
            "default_model_dir",
            new_callable=PropertyMock,
            return_value=tmp_path,
        ),
    ):
        desired = build_desired_engine_state(
            _raw_task(engine_device="cuda", engine_compute_type="float16"),
            StubWorkerConfig(),
        )

    assert desired.fingerprint == EngineFingerprint(
        model_id="small",
        model_dir=tmp_path,
        device="cuda",
        compute_type="float16",
    )


def test_build_desired_engine_state_falls_back_for_legacy_tasks(
    tmp_path: Path,
) -> None:
    """Legacy tasks without execution fields should use current defaults."""
    with (
        patch.object(worker_engine.settings, "model_size", "small"),
        patch.object(worker_engine.settings, "model_dir", None),
        patch.object(worker_engine.settings, "device", "cpu"),
        patch.object(worker_engine.settings, "compute_type", "default"),
        patch.object(
            Settings,
            "default_model_dir",
            new_callable=PropertyMock,
            return_value=tmp_path,
        ),
    ):
        desired = build_desired_engine_state(
            _raw_task(
                model_id=None,
                engine_device=None,
                engine_compute_type=None,
            ),
            StubWorkerConfig({"configured_model_id": "large"}),
        )

    assert desired.fingerprint == EngineFingerprint(
        model_id="large-v3",
        model_dir=tmp_path,
        device="cpu",
        compute_type="default",
    )


def test_build_desired_engine_state_safely_falls_back_for_invalid_settings(
    tmp_path: Path,
) -> None:
    """Invalid process settings should not permanently fail legacy tasks."""
    with (
        patch.object(worker_engine.settings, "model_size", "small"),
        patch.object(worker_engine.settings, "model_dir", None),
        patch.object(worker_engine.settings, "device", "metal"),
        patch.object(worker_engine.settings, "compute_type", "bf16"),
        patch.object(worker_engine.logger, "warning") as logger_warning,
        patch.object(
            Settings,
            "default_model_dir",
            new_callable=PropertyMock,
            return_value=tmp_path,
        ),
    ):
        desired = build_desired_engine_state(
            _raw_task(
                model_id=None,
                engine_device=None,
                engine_compute_type=None,
            ),
            StubWorkerConfig(),
        )

    assert desired.fingerprint == EngineFingerprint(
        model_id="small",
        model_dir=tmp_path,
        device=DEFAULT_ENGINE_DEVICE,
        compute_type=DEFAULT_ENGINE_COMPUTE_TYPE,
    )
    assert logger_warning.call_count == 2


def test_build_desired_engine_state_prefers_settings_model_dir(
    tmp_path: Path,
) -> None:
    """An explicit process model dir should take precedence over DB/default dirs."""
    env_model_dir = tmp_path / "env-models"
    db_model_dir = tmp_path / "db-models"
    default_model_dir = tmp_path / "default-models"

    with (
        patch.object(worker_engine.settings, "model_dir", env_model_dir),
        patch.object(
            Settings,
            "default_model_dir",
            new_callable=PropertyMock,
            return_value=default_model_dir,
        ),
    ):
        desired = build_desired_engine_state(
            _raw_task(),
            StubWorkerConfig({"configured_model_dir": str(db_model_dir)}),
        )

    assert desired.fingerprint.model_dir == env_model_dir.resolve(strict=False)


def test_build_desired_engine_state_rejects_invalid_engine_option(
    tmp_path: Path,
) -> None:
    """Invalid persisted task engine options should fail the current task."""
    with (
        patch.object(worker_engine.settings, "model_dir", None),
        patch.object(
            Settings,
            "default_model_dir",
            new_callable=PropertyMock,
            return_value=tmp_path,
        ),
        pytest.raises(WorkerEngineError, match="Invalid task execution device: metal"),
    ):
        build_desired_engine_state(
            _raw_task(engine_device="metal"),
            StubWorkerConfig(),
        )


def test_build_desired_engine_state_rejects_unknown_model(tmp_path: Path) -> None:
    """Unknown task model ids should fail the current task."""
    with (
        patch.object(worker_engine.settings, "model_dir", None),
        patch.object(
            Settings,
            "default_model_dir",
            new_callable=PropertyMock,
            return_value=tmp_path,
        ),
        pytest.raises(
            WorkerEngineError,
            match="Unknown task execution model_id: missing",
        ),
    ):
        build_desired_engine_state(
            _raw_task(model_id="missing"),
            StubWorkerConfig(),
        )


def test_ensure_engine_loaded_loads_and_persists_state(tmp_path: Path) -> None:
    """Loading an engine should persist the complete runtime fingerprint."""
    configs: list[EngineConfig] = []
    storage = StubModelStorage()
    config_store = StubWorkerConfig()

    with (
        patch.object(worker_engine.settings, "model_dir", None),
        patch.object(
            Settings,
            "default_model_dir",
            new_callable=PropertyMock,
            return_value=tmp_path,
        ),
    ):
        loaded = ensure_engine_loaded(
            task=_raw_task(engine_device="cuda", engine_compute_type="float16"),
            loaded=None,
            config_db=config_store,
            engine_factory=_engine_factory(configs),
            storage_factory=lambda _path: storage,
        )

    assert loaded.fingerprint == EngineFingerprint(
        model_id="small",
        model_dir=tmp_path,
        device="cuda",
        compute_type="float16",
    )
    assert configs == [
        EngineConfig(
            model_size="small",
            device="cuda",
            compute_type="float16",
            download_root=tmp_path,
        )
    ]
    assert config_store.writes == [
        (
            "worker.",
            {
                "last_loaded_model_id": "small",
                "last_loaded_model_dir": str(tmp_path),
                "last_loaded_device": "cuda",
                "last_loaded_compute_type": "float16",
            },
        )
    ]


def test_ensure_engine_loaded_reuses_matching_fingerprint(tmp_path: Path) -> None:
    """Matching fingerprints should reuse the loaded engine."""
    engine = Mock(spec=TranscriptionEngine)
    loaded = LoadedEngineState(
        fingerprint=EngineFingerprint(
            model_id="small",
            model_dir=tmp_path,
            device="cpu",
            compute_type="default",
        ),
        engine=engine,
    )

    with (
        patch.object(worker_engine.settings, "model_dir", None),
        patch.object(
            Settings,
            "default_model_dir",
            new_callable=PropertyMock,
            return_value=tmp_path,
        ),
    ):
        result = ensure_engine_loaded(
            task=_raw_task(),
            loaded=loaded,
            config_db=StubWorkerConfig(),
            engine_factory=Mock(side_effect=AssertionError("unexpected load")),
            storage_factory=Mock(side_effect=AssertionError("unexpected storage")),
        )

    assert result is loaded


def test_ensure_engine_loaded_reloads_when_device_changes(tmp_path: Path) -> None:
    """A changed device should create a new engine."""
    configs: list[EngineConfig] = []
    loaded = LoadedEngineState(
        fingerprint=EngineFingerprint(
            model_id="small",
            model_dir=tmp_path,
            device="cpu",
            compute_type="default",
        ),
        engine=Mock(spec=TranscriptionEngine),
    )

    with (
        patch.object(worker_engine.settings, "model_dir", None),
        patch.object(
            Settings,
            "default_model_dir",
            new_callable=PropertyMock,
            return_value=tmp_path,
        ),
    ):
        result = ensure_engine_loaded(
            task=_raw_task(engine_device="cuda"),
            loaded=loaded,
            config_db=StubWorkerConfig(),
            engine_factory=_engine_factory(configs),
            storage_factory=lambda _path: StubModelStorage(),
        )

    assert result is not loaded
    assert configs[0].device == "cuda"


def test_ensure_engine_loaded_reloads_when_compute_type_changes(
    tmp_path: Path,
) -> None:
    """A changed compute type should create a new engine."""
    configs: list[EngineConfig] = []
    loaded = LoadedEngineState(
        fingerprint=EngineFingerprint(
            model_id="small",
            model_dir=tmp_path,
            device="cpu",
            compute_type="default",
        ),
        engine=Mock(spec=TranscriptionEngine),
    )

    with (
        patch.object(worker_engine.settings, "model_dir", None),
        patch.object(
            Settings,
            "default_model_dir",
            new_callable=PropertyMock,
            return_value=tmp_path,
        ),
    ):
        result = ensure_engine_loaded(
            task=_raw_task(engine_compute_type="int8"),
            loaded=loaded,
            config_db=StubWorkerConfig(),
            engine_factory=_engine_factory(configs),
            storage_factory=lambda _path: StubModelStorage(),
        )

    assert result is not loaded
    assert configs[0].compute_type == "int8"


def test_ensure_engine_loaded_reloads_when_model_changes(tmp_path: Path) -> None:
    """A changed model id should create a new engine."""
    configs: list[EngineConfig] = []
    loaded = LoadedEngineState(
        fingerprint=EngineFingerprint(
            model_id="small",
            model_dir=tmp_path,
            device="cpu",
            compute_type="default",
        ),
        engine=Mock(spec=TranscriptionEngine),
    )

    with (
        patch.object(worker_engine.settings, "model_dir", None),
        patch.object(
            Settings,
            "default_model_dir",
            new_callable=PropertyMock,
            return_value=tmp_path,
        ),
    ):
        result = ensure_engine_loaded(
            task=_raw_task(model_id="base"),
            loaded=loaded,
            config_db=StubWorkerConfig(),
            engine_factory=_engine_factory(configs),
            storage_factory=lambda _path: StubModelStorage(),
        )

    assert result is not loaded
    assert configs[0].model_size == "base"


def test_release_loaded_engine_closes_engine_and_collects(
    tmp_path: Path,
) -> None:
    """Reload release should close the engine and trigger finalizers promptly."""
    engine = Mock(spec=TranscriptionEngine)
    loaded = LoadedEngineState(
        fingerprint=EngineFingerprint(
            model_id="small",
            model_dir=tmp_path,
            device="cpu",
            compute_type="default",
        ),
        engine=engine,
    )

    with patch("nola.services.worker_engine.gc.collect") as collect:
        release_loaded_engine(loaded)

    engine.close.assert_called_once_with()
    collect.assert_called_once_with()


def test_release_loaded_engine_reports_close_failure(tmp_path: Path) -> None:
    """Close failures should fail the current task without loading a new engine."""
    engine = Mock(spec=TranscriptionEngine)
    engine.close.side_effect = RuntimeError("close failed")
    loaded = LoadedEngineState(
        fingerprint=EngineFingerprint(
            model_id="small",
            model_dir=tmp_path,
            device="cpu",
            compute_type="default",
        ),
        engine=engine,
    )

    with (
        patch("nola.services.worker_engine.gc.collect") as collect,
        pytest.raises(WorkerEngineError, match="Failed to release"),
    ):
        release_loaded_engine(loaded)

    collect.assert_called_once_with()


def test_ensure_engine_loaded_rejects_missing_model_cache(tmp_path: Path) -> None:
    """Missing model cache should fail the task before engine creation."""
    configs: list[EngineConfig] = []

    with (
        patch.object(worker_engine.settings, "model_dir", None),
        patch.object(
            Settings,
            "default_model_dir",
            new_callable=PropertyMock,
            return_value=tmp_path,
        ),
        pytest.raises(WorkerEngineError, match="not downloaded"),
    ):
        ensure_engine_loaded(
            task=_raw_task(),
            loaded=None,
            config_db=StubWorkerConfig(),
            engine_factory=_engine_factory(configs),
            storage_factory=lambda _path: StubModelStorage("not_downloaded"),
        )

    assert configs == []


def test_ensure_engine_loaded_marks_factory_failure_retryable(tmp_path: Path) -> None:
    """Engine construction failures should requeue while retries remain."""
    with (
        patch.object(worker_engine.settings, "model_dir", None),
        patch.object(
            Settings,
            "default_model_dir",
            new_callable=PropertyMock,
            return_value=tmp_path,
        ),
        pytest.raises(WorkerEngineError, match="Failed to load") as exc_info,
    ):
        ensure_engine_loaded(
            task=_raw_task(),
            loaded=None,
            config_db=StubWorkerConfig(),
            engine_factory=Mock(side_effect=RuntimeError("cuda busy")),
            storage_factory=lambda _path: StubModelStorage(),
        )

    assert exc_info.value.should_retry is True


def test_ensure_engine_loaded_ignores_worker_state_write_failure(
    tmp_path: Path,
) -> None:
    """Worker state persistence failures should not fail transcription loading."""
    configs: list[EngineConfig] = []
    produced_engine = Mock(spec=TranscriptionEngine)

    def create_engine(config: EngineConfig) -> TranscriptionEngine:
        configs.append(config)
        return produced_engine

    with (
        patch.object(worker_engine.settings, "model_dir", None),
        patch.object(
            Settings,
            "default_model_dir",
            new_callable=PropertyMock,
            return_value=tmp_path,
        ),
        patch.object(worker_engine.logger, "warning") as logger_warning,
    ):
        loaded = ensure_engine_loaded(
            task=_raw_task(),
            loaded=None,
            config_db=FailingWorkerConfig(),
            engine_factory=create_engine,
            storage_factory=lambda _path: StubModelStorage(),
        )

    assert loaded.fingerprint.model_id == "small"
    assert loaded.engine is produced_engine
    logger_warning.assert_called_once()
