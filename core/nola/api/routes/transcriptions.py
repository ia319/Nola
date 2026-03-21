"""Transcription API endpoints."""

import logging
import re
import uuid
from pathlib import Path
from typing import Any, Literal
from urllib.parse import quote

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse, Response, StreamingResponse

from nola.api.deps import get_file_db, get_task_db
from nola.api.schemas import (
    BatchExportRequest,
    CancelTaskResponse,
    CreateTaskResponse,
    DeleteTaskRecordResponse,
    SavedExportResponse,
    TaskDetailResponse,
    TaskListResponse,
    TranscriptionRequest,
)
from nola.models.tasks import (
    CANCELLABLE_TASK_STATUSES,
    DEFAULT_TASK_SORT_BY,
    DEFAULT_TASK_SORT_ORDER,
    TERMINAL_TASK_STATUSES,
    TaskRow,
    TaskRowRaw,
    TaskSortField,
    TaskSortOrder,
)
from nola.services.formatters import ExportFormat, list_export_content_types

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/transcription-tasks", tags=["transcription-tasks"])
legacy_router = APIRouter(prefix="/api/transcriptions", tags=["transcriptions"])

# Valid status values for filtering
StatusFilter = Literal["pending", "processing", "completed", "failed", "cancelled"]


def _to_task_summary_payload(
    task: TaskRow | TaskRowRaw,
    *,
    filename: str | None = None,
) -> dict[str, Any]:
    """Normalize task row payload into TaskSummaryResponse shape."""
    return {
        "task_id": task["id"],
        "file_id": task["file_id"],
        "filename": filename,
        "status": task["status"],
        "progress": task["progress"],
        "created_at": task["created_at"],
        "completed_at": task["completed_at"],
    }


@legacy_router.post(
    "/",
    summary="Create transcription task",
    response_model=CreateTaskResponse,
    deprecated=True,
)
@router.post(
    "/", summary="Create transcription task", response_model=CreateTaskResponse
)
async def create_transcription(request: TranscriptionRequest) -> dict[str, Any]:
    """Create a transcription task for an uploaded file.

    Steps:
    1. Upload file via POST /api/files → get file_id
    2. Create task via this endpoint with file_id and optional parameters
    3. Worker will automatically process the task
    4. Query status via GET /api/transcription-tasks/{task_id}

    All transcription parameters are optional. If omitted, the effective defaults
    (engine defaults plus persisted application overrides) will be used.
    See GET /api/config for effective defaults and
    GET /api/config/transcription/engine-defaults for raw engine defaults.
    """
    file_db = get_file_db()
    task_db = get_task_db()

    file = file_db.get_file(request.file_id)
    if file is None:
        raise HTTPException(
            status_code=404, detail=f"File not found: {request.file_id}"
        )

    task_id = str(uuid.uuid4())
    options = request.get_options_dict()

    task_db.enqueue(
        task_id=task_id,
        file_id=request.file_id,
        options=options if options else None,
    )

    return {
        "task_id": task_id,
        "file_id": request.file_id,
        "filename": file["filename"],
        "status": "pending",
        "options": options if options else None,
    }


