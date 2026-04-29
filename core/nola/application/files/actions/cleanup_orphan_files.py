"""Cleanup-orphan-files use-case."""

from nola.application.files.contracts import SupportsFileMutations
from nola.application.files.payloads import build_cleanup_payload
from nola.application.files.types import CleanupPayload


def cleanup_orphan_files(
    *,
    file_store: SupportsFileMutations,
) -> CleanupPayload:
    """Remove database records for files that no longer exist on disk."""
    return build_cleanup_payload(file_store.cleanup_orphans())
