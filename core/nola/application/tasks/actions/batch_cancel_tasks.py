"""Batch-cancel use-case."""

from nola.application.tasks.actions._batch_action import (
    run_batch_action,
    task_not_found_result,
)
from nola.application.tasks.contracts import SupportsFileQueries, SupportsTaskActions
from nola.application.tasks.payloads import build_batch_action_response
from nola.application.tasks.types import (
    BatchTaskActionPayload,
    BatchTaskActionResultPayload,
)
from nola.models.tasks import CANCELLABLE_TASK_STATUSES, TaskRow


def batch_cancel_tasks(
    *,
    task_store: SupportsTaskActions,
    file_store: SupportsFileQueries,
    task_ids: list[str],
) -> BatchTaskActionPayload:
    """Cancel multiple tasks and return per-task outcomes."""

    def handle_existing_task(
        task_id: str,
        task: TaskRow,
        filename: str | None,
    ) -> BatchTaskActionResultPayload:
        status = task["status"]

        if status == "cancelled":
            return {
                "task_id": task_id,
                "ok": True,
                "message": "Task already cancelled",
                "status": status,
                "file_id": task["file_id"],
                "filename": filename,
            }

        if status not in CANCELLABLE_TASK_STATUSES:
            return {
                "task_id": task_id,
                "ok": False,
                "message": f"Cannot cancel task with status: {status}",
                "error_code": "invalid_status",
                "status": status,
                "file_id": task["file_id"],
                "filename": filename,
            }

        cancelled_snapshot = task_store.cancel_with_snapshot(task_id)
        if cancelled_snapshot is None:
            latest_task = task_store.get_task(task_id)
            if latest_task is None:
                return task_not_found_result(task_id)

            latest_file = file_store.get_file(latest_task["file_id"])
            latest_filename = latest_file["filename"] if latest_file else None
            latest_status = latest_task["status"]
            if latest_status == "cancelled":
                return {
                    "task_id": task_id,
                    "ok": True,
                    "message": "Task already cancelled",
                    "status": latest_status,
                    "file_id": latest_task["file_id"],
                    "filename": latest_filename,
                }

            return {
                "task_id": task_id,
                "ok": False,
                "message": f"Cannot cancel task with status: {latest_status}",
                "error_code": "invalid_status",
                "status": latest_status,
                "file_id": latest_task["file_id"],
                "filename": latest_filename,
            }

        cancelled_file = file_store.get_file(cancelled_snapshot["file_id"])
        cancelled_filename = cancelled_file["filename"] if cancelled_file else None
        return {
            "task_id": task_id,
            "ok": True,
            "message": "Task cancelled successfully",
            "status": cancelled_snapshot["status"],
            "file_id": cancelled_snapshot["file_id"],
            "filename": cancelled_filename,
        }

    results = run_batch_action(
        task_ids=task_ids,
        task_store=task_store,
        file_store=file_store,
        handle_existing_task=handle_existing_task,
    )
    return build_batch_action_response("cancel", results)
