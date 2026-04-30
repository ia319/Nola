"""Build stable payloads shared by task use-cases."""

from nola.application.tasks.types import (
    BatchTaskActionName,
    BatchTaskActionPayload,
    BatchTaskActionResultPayload,
    TaskSummaryPayload,
)
from nola.models.tasks import TaskRow, TaskRowRaw


def to_task_summary_payload(
    task: TaskRow | TaskRowRaw,
    *,
    filename: str | None = None,
) -> TaskSummaryPayload:
    """Normalize task row payload into task summary shape."""
    return {
        "task_id": task["id"],
        "file_id": task["file_id"],
        "filename": filename,
        "model_id": task["model_id"],
        "status": task["status"],
        "progress": task["progress"],
        "created_at": task["created_at"],
        "completed_at": task["completed_at"],
    }


def build_batch_action_response(
    action: BatchTaskActionName,
    results: list[BatchTaskActionResultPayload],
) -> BatchTaskActionPayload:
    """Build a stable batch response with summary counts."""
    succeeded = sum(1 for item in results if item["ok"])
    failed = len(results) - succeeded
    return {
        "action": action,
        "summary": {
            "requested": len(results),
            "succeeded": succeeded,
            "failed": failed,
        },
        "results": results,
    }
