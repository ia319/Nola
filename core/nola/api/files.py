"""File management API endpoints."""

import uuid
from pathlib import Path
from typing import Any

from fastapi import APIRouter, File, HTTPException, UploadFile

from nola.api.deps import get_file_db
from nola.core.constants import (
    ALLOWED_AUDIO_TYPES,
    ALLOWED_EXTENSIONS,
    MAX_FILE_SIZE,
    UPLOAD_DIR,
)

router = APIRouter(prefix="/api/files", tags=["files"])


@router.post("/", summary="Upload audio file")
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

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    file_path = UPLOAD_DIR / f"{file_id}{file_ext}"

    file_size = 0
    with open(file_path, "wb") as f:
        while chunk := file.file.read(1024 * 1024):  # 1 MB chunks
            file_size += len(chunk)
            if file_size > MAX_FILE_SIZE:
                f.close()
                file_path.unlink()  # Clean up partial file
                raise HTTPException(
                    status_code=413,
                    detail=(
                        "File too large. Maximum size: "
                        f"{MAX_FILE_SIZE // (1024 * 1024)} MB"
                    ),
                )
            f.write(chunk)

    file_db = get_file_db()
    try:
        file_db.create_file(
            file_id=file_id,
            filename=file.filename,
            path=str(file_path),
            size=file_size,
            content_type=file.content_type or "audio/mpeg",
        )
    except Exception:
        file_path.unlink(missing_ok=True)
        raise

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

    file = file_db.get_file(file_id)
    if file is None:
        raise HTTPException(status_code=404, detail="File not found")

    file_path = Path(file["path"])

    # DB first: orphan file is safer than orphan DB record
    file_db.delete_file(file_id)
    file_path.unlink(missing_ok=True)

    return {"message": f"File {file_id} deleted"}
