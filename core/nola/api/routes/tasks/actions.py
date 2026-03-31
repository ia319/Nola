"""Task mutation endpoints."""

from fastapi import APIRouter

from nola.api.deps import get_file_db, get_task_db
from nola.api.routes.tasks._errors import raise_http_error
from nola.api.schemas import (
    BatchTaskActionRequest,
    BatchTaskActionResponse,
    CancelTaskResponse,
    CreateTaskResponse,
    DeleteTaskRecordResponse,
    TranscriptionRequest,
)
from nola.application.tasks.actions import (
    batch_cancel_tasks,
    batch_retry_tasks,
    cancel_task,
    create_task,
    delete_task_record,
)
from nola.application.tasks.errors import TaskUseCaseError
from nola.application.tasks.types import (
    BatchTaskActionPayload,
    CancelTaskPayload,
    CreateTaskPayload,
    DeleteTaskRecordPayload,
)

router = APIRouter()


@router.post(
    "/", summary="Create transcription task", response_model=CreateTaskResponse
)
async def create_transcription(request: TranscriptionRequest) -> CreateTaskPayload:
    """Create a transcription task for an uploaded file.

    Steps:
    1. Upload file via POST /api/files to get file_id.
    2. Create task via this endpoint with file_id and optional parameters.
    3. Worker processes the task asynchronously.
    4. Query status via GET /api/transcription-tasks/{task_id}.

    All transcription parameters are optional. If omitted, the effective defaults
    (engine defaults plus persisted application overrides) are used.
    """
    try:
        return create_task(
            file_store=get_file_db(),
            task_store=get_task_db(),
            file_id=request.file_id,
            options=request.get_options_dict(),
            model_id=request.model_id,
        )
    except TaskUseCaseError as error:
        raise_http_error(error)


@router.delete("/{task_id}", response_model=CancelTaskResponse)
async def cancel_transcription(task_id: str) -> CancelTaskPayload:
    """Cancel a transcription task.

    Args:
        task_id: Task identifier

    Returns:
        Cancellation result.
    """
    try:
        return cancel_task(
            task_store=get_task_db(),
            file_store=get_file_db(),
            task_id=task_id,
        )
    except TaskUseCaseError as error:
        raise_http_error(error)


@router.post(
    "/batch/cancel",
    summary="Batch cancel transcription tasks",
    response_model=BatchTaskActionResponse,
)
async def batch_cancel_transcriptions(
    request: BatchTaskActionRequest,
) -> BatchTaskActionPayload:
    """Cancel multiple tasks and return per-task outcomes."""
    return batch_cancel_tasks(
        task_store=get_task_db(),
        file_store=get_file_db(),
        task_ids=request.task_ids,
    )


@router.post(
    "/batch/retry",
    summary="Batch retry transcription tasks",
    response_model=BatchTaskActionResponse,
)
async def batch_retry_transcriptions(
    request: BatchTaskActionRequest,
) -> BatchTaskActionPayload:
    """Retry failed or cancelled tasks by creating new pending tasks."""
    return batch_retry_tasks(
        task_store=get_task_db(),
        file_store=get_file_db(),
        task_ids=request.task_ids,
    )


@router.delete(
    "/{task_id}/record",
    summary="Delete task record",
    response_model=DeleteTaskRecordResponse,
)
async def delete_task(task_id: str) -> DeleteTaskRecordPayload:
    """Delete a terminal task record without deleting its file."""
    try:
        return delete_task_record(task_store=get_task_db(), task_id=task_id)
    except TaskUseCaseError as error:
        raise_http_error(error)
