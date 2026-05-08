"""API dependency injection."""

from collections.abc import Callable
from functools import lru_cache
from pathlib import Path

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
)
from nola.application.models import ModelOperationLocks
from nola.common.event_bus import EventBus, event_bus
from nola.config import settings
from nola.engines.base import EngineConfig
from nola.model_hub import ModelDownloader, ModelStorage, resolve_model_dir
from nola.models import AppConfigDatabase, FileDatabase, LiveDatabase, TaskDatabase

LiveRealtimeTranscriberFactory = Callable[[], LiveRealtimeTranscriber]
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
        return MockLiveRealtimeTranscriber
    if mode == _LIVE_REALTIME_TRANSCRIBER_WHISPER_STREAMING:
        return _create_whisper_streaming_live_transcriber
    return _create_invalid_live_realtime_transcriber


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


def _create_whisper_streaming_live_transcriber() -> LiveRealtimeTranscriber:
    """Create one Live WhisperStreaming transcriber instance."""
    engine_config = EngineConfig()
    loader = WhisperStreamingRuntimeLoader(
        config_store=get_app_config_db(),
        config=WhisperStreamingRuntimeLoaderConfig(
            env_model_dir=settings.model_dir,
            default_model_dir=settings.default_model_dir,
            device=engine_config.device,
            compute_type=engine_config.compute_type,
        ),
        storage_factory=ModelStorage,
    )
    return WhisperStreamingLiveTranscriber.from_loader(loader)


def _create_invalid_live_realtime_transcriber() -> LiveRealtimeTranscriber:
    """Reject an unsupported Live realtime transcriber mode."""
    raise LiveRealtimeTranscriberError(
        code="runtime_config_invalid",
        message="Live realtime transcriber setting is invalid",
    )


def invalidate_model_dir_caches() -> None:
    """Clear cached model-dir singletons after configured_model_dir changes."""
    _resolve_effective_model_dir.cache_clear()
    get_model_storage.cache_clear()
    get_model_downloader.cache_clear()
