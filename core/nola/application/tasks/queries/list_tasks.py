"""List-tasks use-case."""

from nola.application.tasks.contracts import SupportsTaskQueries
from nola.application.tasks.payloads import to_task_summary_payload
from nola.application.tasks.types import TaskListPayload
from nola.models.tasks import TaskSortField, TaskSortOrder


def list_tasks(
    *,
    task_store: SupportsTaskQueries,
    status: str | None,
    limit: int,
    offset: int,
    q: str | None,
    sort_by: TaskSortField,
    order: TaskSortOrder,
) -> TaskListPayload:
    """Return paged task list for API responses."""
    task_rows = task_store.list_tasks(
        status=status,
        limit=limit,
        offset=offset,
        q=q,
        sort_by=sort_by,
        order=order,
    )
    total = task_store.count_tasks(status=status, q=q)

    return {
        "tasks": [
            to_task_summary_payload(task, filename=task.get("filename"))
            for task in task_rows
        ],
        "total": total,
        "limit": limit,
        "offset": offset,
    }
