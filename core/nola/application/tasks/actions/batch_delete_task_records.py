"""Batch delete-task-record use-case."""

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
from nola.models.tasks import TERMINAL_TASK_STATUSES, TaskRow


def batch_delete_task_records(
    *,
    task_store: SupportsTaskActions,
    file_store: SupportsFileQueries,
    task_ids: list[str],
) -> BatchTaskActionPayload:
    """Delete multiple terminal task records and return per-task outcomes."""

    def handle_existing_task(
        task_id: str,
        task: TaskRow,
        filename: str | None,
    ) -> BatchTaskActionResultPayload:
        status = task["status"]
        if status not in TERMINAL_TASK_STATUSES:
            return {
                "task_id": task_id,
                "ok": False,
                "message": f"Cannot delete task record with status: {status}",
                "error_code": "invalid_status",
                "status": status,
                "file_id": task["file_id"],
                "filename": filename,
            }

        deleted = task_store.delete_task_record(task_id)
        if not deleted:
            latest_task = task_store.get_task(task_id)
            if latest_task is None:
                return task_not_found_result(task_id)

            latest_file = file_store.get_file(latest_task["file_id"])
            latest_filename = latest_file["filename"] if latest_file else None
            latest_status = latest_task["status"]
            return {
                "task_id": task_id,
                "ok": False,
                "message": f"Cannot delete task record with status: {latest_status}",
                "error_code": "invalid_status",
                "status": latest_status,
                "file_id": latest_task["file_id"],
                "filename": latest_filename,
            }

        return {
            "task_id": task_id,
            "ok": True,
            "message": "Task record deleted successfully",
            "status": status,
            "file_id": task["file_id"],
            "filename": filename,
        }

    results = run_batch_action(
        task_ids=task_ids,
        task_store=task_store,
        file_store=file_store,
        handle_existing_task=handle_existing_task,
    )
    return build_batch_action_response("delete_record", results)