@legacy_router.get("/", response_model=TaskListResponse, deprecated=True)
@router.get("/", response_model=TaskListResponse)
async def list_transcriptions(
    status: StatusFilter | None = Query(None, description="Filter by status"),
    limit: int = Query(50, ge=1, le=100, description="Max results"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    q: str | None = Query(None, description="Search keyword for filename"),
    sort_by: TaskSortField = Query(DEFAULT_TASK_SORT_BY, description="Sort field"),
    order: TaskSortOrder = Query(DEFAULT_TASK_SORT_ORDER, description="Sort order"),
) -> dict[str, Any]:
    """List all transcription tasks.

    Args:
        status: Optional status filter (pending, processing, completed, failed)
        limit: Maximum number of results
        offset: Pagination offset
        q: Optional filename search keyword
        sort_by: Sort field
        order: Sort order (asc or desc)

    Returns:
        List of tasks with pagination info
    """
    task_db = get_task_db()

    tasks = task_db.list_tasks(
        status=status,
        limit=limit,
        offset=offset,
        q=q,
        sort_by=sort_by,
        order=order,
    )
    total = task_db.count_tasks(status=status, q=q)

    return {
        "tasks": [
            _to_task_summary_payload(t, filename=t.get("filename")) for t in tasks
        ],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@legacy_router.get("/{task_id}", response_model=TaskDetailResponse, deprecated=True)
@router.get("/{task_id}", response_model=TaskDetailResponse)
async def get_transcription(task_id: str) -> dict[str, Any]:
    """Get transcription task status and result.

    Args:
        task_id: Task identifier

    Returns:
        Task status and result
    """
    task_db = get_task_db()
    file_db = get_file_db()
    task = task_db.get_task(task_id)

    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")

    file = file_db.get_file(task["file_id"])

    return {
        **_to_task_summary_payload(task, filename=file["filename"] if file else None),
        "duration": task["duration"],
        "segments": task["segments"],
        "error": task["error"],
    }


@legacy_router.delete("/{task_id}", response_model=CancelTaskResponse, deprecated=True)
@router.delete("/{task_id}", response_model=CancelTaskResponse)
async def cancel_transcription(task_id: str) -> dict[str, Any]:
    """Cancel a transcription task.

    Args:
        task_id: Task identifier

    Returns:
        Cancellation result
    """
    task_db = get_task_db()
    file_db = get_file_db()

    task = task_db.get_task(task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")

    message = "Task cancelled successfully"
    status = task["status"]
    cancelled_task: TaskRow | TaskRowRaw

    if status == "cancelled":
        cancelled_task = task
        message = "Task already cancelled"
    elif status not in CANCELLABLE_TASK_STATUSES:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot cancel task with status: {status}",
        )
    else:
        cancelled_snapshot = task_db.cancel_with_snapshot(task_id)
        if cancelled_snapshot is None:
            latest_task = task_db.get_task(task_id)
            if latest_task is None:
                raise HTTPException(status_code=404, detail="Task not found")
            latest_status = latest_task["status"]
            if latest_status == "cancelled":
                cancelled_task = latest_task
                message = "Task already cancelled"
            else:
                raise HTTPException(
                    status_code=409,
                    detail=f"Cannot cancel task with status: {latest_status}",
                )
        else:
            cancelled_task = cancelled_snapshot

    file = file_db.get_file(cancelled_task["file_id"])
    task_summary = _to_task_summary_payload(
        cancelled_task, filename=file["filename"] if file else None
    )
    return {
        "task_id": task_summary["task_id"],
        "status": task_summary["status"],
        "message": message,
        "task": task_summary,
    }


@legacy_router.delete(
    "/{task_id}/record",
    summary="Delete task record",
    response_model=DeleteTaskRecordResponse,
    deprecated=True,
)
@router.delete(
    "/{task_id}/record",
    summary="Delete task record",
    response_model=DeleteTaskRecordResponse,
)
async def delete_task_record(task_id: str) -> dict[str, str]:
    """Delete a terminal task record without deleting its file."""
    task_db = get_task_db()
    task = task_db.get_task(task_id)

    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")

    if task["status"] not in TERMINAL_TASK_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=("Only terminal tasks can be deleted (completed/failed/cancelled)"),
        )

    deleted = task_db.delete_task_record(task_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Task not found")

    return {"task_id": task_id, "message": "Task record deleted successfully"}


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


@legacy_router.get(
    "/{task_id}/export",
    summary="Export transcription result",
    response_model=SavedExportResponse,
    responses=EXPORT_TRANSCRIPTION_RESPONSES,
    deprecated=True,
)
@router.get(
    "/{task_id}/export",
    summary="Export transcription result",
    response_model=SavedExportResponse,
    responses=EXPORT_TRANSCRIPTION_RESPONSES,
)
async def export_transcription(
    task_id: str,
    format: ExportFormat = Query(ExportFormat.SRT, description="Output format"),
    include_timestamps: bool = Query(True, description="Include timestamps (TXT only)"),
    save: bool = Query(False, description="Save to server instead of download"),
) -> Response:
    """Export completed transcription as subtitle file.

    Supports SRT, VTT, TXT, and ASS formats.
    Use save=true to store file on server, save=false to download directly.
    """
    from nola.config import settings
    from nola.models.tasks import TaskStatus
    from nola.services.formatters import SegmentData, get_formatter

    task_db = get_task_db()
    file_db = get_file_db()
    task = task_db.get_task(task_id)

    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")

    if task["status"] != TaskStatus.COMPLETED.value:
        raise HTTPException(
            status_code=400,
            detail=f"Task not completed, current status: {task['status']}",
        )

    segments = task.get("segments") or []
    if not segments:
        raise HTTPException(status_code=400, detail="No segments available")

    # NOTE: Fail-fast strategy for data integrity.
    # Future: Consider best-effort export with skipped segment warnings.
    segment_data: list[SegmentData] = []
    for i, s in enumerate(segments):
        try:
            segment_data.append(
                SegmentData(start=s["start"], end=s["end"], text=s["text"])
            )
        except (KeyError, TypeError, ValueError) as e:
            context = f"start={s.get('start')}, end={s.get('end')}"
            raise HTTPException(
                status_code=500,
                detail=f"Invalid segment[{i}] in task {task_id}: {e}. Data: {context}",
            )

    formatter = get_formatter(format, include_timestamps=include_timestamps)
    content = formatter.format(segment_data)

    file_info = file_db.get_file(task["file_id"])
    if file_info:
        base_name = Path(file_info["filename"]).stem
    else:
        base_name = task_id

    export_filename = f"{base_name}.{formatter.file_extension}"

    if save:
        exports_dir = settings.exports_dir
        exports_dir.mkdir(parents=True, exist_ok=True)
        export_path = exports_dir / export_filename
        export_path.write_text(content, encoding="utf-8")

        relative_path = f"exports/{export_filename}"
        return JSONResponse(content={"saved_path": relative_path})

    # Sanitize for ASCII-safe header (RFC 6266)
    ascii_name = export_filename.encode("ascii", "ignore").decode()
    ascii_name = re.sub(r"[^A-Za-z0-9._-]", "_", ascii_name)
    if not ascii_name or ascii_name.startswith("."):
        ascii_name = f"export.{formatter.file_extension}"

    return Response(
        content=content,
        media_type=formatter.content_type,
        headers={
            "Content-Disposition": (
                f'attachment; filename="{ascii_name}"; '
                f"filename*=UTF-8''{quote(export_filename)}"
            )
        },
    )


@legacy_router.post(
    "/export/batch",
    summary="Batch export transcriptions",
    response_class=StreamingResponse,
    responses=BATCH_EXPORT_RESPONSES,
    deprecated=True,
)
@router.post(
    "/export/batch",
    summary="Batch export transcriptions",
    response_class=StreamingResponse,
    responses=BATCH_EXPORT_RESPONSES,
)
async def batch_export(
    request: "BatchExportRequest",
) -> Response:
    """Export multiple transcriptions as a ZIP archive.

    Failed tasks are skipped and logged in _errors.txt within the archive.
    """
    import io
    import zipfile
    from datetime import datetime

    from nola.models.tasks import TaskStatus
    from nola.services.formatters import get_formatter
    from nola.services.formatters.base import SegmentData

    task_db = get_task_db()
    file_db = get_file_db()

    zip_buffer = io.BytesIO()
    errors: list[dict[str, str]] = []
    used_names: set[str] = set()
    success_count = 0

    formatter = get_formatter(
        request.format, include_timestamps=request.include_timestamps
    )

    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for task_id in request.task_ids:
            try:
                task = task_db.get_task(task_id)
                if not task:
                    errors.append({"task_id": task_id, "reason": "not_found"})
                    continue

                if task["status"] != TaskStatus.COMPLETED.value:
                    errors.append(
                        {
                            "task_id": task_id,
                            "reason": f"status_{task['status']}",
                        }
                    )
                    continue

                segments = task.get("segments") or []
                segment_data = [
                    SegmentData(start=s["start"], end=s["end"], text=s["text"])
                    for s in segments
                ]

                content = formatter.format(segment_data)

                file_info = file_db.get_file(task["file_id"])
                if file_info:
                    base_name = Path(file_info["filename"]).stem
                else:
                    base_name = task_id[:8]

                filename = f"{base_name}.{formatter.file_extension}"

                # Handle duplicate filenames
                if filename in used_names:
                    counter = 1
                    while (
                        f"{base_name}_{counter}.{formatter.file_extension}"
                        in used_names
                    ):
                        counter += 1
                    filename = f"{base_name}_{counter}.{formatter.file_extension}"

                used_names.add(filename)
                zf.writestr(filename, content)
                success_count += 1

            except Exception as e:
                logger.exception("Error exporting task %s", task_id)
                errors.append({"task_id": task_id, "reason": "error", "detail": str(e)})

        if errors:
            error_lines = [
                f"{e['task_id']}: {e['reason']}"
                + (f" - {e.get('detail', '')}" if e.get("detail") else "")
                for e in errors
            ]
            zf.writestr("_errors.txt", "\n".join(error_lines))

    if success_count == 0 and errors:
        raise HTTPException(
            status_code=400,
            detail=f"All {len(errors)} exports failed",
        )

    zip_buffer.seek(0)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    if request.zip_name:
        # Sanitize zip_name: remove header injection chars, path separators, quotes
        safe_name = re.sub(r'[\r\n/\\"]', "", request.zip_name).strip()
        zip_filename = f"{safe_name}.zip" if safe_name else f"export_{timestamp}.zip"
    else:
        zip_filename = f"export_{timestamp}.zip"

    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{zip_filename}"'},
    )
