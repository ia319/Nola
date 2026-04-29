"""Get-uploaded-file use-case."""

from nola.application.files.contracts import SupportsFileQueries
from nola.application.files.errors import FileUseCaseError
from nola.application.files.payloads import to_file_payload
from nola.application.files.types import FilePayload


def get_uploaded_file(
    *,
    file_store: SupportsFileQueries,
    file_id: str,
) -> FilePayload:
    """Return one uploaded-file metadata payload."""
    file = file_store.get_file(file_id)
    if file is None:
        raise FileUseCaseError(
            status_code=404,
            detail="File not found",
            error_code="not_found",
        )

    return to_file_payload(file)
