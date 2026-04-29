"""Build stable payloads shared by file use-cases."""

from nola.application.files.types import (
    BatchFileDeletePayload,
    BatchFileDeleteResultPayload,
    CleanupPayload,
    FileListPayload,
    FilePayload,
    IntegrityCheckPayload,
    MissingFilePayload,
)
from nola.models.files import FileCleanupResult, FileIntegrityResult, FileRow


def _string_or_empty(value: object) -> str:
    """Return an empty string for missing payload values."""
    return "" if value is None else str(value)


def to_file_payload(file: FileRow) -> FilePayload:
    """Build uploaded-file payload from one database row."""
    return {
        "file_id": file["id"],
        "filename": file["filename"],
        "size": file["size"],
        "content_type": file["content_type"],
        "created_at": file["created_at"],
    }


def build_file_list_payload(
    *,
    files: list[FileRow],
    total: int,
    limit: int,
    offset: int,
) -> FileListPayload:
    """Build paged uploaded-file list payload."""
    return {
        "files": [to_file_payload(file) for file in files],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


def normalize_missing_files(raw_missing_files: object) -> list[MissingFilePayload]:
    """Return missing-file payloads from database integrity output."""
    if not isinstance(raw_missing_files, list):
        return []

    missing_files: list[MissingFilePayload] = []
    for raw_file in raw_missing_files:
        if not isinstance(raw_file, dict):
            continue
        missing_files.append(
            {
                "id": _string_or_empty(raw_file.get("id")),
                "filename": _string_or_empty(raw_file.get("filename")),
                "path": _string_or_empty(raw_file.get("path")),
            }
        )
    return missing_files


def build_integrity_check_payload(
    raw_result: FileIntegrityResult,
) -> IntegrityCheckPayload:
    """Build file integrity check payload from database output."""
    missing_files = normalize_missing_files(raw_result.get("missing_files"))
    return {
        "status": "ok" if not missing_files else "inconsistent",
        "missing_files": missing_files,
        "missing_count": len(missing_files),
    }


def build_cleanup_payload(raw_result: FileCleanupResult) -> CleanupPayload:
    """Build orphan cleanup payload from database output."""
    deleted_count = int(raw_result.get("deleted_count", 0))
    return {
        "message": f"Cleaned up {deleted_count} orphan record(s)",
        "deleted_count": deleted_count,
        "deleted_files": normalize_missing_files(raw_result.get("deleted_files")),
    }


def build_batch_file_delete_response(
    results: list[BatchFileDeleteResultPayload],
) -> BatchFileDeletePayload:
    """Build a stable batch file-delete response with summary counts."""
    succeeded = sum(1 for item in results if item["ok"])
    failed = len(results) - succeeded
    return {
        "action": "delete",
        "summary": {
            "requested": len(results),
            "succeeded": succeeded,
            "failed": failed,
        },
        "results": results,
    }
