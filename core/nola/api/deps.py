"""API dependency injection."""

from functools import lru_cache

from nola.core.constants import DB_PATH
from nola.models import FileDatabase, TaskDatabase


@lru_cache
def get_file_db() -> FileDatabase:
    """Get file database instance (singleton)."""
    return FileDatabase(DB_PATH)


@lru_cache
def get_task_db() -> TaskDatabase:
    """Get task database instance (singleton)."""
    return TaskDatabase(DB_PATH)
