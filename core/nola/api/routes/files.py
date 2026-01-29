"""File management API endpoints."""

import uuid
from pathlib import Path
from typing import Any

from fastapi import APIRouter, File, HTTPException, Query, UploadFile

from nola.api.deps import get_file_db
from nola.config import ALLOWED_AUDIO_TYPES, ALLOWED_EXTENSIONS, settings
from nola.utils import infer_content_type

router = APIRouter(prefix="/api/files", tags=["files"])


@router.get("/", summary="List all uploaded files")
async def list_files(
    limit: int = Query(50, ge=1, le=100, description="Max results"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
) -> dict[str, Any]:
    """List all uploaded files with pagination."""
    file_db = get_file_db()

    files = file_db.list_files(limit=limit, offset=offset)
    total = file_db.count_files()

    return {
        "files": [
            {
                "file_id": f["id"],
                "filename": f["filename"],
                "size": f["size"],
                "content_type": f["content_type"],
                "created_at": f["created_at"],
            }
            for f in files
        ],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/check-integrity", summary="Check database-file consistency")
async def check_integrity() -> dict[str, Any]:
    """Check consistency between database records and files on disk.

    Returns a list of 'missing_files' - database records that reference
    files which no longer exist on disk. This can happen if files are
    manually deleted from the uploads directory.
    """
    file_db = get_file_db()
    result = file_db.check_integrity()

    return {
        "status": "ok" if not result["missing_files"] else "inconsistent",
        "missing_files": result["missing_files"],
        "missing_count": len(result["missing_files"]),
    }


@router.post("/cleanup", summary="Remove orphan database records")
async def cleanup_orphans() -> dict[str, Any]:
    """Remove database records for files that no longer exist on disk.

    This is useful after manually deleting files from the uploads directory.
    Use GET /check-integrity first to see what will be cleaned up.
    """
    file_db = get_file_db()
    result = file_db.cleanup_orphans()

    return {
        "message": f"Cleaned up {result['deleted_count']} orphan record(s)",
        "deleted_count": result["deleted_count"],
        "deleted_files": result["deleted_files"],
    }


@router.post("/", summary="Upload an audio file")
async def upload_file(
    file: UploadFile = File(..., description="Audio file to upload"),
) -> dict[str, Any]:
    """Upload an audio file for later transcription.

    The file is saved to the server and a file_id is returned.
    Use this file_id to create transcription tasks.

    Supported formats: mp3, wav, flac, m4a, ogg, webm, aac
    Max file size: 500 MB
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format: {file_ext}. "
            f"Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )

    if file.content_type and file.content_type not in ALLOWED_AUDIO_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported content type: {file.content_type}",
        )

    file_id = str(uuid.uuid4())

    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    file_path = settings.upload_dir / f"{file_id}{file_ext}"

    file_size = 0
    try:
        with open(file_path, "wb") as f:
            while True:
                chunk = await file.read(1024 * 1024)  # 1 MB chunks, async
                if not chunk:
                    break
                file_size += len(chunk)
                if file_size > settings.max_file_size:
                    raise HTTPException(
                        status_code=413,
                        detail=(
                            "File too large. Maximum size: "
                            f"{settings.max_file_size // (1024 * 1024)} MB"
                        ),
                    )
                f.write(chunk)
    except HTTPException:
        file_path.unlink(missing_ok=True)
        raise
    finally:
        await file.close()

    file_db = get_file_db()
    try:
        file_db.create_file(
            file_id=file_id,
            filename=file.filename,
            path=str(file_path),
            size=file_size,
            content_type=file.content_type or infer_content_type(file.filename),
        )
    except Exception:
        file_path.unlink(missing_ok=True)
        raise

    return {
        "file_id": file_id,
        "filename": file.filename,
        "size": file_size,
        "content_type": file.content_type or infer_content_type(file.filename),
    }


@router.get("/{file_id}", summary="Get file metadata")
async def get_file(file_id: str) -> dict[str, Any]:
    """Get file metadata.

    Args:
        file_id: File identifier

    Returns:
        File metadata
    """
    file_db = get_file_db()
    file = file_db.get_file(file_id)

    if file is None:
        raise HTTPException(status_code=404, detail="File not found")

    return {
        "file_id": file["id"],
        "filename": file["filename"],
        "size": file["size"],
        "content_type": file["content_type"],
        "created_at": file["created_at"],
    }


@router.delete("/{file_id}", summary="Delete a file")
async def delete_file(file_id: str) -> dict[str, str]:
    """Delete file and associated data.

    Args:
        file_id: File identifier

    Returns:
        Deletion confirmation
    """
    file_db = get_file_db()

    file = file_db.get_file(file_id)
    if file is None:
        raise HTTPException(status_code=404, detail="File not found")

    file_path = Path(file["path"])

    # DB first: orphan file is safer than orphan DB record
    file_db.delete_file(file_id)
    file_path.unlink(missing_ok=True)

    return {"message": f"File {file_id} deleted"}
