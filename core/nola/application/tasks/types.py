"""Shared payload and value types for task use-cases."""

from typing import Literal, TypedDict

TaskStatusValue = str
BatchTaskActionErrorCode = Literal[
    "not_found",
    "invalid_status",
    "duplicate_task_id",
    "file_missing",
]
TaskOptions = dict[str, object]
TaskSegment = dict[str, object]


class TaskSummaryPayload(TypedDict):
    """Task summary payload used in list and nested responses."""

    task_id: str
    file_id: str
    filename: str | None
    status: TaskStatusValue
    progress: float
    created_at: str
    completed_at: str | None


class TaskDetailPayload(TaskSummaryPayload):
    """Task detail payload with result fields."""

    duration: float | None
    segments: list[TaskSegment] | None
    error: str | None


class TaskListPayload(TypedDict):
    """Paged task list payload."""

    tasks: list[TaskSummaryPayload]
    total: int
    limit: int
    offset: int


class CreateTaskPayload(TypedDict):
    """Create task payload."""

    task_id: str
    file_id: str
    filename: str
    status: Literal["pending"]
    options: TaskOptions | None
    model_id: str | None


class CancelTaskPayload(TypedDict):
    """Cancel task payload."""

    task_id: str
    status: TaskStatusValue
    message: str
    task: TaskSummaryPayload


class DeleteTaskRecordPayload(TypedDict):
    """Delete task record payload."""

    task_id: str
    message: str


class BatchTaskActionSummaryPayload(TypedDict):
    """Batch action summary counts."""

    requested: int
    succeeded: int
    failed: int


class BatchTaskActionResultPayloadBase(TypedDict):
    """Mandatory fields in per-task batch action result."""

    task_id: str
    ok: bool
    message: str


class BatchTaskActionResultPayload(BatchTaskActionResultPayloadBase, total=False):
    """Optional fields in per-task batch action result."""

    error_code: BatchTaskActionErrorCode
    status: TaskStatusValue
    new_task_id: str
    file_id: str
    filename: str | None


class BatchTaskActionPayload(TypedDict):
    """Batch task action response payload."""

    action: Literal["cancel", "retry"]
    summary: BatchTaskActionSummaryPayload
    results: list[BatchTaskActionResultPayload]
