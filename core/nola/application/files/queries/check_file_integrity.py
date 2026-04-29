"""Check-file-integrity use-case."""

from nola.application.files.contracts import SupportsFileQueries
from nola.application.files.payloads import build_integrity_check_payload
from nola.application.files.types import IntegrityCheckPayload


def check_file_integrity(
    *,
    file_store: SupportsFileQueries,
) -> IntegrityCheckPayload:
    """Check consistency between database records and files on disk."""
    return build_integrity_check_payload(file_store.check_integrity())
