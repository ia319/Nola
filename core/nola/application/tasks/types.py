"""Shared payload and value types for task use-cases."""

from dataclasses import dataclass
from typing import Literal, TypeAlias, TypedDict

from nola.common.types import JsonDict
from nola.engines.base import EngineComputeType, EngineDevice

TaskStatusValue = str
BatchTaskActionErrorCode = Literal[
    "not_found",
    "invalid_status",
    "duplicate_task_id",
    "file_missing",
]
TaskOptions = dict[str, object]
TaskSegment = dict[str, object]
TaskRuntimeConfig: TypeAlias = JsonDict
TaskRequestOverrides: TypeAlias = JsonDict


@dataclass(frozen=True, slots=True)
class TaskExecutionConfigValues:
    """Group one layer of task execution configuration values."""

    model_id: str | None = None
    device: str | None = None
    compute_type: str | None = None


class ResolvedTaskExecutionConfig(TypedDict):
    """Task execution configuration materialized at creation time."""

    model_id: str
    engine_device: EngineDevice
    engine_compute_type: EngineComputeType


class TaskSummaryPayload(TypedDict):
    """Task summary payload used in list and nested responses."""

    task_id: str
    file_id: str
    filename: str | None
    model_id: str | None
    status: TaskStatusValue
    progress: float
    created_at: str
    completed_at: str | None


class TaskDetailPayload(TaskSummaryPayload):
    """Task detail payload with result fields."""

    duration: float | None
    segments: list[TaskSegment] | None
    error: str | None
    runtime_config: TaskRuntimeConfig | None


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
    runtime_config: TaskRuntimeConfig | None


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


BatchTaskActionName = Literal["cancel", "retry", "delete_record"]


class BatchTaskActionPayload(TypedDict):
    """Batch task action response payload."""

    action: BatchTaskActionName
    summary: BatchTaskActionSummaryPayload
    results: list[BatchTaskActionResultPayload]
