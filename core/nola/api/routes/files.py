"""File management API endpoints."""

from typing import NoReturn

from fastapi import APIRouter, File, HTTPException, Query, UploadFile

from nola.api.deps import get_file_db
from nola.api.schemas import (
    BatchFileDeleteRequest,
    BatchFileDeleteResponse,
    CleanupResponse,
    DeleteResponse,
    FileListResponse,
    FileResponse,
    FileUploadResponse,
    IntegrityCheckResponse,
)
from nola.application.files import (
    batch_delete_uploaded_files,
    check_file_integrity,
    cleanup_orphan_files,
    delete_uploaded_file,
    get_uploaded_file,
    list_uploaded_files,
    upload_uploaded_file,
)
from nola.application.files.errors import FileUseCaseError
from nola.application.files.types import (
    BatchFileDeletePayload,
    CleanupPayload,
    FileListPayload,
    FilePayload,
    FileUploadPayload,
    IntegrityCheckPayload,
)
from nola.config import ALLOWED_AUDIO_TYPES, ALLOWED_EXTENSIONS, settings
from nola.models.files import (
    DEFAULT_FILE_SORT_BY,
    DEFAULT_FILE_SORT_ORDER,
    FileSortField,
    FileSortOrder,
)
from nola.utils import infer_content_type

router = APIRouter(prefix="/api/files", tags=["files"])


def _raise_file_http_error(error: FileUseCaseError) -> NoReturn:
    """Raise an HTTPException from a file use-case error."""
    raise HTTPException(status_code=error.status_code, detail=error.detail) from error


@router.get("/", summary="List all uploaded files", response_model=FileListResponse)
async def list_files(
    limit: int = Query(50, ge=1, le=100, description="Max results"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    q: str | None = Query(
        None,
        description="Search keyword for file id, filename, or content type",
    ),
    content_type: str | None = Query(None, description="Filter by content type"),
    sort_by: FileSortField = Query(DEFAULT_FILE_SORT_BY, description="Sort field"),
    order: FileSortOrder = Query(DEFAULT_FILE_SORT_ORDER, description="Sort order"),
) -> FileListPayload:
    """List all uploaded files with pagination."""
    return list_uploaded_files(
        file_store=get_file_db(),
        limit=limit,
        offset=offset,
        q=q,
        content_type=content_type,
        sort_by=sort_by,
        order=order,
    )


@router.post(
    "/batch/delete",
    summary="Batch delete uploaded files",
    response_model=BatchFileDeleteResponse,
)
async def batch_delete_files(
    request: BatchFileDeleteRequest,
) -> BatchFileDeletePayload:
    """Delete multiple files and return per-file outcomes."""
    return batch_delete_uploaded_files(
        file_store=get_file_db(),
        file_ids=request.file_ids,
    )


@router.get(
    "/check-integrity",
    summary="Check database-file consistency",
    response_model=IntegrityCheckResponse,
)
async def check_integrity() -> IntegrityCheckPayload:
    """Check consistency between database records and files on disk.

    Returns a list of 'missing_files' - database records that reference
    files which no longer exist on disk. This can happen if files are
    manually deleted from the uploads directory.
    """
    return check_file_integrity(file_store=get_file_db())


@router.post(
    "/cleanup", summary="Remove orphan database records", response_model=CleanupResponse
)
async def cleanup_orphans() -> CleanupPayload:
    """Remove database records for files that no longer exist on disk.

    This is useful after manually deleting files from the uploads directory.
    Use GET /check-integrity first to see what will be cleaned up.
    """
    return cleanup_orphan_files(file_store=get_file_db())


@router.post("/", summary="Upload an audio file", response_model=FileUploadResponse)
async def upload_file(
    file: UploadFile = File(..., description="Audio file to upload"),
) -> FileUploadPayload:
    """Upload an audio file for later transcription.

    The file is saved to the server and a file_id is returned.
    Use this file_id to create transcription tasks.

    Supported formats: mp3, wav, flac, m4a, ogg, webm, aac
    Max file size: 500 MB
    """
    try:
        return await upload_uploaded_file(
            file_store=get_file_db(),
            stream=file,
            filename=file.filename,
            content_type=file.content_type,
            upload_dir=settings.upload_dir,
            max_file_size=settings.max_file_size,
            allowed_extensions=ALLOWED_EXTENSIONS,
            allowed_content_types=ALLOWED_AUDIO_TYPES,
            infer_content_type=infer_content_type,
        )
    except FileUseCaseError as error:
        _raise_file_http_error(error)


@router.get("/{file_id}", summary="Get file metadata", response_model=FileResponse)
async def get_file(file_id: str) -> FilePayload:
    """Get file metadata.

    Args:
        file_id: File identifier

    Returns:
        File metadata
    """
    try:
        return get_uploaded_file(file_store=get_file_db(), file_id=file_id)
    except FileUseCaseError as error:
        _raise_file_http_error(error)


@router.delete("/{file_id}", summary="Delete a file", response_model=DeleteResponse)
async def delete_file(file_id: str) -> dict[str, str]:
    """Delete file metadata when no task records still reference it.

    Args:
        file_id: File identifier

    Returns:
        Deletion confirmation
    """
    try:
        payload = delete_uploaded_file(file_store=get_file_db(), file_id=file_id)
    except FileUseCaseError as error:
        _raise_file_http_error(error)
    return {"message": payload["message"]}
