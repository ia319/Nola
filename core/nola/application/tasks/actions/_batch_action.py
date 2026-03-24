"""Shared batch-action skeleton for task operations."""

from collections.abc import Callable

from nola.application.tasks.contracts import SupportsFileQueries, SupportsTaskQueries
from nola.application.tasks.types import BatchTaskActionResultPayload
from nola.models.tasks import TaskRow

BatchResult = BatchTaskActionResultPayload
ExistingTaskHandler = Callable[[str, TaskRow, str | None], BatchResult]


def duplicate_task_id_result(task_id: str) -> BatchResult:
    """Build duplicate-id error payload."""
    return {
        "task_id": task_id,
        "ok": False,
        "message": "Duplicate task_id in request",
        "error_code": "duplicate_task_id",
    }


def task_not_found_result(task_id: str) -> BatchResult:
    """Build not-found error payload."""
    return {
        "task_id": task_id,
        "ok": False,
        "message": "Task not found",
        "error_code": "not_found",
    }


def run_batch_action(
    *,
    task_ids: list[str],
    task_store: SupportsTaskQueries,
    file_store: SupportsFileQueries,
    handle_existing_task: ExistingTaskHandler,
) -> list[BatchResult]:
    """Run the shared batch loop (dedupe + load + dispatch)."""
    seen_task_ids: set[str] = set()
    results: list[BatchResult] = []

    for task_id in task_ids:
        if task_id in seen_task_ids:
            results.append(duplicate_task_id_result(task_id))
            continue
        seen_task_ids.add(task_id)

        task = task_store.get_task(task_id)
        if task is None:
            results.append(task_not_found_result(task_id))
            continue

        file_row = file_store.get_file(task["file_id"])
        filename = file_row["filename"] if file_row else None
        results.append(handle_existing_task(task_id, task, filename))

    return results
