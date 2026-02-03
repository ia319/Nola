"""Transcription API endpoints."""

import logging
import uuid
from dataclasses import asdict
from pathlib import Path
from typing import Any, Literal
from urllib.parse import quote

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse, Response

from nola.api.deps import get_file_db, get_task_db
from nola.api.schemas import TranscriptionRequest
from nola.engines.base import TranscribeOptions

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/transcriptions", tags=["transcriptions"])

# Valid status values for filtering
StatusFilter = Literal["pending", "processing", "completed", "failed", "cancelled"]


@router.get("/options/defaults", summary="Get default transcription options")
async def get_default_options() -> dict[str, Any]:
    """Return default transcription options.

    Use this endpoint to display available options and their defaults
    in the frontend before creating a transcription task.
    """
    defaults = TranscribeOptions()
    return asdict(defaults)


@router.post("/", summary="Create transcription task")
async def create_transcription(request: TranscriptionRequest) -> dict[str, Any]:
    """Create a transcription task for an uploaded file.

    Steps:
    1. Upload file via POST /api/files → get file_id
    2. Create task via this endpoint with file_id and optional parameters
    3. Worker will automatically process the task
    4. Query status via GET /api/transcriptions/{task_id}

    All transcription parameters are optional. If not provided,
    engine defaults will be used. See GET /options/defaults for defaults.
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


@router.get("/")
async def list_transcriptions(
    status: StatusFilter | None = Query(None, description="Filter by status"),
    limit: int = Query(50, ge=1, le=100, description="Max results"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
) -> dict[str, Any]:
    """List all transcription tasks.

    Args:
        status: Optional status filter (pending, processing, completed, failed)
        limit: Maximum number of results
        offset: Pagination offset

    Returns:
        List of tasks with pagination info
    """
    task_db = get_task_db()

    tasks = task_db.list_tasks(status=status, limit=limit, offset=offset)
    total = task_db.count_tasks(status=status)

    return {
        "tasks": [
            {
                "task_id": t["id"],
                "file_id": t["file_id"],
                "status": t["status"],
                "progress": t["progress"],
                "created_at": t["created_at"],
                "completed_at": t["completed_at"],
            }
            for t in tasks
        ],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/{task_id}")
async def get_transcription(task_id: str) -> dict[str, Any]:
    """Get transcription task status and result.

    Args:
        task_id: Task identifier

    Returns:
        Task status and result
    """
    task_db = get_task_db()
    task = task_db.get_task(task_id)

    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")

    return {
        "task_id": task["id"],
        "file_id": task["file_id"],
        "status": task["status"],
        "progress": task["progress"],
        "duration": task["duration"],
        "segments": task["segments"],
        "error": task["error"],
        "created_at": task["created_at"],
        "completed_at": task["completed_at"],
    }


@router.delete("/{task_id}")
async def cancel_transcription(task_id: str) -> dict[str, Any]:
    """
    Cancel a transcription task identified by `task_id`.
    
    Raises an HTTP 404 if the task does not exist, or HTTP 400 if the task cannot be cancelled due to its current status.
    
    Parameters:
    	task_id (str): Identifier of the transcription task to cancel.
    
    Returns:
    	result (dict[str, Any]): Confirmation object containing `task_id`, `status` set to `"cancelled"`, and a human-readable `message`.
    
    Raises:
    	HTTPException: 404 if task not found; 400 if task exists but is not cancellable.
    """
    task_db = get_task_db()

    # Attempt to cancel - returns False if not found or not cancellable
    cancelled = task_db.cancel(task_id)

    if not cancelled:
        # Check if task exists to provide appropriate error
        task = task_db.get_task(task_id)
        if task is None:
            raise HTTPException(status_code=404, detail="Task not found")
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel task with status: {task['status']}",
        )

    return {
        "task_id": task_id,
        "status": "cancelled",
        "message": "Task cancelled successfully",
    }


ExportFormat = Literal["srt", "vtt", "txt", "ass"]


@router.get("/{task_id}/export", summary="Export transcription result")
async def export_transcription(
    task_id: str,
    format: ExportFormat = Query("srt", description="Output format"),
    include_timestamps: bool = Query(True, description="Include timestamps (TXT only)"),
    save: bool = Query(False, description="Save to server instead of download"),
) -> Response:
    """
    Export a completed transcription as a subtitle file in the requested format.
    
    Valid formats: "srt", "vtt", "txt", "ass". If save is True the export is written to the server exports directory and a JSON response with the saved path is returned; otherwise the formatted content is returned as a downloadable file with a Content-Disposition header.
    
    Parameters:
        task_id (str): Identifier of the transcription task to export.
        format (str): Output format for the export (one of "srt", "vtt", "txt", "ass").
        include_timestamps (bool): When True, include timestamps in formats that support them (affects TXT output).
        save (bool): When True, write the exported file to the server exports directory and return its relative path; when False, return the file as a download.
    
    Returns:
        Response: If save is True, a JSON response containing {"saved_path": "<relative/path>"}; otherwise an HTTP response with the file content, appropriate media type, and Content-Disposition headers for download.
    
    Raises:
        HTTPException(404): If the task does not exist.
        HTTPException(400): If the task is not completed or has no segments to export.
        HTTPException(500): If segment data is malformed and prevents building a valid export.
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

    # RFC 6266: filename must be ASCII-safe for legacy clients
    ascii_name = export_filename.encode("ascii", "ignore").decode()
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