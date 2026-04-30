"""Shared payload and value types for file use-cases."""

from typing import Literal, TypedDict

FileDeleteErrorCode = Literal["not_found", "linked_tasks", "duplicate_file_id"]
FileIntegrityStatus = Literal["ok", "inconsistent"]
FileUseCaseErrorCode = Literal[
    "not_found",
    "linked_tasks",
    "duplicate_file_id",
    "invalid_filename",
    "unsupported_file_format",
    "unsupported_content_type",
    "file_too_large",
]


class FilePayload(TypedDict):
    """Uploaded file metadata payload."""

    file_id: str
    filename: str
    size: int
    content_type: str | None
    created_at: str


class FileListPayload(TypedDict):
    """Paged uploaded-file list payload."""

    files: list[FilePayload]
    total: int
    limit: int
    offset: int


class FileUploadPayload(TypedDict):
    """Uploaded-file creation payload."""

    file_id: str
    filename: str
    size: int
    content_type: str | None


class MissingFilePayload(TypedDict):
    """Info about a file record missing from disk."""

    id: str
    filename: str
    path: str


class IntegrityCheckPayload(TypedDict):
    """File integrity check result payload."""

    status: FileIntegrityStatus
    missing_files: list[MissingFilePayload]
    missing_count: int


class CleanupPayload(TypedDict):
    """Orphan cleanup result payload."""

    message: str
    deleted_count: int
    deleted_files: list[MissingFilePayload]


class DeleteUploadedFilePayload(TypedDict):
    """Deleted uploaded-file payload."""

    file_id: str
    message: str
    filename: str | None


class BatchFileDeleteSummaryPayload(TypedDict):
    """Batch file deletion summary counts."""

    requested: int
    succeeded: int
    failed: int


class BatchFileDeleteResultPayloadBase(TypedDict):
    """Mandatory fields in per-file batch delete result."""

    file_id: str
    ok: bool
    message: str


class BatchFileDeleteResultPayload(BatchFileDeleteResultPayloadBase, total=False):
    """Optional fields in per-file batch delete result."""

    error_code: FileDeleteErrorCode
    status_code: int
    filename: str | None


class BatchFileDeletePayload(TypedDict):
    """Batch file deletion response payload."""

    action: Literal["delete"]
    summary: BatchFileDeleteSummaryPayload
    results: list[BatchFileDeleteResultPayload]
