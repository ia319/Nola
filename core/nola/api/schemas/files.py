"""File-related Pydantic response schemas."""

from typing import Literal

from pydantic import BaseModel, Field

from nola.application.files.types import FileDeleteErrorCode, FileIntegrityStatus
from nola.config.constants import MAX_BATCH_FILE_IDS


class FileResponse(BaseModel):
    """Single file metadata response."""

    file_id: str
    filename: str
    size: int
    content_type: str | None
    created_at: str


class FileDetailResponse(FileResponse):
    """File detail with path (for admin/debug)."""

    path: str


class FileListResponse(BaseModel):
    """Paginated file list response."""

    files: list[FileResponse]
    total: int
    limit: int
    offset: int


class FileUploadResponse(BaseModel):
    """File upload success response."""

    file_id: str
    filename: str
    size: int
    content_type: str | None


class MissingFileInfo(BaseModel):
    """Info about a file record missing from disk."""

    id: str
    filename: str
    path: str


class IntegrityCheckResponse(BaseModel):
    """File integrity check result."""

    status: FileIntegrityStatus
    missing_files: list[MissingFileInfo]
    missing_count: int


class CleanupResponse(BaseModel):
    """Orphan cleanup result."""

    message: str
    deleted_count: int
    deleted_files: list[MissingFileInfo]


class DeleteResponse(BaseModel):
    """Generic deletion confirmation."""

    message: str


class BatchFileDeleteRequest(BaseModel):
    """Batch delete request for file records."""

    file_ids: list[str] = Field(
        ...,
        min_length=1,
        max_length=MAX_BATCH_FILE_IDS,
        description="List of file IDs to delete",
    )


class BatchFileDeleteSummaryResponse(BaseModel):
    """Batch file deletion summary counts."""

    requested: int
    succeeded: int
    failed: int


class BatchFileDeleteResultResponse(BaseModel):
    """Per-file result for batch file deletion."""

    file_id: str
    ok: bool
    message: str
    error_code: FileDeleteErrorCode | None = None
    status_code: int | None = None
    filename: str | None = None


class BatchFileDeleteResponse(BaseModel):
    """Response for batch file deletion."""

    action: Literal["delete"]
    summary: BatchFileDeleteSummaryResponse
    results: list[BatchFileDeleteResultResponse]
