"""Delete-task-record use-case."""

from nola.application.tasks.contracts import SupportsTaskActions
from nola.application.tasks.errors import TaskUseCaseError
from nola.application.tasks.types import DeleteTaskRecordPayload
from nola.models.tasks import TERMINAL_TASK_STATUSES


def delete_task_record(
    *,
    task_store: SupportsTaskActions,
    task_id: str,
) -> DeleteTaskRecordPayload:
    """Delete a terminal task record."""
    task = task_store.get_task(task_id)
    if task is None:
        raise TaskUseCaseError(status_code=404, detail="Task not found")

    if task["status"] not in TERMINAL_TASK_STATUSES:
        raise TaskUseCaseError(
            status_code=400,
            detail="Only terminal tasks can be deleted (completed/failed/cancelled)",
        )

    deleted = task_store.delete_task_record(task_id)
    if not deleted:
        raise TaskUseCaseError(status_code=404, detail="Task not found")

    return {"task_id": task_id, "message": "Task record deleted successfully"}
