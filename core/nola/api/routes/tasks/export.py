"""Task export endpoints."""

from fastapi import APIRouter, Query
from fastapi.responses import Response, StreamingResponse

from nola.api.deps import get_app_config_db, get_file_db, get_task_db
from nola.api.routes.tasks._errors import raise_http_error
from nola.api.schemas import BatchExportRequest, SavedExportResponse
from nola.application.tasks.errors import TaskUseCaseError
from nola.application.tasks.exports import batch_export_tasks, export_task
from nola.config.export import ExportFormat
from nola.services.formatters import list_export_content_types

router = APIRouter()

EXPORT_FILE_RESPONSE_CONTENT: dict[str, dict[str, dict[str, str]]] = {
    media_type: {"schema": {"type": "string", "format": "binary"}}
    for media_type in list_export_content_types()
}

# Keep OpenAPI aligned with runtime behavior:
# save=false downloads subtitle content, save=true returns JSON metadata.
EXPORT_TRANSCRIPTION_RESPONSES: dict[int | str, dict[str, object]] = {
    200: {
        "description": (
            "save=false returns subtitle file; save=true returns saved path JSON"
        ),
        "content": {
            "application/json": {
                "schema": {"$ref": "#/components/schemas/SavedExportResponse"}
            },
            **EXPORT_FILE_RESPONSE_CONTENT,
        },
    }
}

BATCH_EXPORT_RESPONSES: dict[int | str, dict[str, object]] = {
    200: {
        "description": "ZIP archive download",
        "content": {
            "application/zip": {"schema": {"type": "string", "format": "binary"}}
        },
    }
}


@router.get(
    "/{task_id}/export",
    summary="Export transcription result",
    response_model=SavedExportResponse,
    responses=EXPORT_TRANSCRIPTION_RESPONSES,
)
async def export_transcription(
    task_id: str,
    format: ExportFormat | None = Query(
        None,
        description="Output format; omitted values use persisted export defaults",
    ),
    include_timestamps: bool | None = Query(
        None,
        description=(
            "Include timestamps (TXT only); omitted values use persisted defaults"
        ),
    ),
    filename: str | None = Query(
        None,
        max_length=255,
        description=(
            "Optional output filename for single export. Extension is inferred "
            "from selected format."
        ),
    ),
    save: bool = Query(False, description="Save to server instead of download"),
) -> Response:
    """Export completed transcription as subtitle file.

    Supports SRT, VTT, TXT, and ASS formats.
    Use save=true to store file on server, save=false to download directly.
    """
    try:
        return export_task(
            task_store=get_task_db(),
            file_store=get_file_db(),
            config_store=get_app_config_db(),
            task_id=task_id,
            requested_format=format,
            requested_include_timestamps=include_timestamps,
            requested_filename=filename,
            save=save,
        )
    except TaskUseCaseError as error:
        raise_http_error(error)


@router.post(
    "/export/batch",
    summary="Batch export transcriptions",
    response_class=StreamingResponse,
    responses=BATCH_EXPORT_RESPONSES,
)
async def batch_export(request: BatchExportRequest) -> Response:
    """Export multiple transcriptions as a ZIP archive.

    Failed tasks are skipped and logged in _errors.txt within the archive.
    """
    try:
        return batch_export_tasks(
            task_store=get_task_db(),
            file_store=get_file_db(),
            config_store=get_app_config_db(),
            task_ids=request.task_ids,
            requested_format=request.format,
            requested_include_timestamps=request.include_timestamps,
            zip_name=request.zip_name,
        )
    except TaskUseCaseError as error:
        raise_http_error(error)
