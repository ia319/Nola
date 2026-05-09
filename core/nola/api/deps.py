"""API dependency injection."""

from collections.abc import Callable
from functools import lru_cache
from pathlib import Path
from typing import cast

from nola.application.live.realtime import (
    LiveRealtimeTranscriber,
    LiveRealtimeTranscriberError,
    LiveStreamConnectionRegistry,
    MockLiveRealtimeTranscriber,
    default_diagnostics_output_dir,
)
from nola.application.live.realtime.whisper_streaming import (
    WhisperStreamingLiveTranscriber,
    WhisperStreamingRuntimeLoader,
    WhisperStreamingRuntimeLoaderConfig,
    whisper_streaming_runtime_snapshot_from_live_snapshot,
)
from nola.application.live.runtime_config import (
    LIVE_REALTIME_AUDIO_FORMAT,
    LIVE_RUNTIME_CONFIG_SCHEMA_VERSION,
)
from nola.application.live.types import LiveRuntimeConfig
from nola.application.models import ModelOperationLocks
from nola.common.event_bus import EventBus, event_bus
from nola.config import settings
from nola.config.live_realtime import LiveRealtimeAdapter
from nola.engines.base import EngineConfig
from nola.model_hub import (
    ModelDownloader,
    ModelStorage,
    ModelStoragePort,
    resolve_model_dir,
)
from nola.models import AppConfigDatabase, FileDatabase, LiveDatabase, TaskDatabase

LiveRealtimeTranscriberFactory = Callable[[LiveRuntimeConfig], LiveRealtimeTranscriber]
ModelStorageProvider = Callable[[], ModelStoragePort]
_LIVE_REALTIME_TRANSCRIBER_MOCK = "mock"
_LIVE_REALTIME_TRANSCRIBER_WHISPER_STREAMING = "whisper_streaming"


@lru_cache
def get_file_db() -> FileDatabase:
    """Get file database instance (singleton)."""
    return FileDatabase(settings.db_path)


@lru_cache
def get_task_db() -> TaskDatabase:
    """Get task database instance (singleton)."""
    return TaskDatabase(settings.db_path)


@lru_cache
def get_live_db() -> LiveDatabase:
    """Get live database instance (singleton)."""
    return LiveDatabase(settings.db_path)


@lru_cache
def get_live_stream_connection_registry() -> LiveStreamConnectionRegistry:
    """Get live stream connection registry instance."""
    return LiveStreamConnectionRegistry()


def get_live_diagnostics_output_dir() -> Path:
    """Return the default live diagnostics output directory."""
    return default_diagnostics_output_dir()


def get_live_realtime_transcriber_factory() -> LiveRealtimeTranscriberFactory:
    """Return the configured Live realtime transcriber factory."""
    mode = settings.live_realtime_transcriber.strip().casefold()
    if mode == _LIVE_REALTIME_TRANSCRIBER_MOCK:
        return _create_mock_live_realtime_transcriber
    if mode == _LIVE_REALTIME_TRANSCRIBER_WHISPER_STREAMING:
        return _create_whisper_streaming_live_transcriber
    return _create_invalid_live_realtime_transcriber


def get_live_realtime_adapter() -> LiveRealtimeAdapter:
    """Return the configured Live realtime adapter name."""
    return cast(
        LiveRealtimeAdapter, settings.live_realtime_transcriber.strip().casefold()
    )


@lru_cache
def get_app_config_db() -> AppConfigDatabase:
    """Get app-config database instance (singleton)."""
    return AppConfigDatabase(settings.db_path)


def get_event_bus() -> EventBus:
    """Return the process-wide event bus."""
    return event_bus


@lru_cache
def _resolve_effective_model_dir() -> str:
    """Resolve the effective model cache directory once per process."""
    config_db = get_app_config_db()
    model_config = config_db.get_all("model.")
    db_model_dir = model_config.get("configured_model_dir")
    effective_dir, _ = resolve_model_dir(
        settings.model_dir,
        db_model_dir if isinstance(db_model_dir, str) else None,
        settings.default_model_dir,
    )
    return str(effective_dir)


@lru_cache
def get_model_storage() -> ModelStorage:
    """Get model storage instance (singleton)."""
    return ModelStorage(_resolve_effective_model_dir())


def get_model_storage_provider() -> ModelStorageProvider:
    """Return a lazy model-storage provider."""
    return get_model_storage


@lru_cache
def get_model_downloader() -> ModelDownloader:
    """Get model downloader instance (singleton)."""
    return ModelDownloader(
        _resolve_effective_model_dir(),
        event_bus=get_event_bus(),
    )


@lru_cache
def get_model_operation_locks() -> ModelOperationLocks:
    """Get model operation locks (singleton)."""
    return ModelOperationLocks()


def _create_mock_live_realtime_transcriber(
    runtime_config: LiveRuntimeConfig,
) -> LiveRealtimeTranscriber:
    """Create a mock transcriber from a mock session snapshot."""
    _validate_mock_live_runtime_config(runtime_config)
    return MockLiveRealtimeTranscriber()


def _create_whisper_streaming_live_transcriber(
    runtime_config: LiveRuntimeConfig,
) -> LiveRealtimeTranscriber:
    """Create one Live WhisperStreaming transcriber instance."""
    runtime_snapshot = whisper_streaming_runtime_snapshot_from_live_snapshot(
        runtime_config
    )
    engine_config = EngineConfig()
    loader = WhisperStreamingRuntimeLoader(
        config_store=get_app_config_db(),
        config=WhisperStreamingRuntimeLoaderConfig(
            env_model_dir=settings.model_dir,
            default_model_dir=settings.default_model_dir,
            device=engine_config.device,
            compute_type=engine_config.compute_type,
            model_id=runtime_snapshot.model_id,
        ),
        storage_factory=ModelStorage,
    )
    return WhisperStreamingLiveTranscriber.from_loader(
        loader,
        config=runtime_snapshot.config,
    )


def _create_invalid_live_realtime_transcriber(
    _runtime_config: LiveRuntimeConfig,
) -> LiveRealtimeTranscriber:
    """Reject an unsupported Live realtime transcriber mode."""
    raise LiveRealtimeTranscriberError(
        code="runtime_config_invalid",
        message="Live realtime transcriber setting is invalid",
    )


def _validate_mock_live_runtime_config(runtime_config: LiveRuntimeConfig) -> None:
    """Reject non-mock runtime snapshots before creating a mock transcriber."""
    allowed_keys = {"schema_version", "runtime", "model_id", "audio_format"}
    if set(runtime_config) != allowed_keys:
        raise LiveRealtimeTranscriberError(
            code="runtime_config_invalid",
            message="Mock Live realtime snapshot is invalid",
        )
    if runtime_config["runtime"] != _LIVE_REALTIME_TRANSCRIBER_MOCK:
        raise LiveRealtimeTranscriberError(
            code="runtime_config_invalid",
            message="Live realtime snapshot does not match the configured adapter",
        )
    if (
        runtime_config["schema_version"] != LIVE_RUNTIME_CONFIG_SCHEMA_VERSION
        or runtime_config["audio_format"] != LIVE_REALTIME_AUDIO_FORMAT
    ):
        raise LiveRealtimeTranscriberError(
            code="runtime_config_invalid",
            message="Mock Live realtime snapshot is invalid",
        )


def invalidate_model_dir_caches() -> None:
    """Clear cached model-dir singletons after configured_model_dir changes."""
    _resolve_effective_model_dir.cache_clear()
    get_model_storage.cache_clear()
    get_model_downloader.cache_clear()
