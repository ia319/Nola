"""Declare file use-case contracts used by the application layer."""

from typing import Protocol

from nola.models.files import (
    FileCleanupResult,
    FileIntegrityResult,
    FileRow,
    FileSortField,
    FileSortOrder,
)


class SupportsFileUploadStream(Protocol):
    """Expose the async stream methods needed by upload use-cases."""

    async def read(self, size: int = -1) -> bytes:
        """Read bytes from the upload stream."""
        ...

    async def close(self) -> None:
        """Close the upload stream."""
        ...


class SupportsFileQueries(Protocol):
    """Expose file reads required by file use-cases."""

    def get_file(self, file_id: str) -> FileRow | None:
        """Return a file row by id."""
        ...

    def list_files(
        self,
        limit: int = 50,
        offset: int = 0,
        q: str | None = None,
        content_type: str | None = None,
        sort_by: FileSortField = "created_at",
        order: FileSortOrder = "desc",
    ) -> list[FileRow]:
        """Return paged file rows."""
        ...

    def count_files(
        self,
        q: str | None = None,
        content_type: str | None = None,
    ) -> int:
        """Return total file count for a filter."""
        ...

    def check_integrity(self) -> FileIntegrityResult:
        """Return missing file records."""
        ...


class SupportsFileMutations(Protocol):
    """Expose file writes required by file use-cases."""

    def create_file(
        self,
        file_id: str,
        filename: str,
        path: str,
        size: int,
        content_type: str = "audio/mpeg",
    ) -> None:
        """Save uploaded file metadata."""
        ...

    def cleanup_orphans(self) -> FileCleanupResult:
        """Remove orphaned file records."""
        ...


class SupportsFileActions(Protocol):
    """Expose file reads and writes required by file use-cases."""

    def get_file(self, file_id: str) -> FileRow | None:
        """Return a file row by id."""
        ...

    def count_linked_tasks(self, file_id: str) -> int:
        """Return how many task rows still reference one file."""
        ...

    def delete_file(self, file_id: str) -> bool:
        """Delete one file row."""
        ...
