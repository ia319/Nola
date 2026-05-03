"""API dependency injection."""

from functools import lru_cache

from nola.application.models import ModelOperationLocks
from nola.common.event_bus import EventBus, event_bus
from nola.config import settings
from nola.model_hub import ModelDownloader, ModelStorage, resolve_model_dir
from nola.models import AppConfigDatabase, FileDatabase, LiveDatabase, TaskDatabase


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


def invalidate_model_dir_caches() -> None:
    """Clear cached model-dir singletons after configured_model_dir changes."""
    _resolve_effective_model_dir.cache_clear()
    get_model_storage.cache_clear()
    get_model_downloader.cache_clear()
