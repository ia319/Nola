"""List-uploaded-files use-case."""

from nola.application.files.contracts import SupportsFileQueries
from nola.application.files.payloads import build_file_list_payload
from nola.application.files.types import FileListPayload
from nola.models.files import FileSortField, FileSortOrder


def list_uploaded_files(
    *,
    file_store: SupportsFileQueries,
    limit: int,
    offset: int,
    q: str | None,
    content_type: str | None,
    sort_by: FileSortField,
    order: FileSortOrder,
) -> FileListPayload:
    """Return paged uploaded-file list for API responses."""
    files = file_store.list_files(
        limit=limit,
        offset=offset,
        q=q,
        content_type=content_type,
        sort_by=sort_by,
        order=order,
    )
    total = file_store.count_files(q=q, content_type=content_type)
    return build_file_list_payload(
        files=files,
        total=total,
        limit=limit,
        offset=offset,
    )
