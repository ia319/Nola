"""Batch delete-uploaded-files use-case."""

from typing import cast

from nola.application.files.actions.delete_uploaded_file import delete_uploaded_file
from nola.application.files.contracts import SupportsFileActions
from nola.application.files.errors import FileUseCaseError
from nola.application.files.payloads import build_batch_file_delete_response
from nola.application.files.types import (
    BatchFileDeletePayload,
    BatchFileDeleteResultPayload,
    FileDeleteErrorCode,
)


def _duplicate_file_id_result(file_id: str) -> BatchFileDeleteResultPayload:
    """Build duplicate-id error payload."""
    return {
        "file_id": file_id,
        "ok": False,
        "message": "Duplicate file_id in request",
        "error_code": "duplicate_file_id",
        "status_code": 400,
    }


def _file_use_case_error_result(
    file_id: str,
    error: FileUseCaseError,
) -> BatchFileDeleteResultPayload:
    """Build one failed batch-delete result from a use-case error."""
    return {
        "file_id": file_id,
        "ok": False,
        "message": error.detail,
        "error_code": cast(FileDeleteErrorCode, error.error_code),
        "status_code": error.status_code,
    }


def batch_delete_uploaded_files(
    *,
    file_store: SupportsFileActions,
    file_ids: list[str],
) -> BatchFileDeletePayload:
    """Delete multiple uploaded files and return per-file outcomes."""
    seen_file_ids: set[str] = set()
    results: list[BatchFileDeleteResultPayload] = []

    for file_id in file_ids:
        if file_id in seen_file_ids:
            results.append(_duplicate_file_id_result(file_id))
            continue
        seen_file_ids.add(file_id)

        try:
            deleted_file = delete_uploaded_file(file_store=file_store, file_id=file_id)
        except FileUseCaseError as error:
            results.append(_file_use_case_error_result(file_id, error))
            continue

        results.append(
            {
                "file_id": deleted_file["file_id"],
                "ok": True,
                "message": deleted_file["message"],
                "filename": deleted_file["filename"],
            }
        )

    return build_batch_file_delete_response(results)
