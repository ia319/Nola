"""Create-task use-case."""

import uuid
from collections.abc import Callable

from nola.application.tasks.contracts import SupportsFileQueries, SupportsTaskMutations
from nola.application.tasks.errors import TaskUseCaseError
from nola.application.tasks.types import CreateTaskPayload, TaskOptions


def create_task(
    *,
    file_store: SupportsFileQueries,
    task_store: SupportsTaskMutations,
    file_id: str,
    options: TaskOptions | None,
    task_id_factory: Callable[[], str] | None = None,
) -> CreateTaskPayload:
    """Create a pending transcription task for an uploaded file."""
    file_row = file_store.get_file(file_id)
    if file_row is None:
        raise TaskUseCaseError(status_code=404, detail=f"File not found: {file_id}")

    next_task_id = task_id_factory() if task_id_factory else str(uuid.uuid4())
    resolved_options = options if options else None
    task_store.enqueue(
        task_id=next_task_id,
        file_id=file_id,
        options=resolved_options,
    )

    return {
        "task_id": next_task_id,
        "file_id": file_id,
        "filename": file_row["filename"],
        "status": "pending",
        "options": resolved_options,
    }
