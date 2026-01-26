"""File management API endpoints."""

import shutil
import uuid
from pathlib import Path
from typing import Any

from fastapi import APIRouter, File, HTTPException, UploadFile

from nola.api.deps import get_file_db

router = APIRouter(prefix="/api/files", tags=["files"])

# Upload directory
UPLOAD_DIR = Path("data/uploads")


@router.post("/", summary="Upload audio file")
async def upload_file(
    file: UploadFile = File(..., description="Audio file to upload"),
) -> dict[str, Any]:
    """Upload an audio file for later transcription.

    The file is saved to the server and a file_id is returned.
    Use this file_id to create transcription tasks.

    Supported formats: mp3, wav, flac, m4a, ogg, etc.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    # Generate file ID
    file_id = str(uuid.uuid4())

    # Save file
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    file_ext = Path(file.filename).suffix.lower()
    file_path = UPLOAD_DIR / f"{file_id}{file_ext}"

    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    file_size = file_path.stat().st_size

    # Create database record
    file_db = get_file_db()
    file_db.create_file(
        file_id=file_id,
        filename=file.filename,
        path=str(file_path),
        size=file_size,
        content_type=file.content_type or "audio/mpeg",
    )

    return {
        "file_id": file_id,
        "filename": file.filename,
        "size": file_size,
        "content_type": file.content_type,
    }


@router.get("/{file_id}")
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
        "path": file["path"],
        "size": file["size"],
        "content_type": file["content_type"],
        "created_at": file["created_at"],
    }


@router.delete("/{file_id}")
async def delete_file(file_id: str) -> dict[str, str]:
    """Delete file and associated data.

    Args:
        file_id: File identifier

    Returns:
        Deletion confirmation
    """
    file_db = get_file_db()

    # Get file info first
    file = file_db.get_file(file_id)
    if file is None:
        raise HTTPException(status_code=404, detail="File not found")

    # Delete physical file if exists
    file_path = Path(file["path"])
    if file_path.exists():
        file_path.unlink()

    # Delete from database
    file_db.delete_file(file_id)

    return {"message": f"File {file_id} deleted"}
