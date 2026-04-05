"""Shared task database types and constants."""

from enum import Enum
from typing import Any, Literal, TypedDict

from typing_extensions import NotRequired


class TaskRowRaw(TypedDict):
    """Raw row from SQLite, segments/options are JSON strings."""

    id: str
    file_id: str
    model_id: str | None
    filename: NotRequired[str | None]
    status: str
    priority: int
    retry_count: int
    max_retries: int
    worker_id: str | None
    started_at: str | None
    last_heartbeat: str | None
    timeout_seconds: int
    options: str | None
    progress: float
    duration: float | None
    segments: str | None
    error: str | None
    created_at: str
    completed_at: str | None


class TaskRow(TypedDict):
    """Parsed task row, segments/options already deserialized."""

    id: str
    file_id: str
    model_id: str | None
    filename: NotRequired[str | None]
    status: str
    priority: int
    retry_count: int
    max_retries: int
    worker_id: str | None
    started_at: str | None
    last_heartbeat: str | None
    timeout_seconds: int
    options: dict[str, Any] | None
    progress: float
    duration: float | None
    segments: list[dict[str, Any]] | None
    error: str | None
    created_at: str
    completed_at: str | None


class TaskStatus(str, Enum):
    """Transcription task status."""

    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


TaskSortField = Literal["created_at", "completed_at", "status", "progress", "filename"]
TaskSortOrder = Literal["asc", "desc"]

DEFAULT_TASK_SORT_BY: TaskSortField = "created_at"
DEFAULT_TASK_SORT_ORDER: TaskSortOrder = "desc"
TASK_SORT_COLUMNS: dict[TaskSortField, str] = {
    "created_at": "t.created_at",
    "completed_at": "t.completed_at",
    "status": "t.status",
    "progress": "t.progress",
    "filename": "LOWER(COALESCE(f.filename, ''))",
}

TERMINAL_TASK_STATUSES = (
    TaskStatus.COMPLETED.value,
    TaskStatus.FAILED.value,
    TaskStatus.CANCELLED.value,
)
CANCELLABLE_TASK_STATUSES = (
    TaskStatus.PENDING.value,
    TaskStatus.PROCESSING.value,
)
RETRYABLE_TASK_STATUSES = (
    TaskStatus.FAILED.value,
    TaskStatus.CANCELLED.value,
)
