"""Batch-retry use-case."""

import uuid
from collections.abc import Callable

from nola.application.tasks.actions._batch_action import run_batch_action
from nola.application.tasks.contracts import SupportsFileQueries, SupportsTaskActions
from nola.application.tasks.payloads import build_batch_action_response
from nola.application.tasks.types import (
    BatchTaskActionPayload,
    BatchTaskActionResultPayload,
)
from nola.models.tasks import RETRYABLE_TASK_STATUSES, TaskRow


def batch_retry_tasks(
    *,
    task_store: SupportsTaskActions,
    file_store: SupportsFileQueries,
    task_ids: list[str],
    task_id_factory: Callable[[], str] | None = None,
) -> BatchTaskActionPayload:
    """Retry failed or cancelled tasks by creating new pending tasks."""

    def handle_existing_task(
        task_id: str,
        task: TaskRow,
        filename: str | None,
    ) -> BatchTaskActionResultPayload:
        status = task["status"]
        if status not in RETRYABLE_TASK_STATUSES:
            return {
                "task_id": task_id,
                "ok": False,
                "message": f"Cannot retry task with status: {status}",
                "error_code": "invalid_status",
                "status": status,
                "file_id": task["file_id"],
                "filename": filename,
            }

        if filename is None:
            return {
                "task_id": task_id,
                "ok": False,
                "message": f"File not found: {task['file_id']}",
                "error_code": "file_missing",
                "status": status,
                "file_id": task["file_id"],
            }

        next_task_id = task_id_factory() if task_id_factory else str(uuid.uuid4())
        task_store.enqueue(
            task_id=next_task_id,
            file_id=task["file_id"],
            options=task.get("options"),
        )
        return {
            "task_id": task_id,
            "ok": True,
            "message": "Retry task created successfully",
            "status": status,
            "new_task_id": next_task_id,
            "file_id": task["file_id"],
            "filename": filename,
        }

    results = run_batch_action(
        task_ids=task_ids,
        task_store=task_store,
        file_store=file_store,
        handle_existing_task=handle_existing_task,
    )
    return build_batch_action_response("retry", results)
