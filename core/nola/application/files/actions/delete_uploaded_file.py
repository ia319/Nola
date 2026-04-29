"""Delete-uploaded-file use-case."""

import sqlite3
from pathlib import Path

from nola.application.files.contracts import SupportsFileActions
from nola.application.files.errors import FileUseCaseError
from nola.application.files.types import DeleteUploadedFilePayload


def _linked_tasks_detail(file_id: str, linked_task_count: int) -> str:
    """Return the stable linked-task deletion failure detail."""
    return (
        f"Cannot delete file {file_id}: "
        f"{linked_task_count} transcription task(s) still reference it"
    )


def delete_uploaded_file(
    *,
    file_store: SupportsFileActions,
    file_id: str,
) -> DeleteUploadedFilePayload:
    """Delete one uploaded file when no task records still reference it."""
    file = file_store.get_file(file_id)
    if file is None:
        raise FileUseCaseError(
            status_code=404,
            detail="File not found",
            error_code="not_found",
        )

    linked_task_count = file_store.count_linked_tasks(file_id)
    if linked_task_count > 0:
        # TODO(backend): Decide whether file deletion should cascade to related
        # task records instead of rejecting the request [2026-04-15]
        raise FileUseCaseError(
            status_code=409,
            detail=_linked_tasks_detail(file_id, linked_task_count),
            error_code="linked_tasks",
        )

    file_path = Path(file["path"])

    # Delete the DB row first so failures leave an orphan file, not an orphan row.
    try:
        deleted = file_store.delete_file(file_id)
    except sqlite3.IntegrityError as exc:
        linked_task_count = max(1, file_store.count_linked_tasks(file_id))
        raise FileUseCaseError(
            status_code=409,
            detail=_linked_tasks_detail(file_id, linked_task_count),
            error_code="linked_tasks",
        ) from exc

    if not deleted:
        raise FileUseCaseError(
            status_code=404,
            detail="File not found",
            error_code="not_found",
        )

    file_path.unlink(missing_ok=True)

    return {
        "file_id": file_id,
        "message": f"File {file_id} deleted",
        "filename": file["filename"],
    }
