"""API dependency injection."""

from functools import lru_cache

from nola.config import settings
from nola.models import FileDatabase, TaskDatabase


@lru_cache
def get_file_db() -> FileDatabase:
    """Get file database instance (singleton)."""
    return FileDatabase(settings.db_path)


@lru_cache
def get_task_db() -> TaskDatabase:
    """Get task database instance (singleton)."""
    return TaskDatabase(settings.db_path)
