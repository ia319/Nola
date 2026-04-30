"""Transcription task response schemas."""

from typing import Any, Literal

from pydantic import BaseModel

# Derive from backend TaskStatus enum values.
TaskStatusLiteral = Literal["pending", "processing", "completed", "failed", "cancelled"]
BatchTaskActionErrorCode = Literal[
    "not_found",
    "invalid_status",
    "duplicate_task_id",
    "file_missing",
]


class SegmentResponse(BaseModel):
    """Single transcription segment."""

    start: float
    end: float
    text: str


class TaskSummaryResponse(BaseModel):
    """Task in list view (no segments)."""

    task_id: str
    file_id: str
    filename: str | None = None
    model_id: str | None = None
    status: TaskStatusLiteral
    progress: float
    created_at: str
    completed_at: str | None


class TaskDetailResponse(TaskSummaryResponse):
    """Full task detail with transcription result."""

    duration: float | None
    segments: list[SegmentResponse] | None
    error: str | None


class TaskListResponse(BaseModel):
    """Paginated task list response."""

    tasks: list[TaskSummaryResponse]
    total: int
    limit: int
    offset: int


class CreateTaskResponse(BaseModel):
    """Task creation response."""

    task_id: str
    file_id: str
    filename: str
    status: TaskStatusLiteral
    options: dict[str, Any] | None
    model_id: str | None = None


class CancelTaskResponse(BaseModel):
    """Task cancellation response."""

    task_id: str
    status: TaskStatusLiteral
    message: str
    task: TaskSummaryResponse


class DeleteTaskRecordResponse(BaseModel):
    """Task record deletion response."""

    task_id: str
    message: str


class SavedExportResponse(BaseModel):
    """Response when export is saved to server (save=true)."""

    saved_path: str


class BatchTaskActionResultResponse(BaseModel):
    """Per-task result for batch task actions."""

    task_id: str
    ok: bool
    message: str
    error_code: BatchTaskActionErrorCode | None = None
    status: TaskStatusLiteral | None = None
    new_task_id: str | None = None
    file_id: str | None = None
    filename: str | None = None


class BatchTaskActionSummaryResponse(BaseModel):
    """Batch task action summary counts."""

    requested: int
    succeeded: int
    failed: int


class BatchTaskActionResponse(BaseModel):
    """Response for batch task actions."""

    action: Literal["cancel", "retry", "delete_record"]
    summary: BatchTaskActionSummaryResponse
    results: list[BatchTaskActionResultResponse]
