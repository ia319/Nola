"""File-related Pydantic response schemas."""

from pydantic import BaseModel


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

    status: str
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
