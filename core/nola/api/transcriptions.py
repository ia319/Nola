"""Batch transcription API endpoints."""

import uuid
from pathlib import Path
from typing import Any, Literal

from fastapi import APIRouter, Body, HTTPException, Query

from nola.api.deps import get_file_db, get_task_db

router = APIRouter(prefix="/api/transcriptions", tags=["transcriptions"])

# Valid status values for filtering
StatusFilter = Literal["pending", "processing", "completed", "failed", "cancelled"]


@router.post("/", summary="Create transcription task")
async def create_transcription(
    file_id: str = Body(..., embed=True, description="File ID from upload API"),
) -> dict[str, Any]:
    """Create a transcription task for an uploaded file.

    Steps:
    1. Upload file via POST /api/files → get file_id
    2. Create task via this endpoint with file_id
    3. Worker will automatically process the task
    4. Query status via GET /api/transcriptions/{task_id}
    """
    file_db = get_file_db()
    task_db = get_task_db()

    file = file_db.get_file(file_id)
    if file is None:
        raise HTTPException(status_code=404, detail=f"File not found: {file_id}")

    task_id = str(uuid.uuid4())
    task_db.enqueue(task_id=task_id, file_id=file_id)

    return {
        "task_id": task_id,
        "file_id": file_id,
        "filename": file["filename"],
        "status": "pending",
    }


@router.post("/from-path", summary="Create task from server path")
async def create_transcription_from_path(
    file_path: str = Body(
        ..., embed=True, description="Absolute path to audio file on server"
    ),
) -> dict[str, Any]:
    """Create transcription task from a file path on the server.

    This is useful for:
    - Batch processing files already on the server
    - Automated pipelines (e.g., watched folder)
    - Development and testing

    Note: The file must exist on the server where the API is running.
    """
    path = Path(file_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"File not found: {file_path}")

    ext_to_mime = {
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
        ".flac": "audio/flac",
        ".m4a": "audio/mp4",
        ".ogg": "audio/ogg",
        ".wma": "audio/x-ms-wma",
    }
    content_type = ext_to_mime.get(path.suffix.lower(), "audio/mpeg")

    file_id = str(uuid.uuid4())
    task_id = str(uuid.uuid4())

    file_db = get_file_db()
    task_db = get_task_db()

    file_db.create_file(
        file_id=file_id,
        filename=path.name,
        path=str(path.absolute()),
        size=path.stat().st_size,
        content_type=content_type,
    )

    task_db.enqueue(task_id=task_id, file_id=file_id)

    return {
        "task_id": task_id,
        "file_id": file_id,
        "filename": path.name,
        "status": "pending",
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
    """Cancel a transcription task.

    Args:
        task_id: Task identifier

    Returns:
        Cancellation result
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
