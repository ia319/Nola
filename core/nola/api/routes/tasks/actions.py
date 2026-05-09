"""Task mutation endpoints."""

from fastapi import APIRouter

from nola.api.deps import get_app_config_db, get_file_db, get_task_db
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
    batch_delete_task_records,
    batch_retry_tasks,
    cancel_task,
    create_task,
    delete_task_record,
)
from nola.application.tasks.errors import TaskUseCaseError
from nola.application.tasks.execution_config import resolve_task_execution_config
from nola.application.tasks.runtime_config import build_task_runtime_config
from nola.application.tasks.types import (
    BatchTaskActionPayload,
    CancelTaskPayload,
    CreateTaskPayload,
    DeleteTaskRecordPayload,
    TaskExecutionConfigValues,
)
from nola.config import settings
from nola.config.session import get_session_execution_defaults
from nola.model_hub import get_model
from nola.models import AppConfigDatabase

router = APIRouter()


def _resolve_model_id(model_id: str) -> str | None:
    model = get_model(model_id)
    return model.model_id if model is not None else None


def _build_request_execution_values(
    request: TranscriptionRequest,
) -> TaskExecutionConfigValues:
    engine = request.engine
    return TaskExecutionConfigValues(
        model_id=request.model_id,
        device=engine.device if engine else None,
        compute_type=engine.compute_type if engine else None,
    )


def _build_session_execution_values(
    config_db: AppConfigDatabase,
) -> TaskExecutionConfigValues:
    defaults = get_session_execution_defaults(config_db)
    return TaskExecutionConfigValues(
        model_id=defaults.model_id,
        device=defaults.device,
        compute_type=defaults.compute_type,
    )


def _build_settings_execution_values() -> TaskExecutionConfigValues:
    return TaskExecutionConfigValues(
        model_id=settings.model_size,
        device=settings.device,
        compute_type=settings.compute_type,
    )


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
        request_options = request.get_options_dict()
        config_db = get_app_config_db()
        execution_config = resolve_task_execution_config(
            request=_build_request_execution_values(request),
            session_defaults=_build_session_execution_values(config_db),
            settings_defaults=_build_settings_execution_values(),
            model_resolver=_resolve_model_id,
        )
        runtime_config = build_task_runtime_config(
            request_options=request_options,
            execution_config=execution_config,
            config_store=config_db,
        )
        return create_task(
            file_store=get_file_db(),
            task_store=get_task_db(),
            file_id=request.file_id,
            options=request_options,
            execution_config=execution_config,
            runtime_config=runtime_config,
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


@router.post(
    "/batch/delete-records",
    summary="Batch delete terminal task records",
    response_model=BatchTaskActionResponse,
)
async def batch_delete_task_record_transcriptions(
    request: BatchTaskActionRequest,
) -> BatchTaskActionPayload:
    """Delete multiple terminal task records and return per-task outcomes."""
    return batch_delete_task_records(
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
