"""Transcription task response schemas."""

from typing import Any

from pydantic import BaseModel


class SegmentResponse(BaseModel):
    """Single transcription segment."""

    start: float
    end: float
    text: str


class TaskSummaryResponse(BaseModel):
    """Task in list view (no segments)."""

    task_id: str
    file_id: str
    status: str
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
    status: str
    options: dict[str, Any] | None


class CancelTaskResponse(BaseModel):
    """Task cancellation response."""

    task_id: str
    status: str
    message: str
