"""Cancel-task use-case."""

from nola.application.tasks.contracts import SupportsFileQueries, SupportsTaskActions
from nola.application.tasks.errors import TaskUseCaseError
from nola.application.tasks.payloads import to_task_summary_payload
from nola.application.tasks.types import CancelTaskPayload
from nola.models.tasks import CANCELLABLE_TASK_STATUSES, TaskRow, TaskRowRaw


def cancel_task(
    *,
    task_store: SupportsTaskActions,
    file_store: SupportsFileQueries,
    task_id: str,
) -> CancelTaskPayload:
    """Cancel a task and return the authoritative task snapshot."""
    task = task_store.get_task(task_id)
    if task is None:
        raise TaskUseCaseError(status_code=404, detail="Task not found")

    message = "Task cancelled successfully"
    status = task["status"]
    cancelled_task: TaskRow | TaskRowRaw

    if status == "cancelled":
        cancelled_task = task
        message = "Task already cancelled"
    elif status not in CANCELLABLE_TASK_STATUSES:
        raise TaskUseCaseError(
            status_code=409,
            detail=f"Cannot cancel task with status: {status}",
        )
    else:
        cancelled_snapshot = task_store.cancel_with_snapshot(task_id)
        if cancelled_snapshot is None:
            latest_task = task_store.get_task(task_id)
            if latest_task is None:
                raise TaskUseCaseError(status_code=404, detail="Task not found")

            latest_status = latest_task["status"]
            if latest_status == "cancelled":
                cancelled_task = latest_task
                message = "Task already cancelled"
            else:
                raise TaskUseCaseError(
                    status_code=409,
                    detail=f"Cannot cancel task with status: {latest_status}",
                )
        else:
            cancelled_task = cancelled_snapshot

    file_row = file_store.get_file(cancelled_task["file_id"])
    task_summary = to_task_summary_payload(
        cancelled_task,
        filename=file_row["filename"] if file_row else None,
    )
    return {
        "task_id": task_summary["task_id"],
        "status": task_summary["status"],
        "message": message,
        "task": task_summary,
    }
