"""Get-task use-case."""

from nola.application.tasks.contracts import SupportsFileQueries, SupportsTaskQueries
from nola.application.tasks.errors import TaskUseCaseError
from nola.application.tasks.payloads import to_task_summary_payload
from nola.application.tasks.types import TaskDetailPayload


def get_task_detail(
    *,
    task_store: SupportsTaskQueries,
    file_store: SupportsFileQueries,
    task_id: str,
) -> TaskDetailPayload:
    """Return task detail payload by task id."""
    task = task_store.get_task(task_id)
    if task is None:
        raise TaskUseCaseError(status_code=404, detail="Task not found")

    file_row = file_store.get_file(task["file_id"])
    return {
        **to_task_summary_payload(
            task, filename=file_row["filename"] if file_row else None
        ),
        "duration": task["duration"],
        "segments": task["segments"],
        "error": task["error"],
        "request_overrides": task["request_overrides"],
        "runtime_config": task["runtime_config"],
    }
