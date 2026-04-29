"""File management database operations."""

import sqlite3
from contextlib import closing
from datetime import datetime
from pathlib import Path
from typing import Literal, TypedDict, cast

from nola.models.query_helpers import build_contains_like_pattern

FileSortField = Literal["filename", "size", "content_type", "created_at"]
FileSortOrder = Literal["asc", "desc"]

DEFAULT_FILE_SORT_BY: FileSortField = "created_at"
DEFAULT_FILE_SORT_ORDER: FileSortOrder = "desc"
FILE_SORT_COLUMNS: dict[FileSortField, str] = {
    "filename": "LOWER(filename)",
    "size": "size",
    "content_type": "LOWER(COALESCE(content_type, ''))",
    "created_at": "created_at",
}


class FileRow(TypedDict):
    """Row from the files table."""

    id: str
    filename: str
    path: str
    size: int
    content_type: str | None
    created_at: str


class MissingFileRow(TypedDict):
    """File row that points to a missing path."""

    id: str
    filename: str
    path: str


class FileIntegrityResult(TypedDict):
    """Result from checking file metadata against the filesystem."""

    missing_files: list[MissingFileRow]


class FileCleanupResult(TypedDict):
    """Result from deleting missing file metadata."""

    deleted_count: int
    deleted_files: list[MissingFileRow]


class FileDatabase:
    """Manage uploaded file metadata in SQLite."""

    def __init__(self, db_path: str | Path = "data/nola.db") -> None:
        """Initialize file database.

        Args:
            db_path: Path to SQLite database file
        """
        self.db_path = Path(db_path)

    def _connect(self) -> sqlite3.Connection:
        """Create connection with consistent settings."""
        conn = sqlite3.connect(self.db_path)
        conn.execute("PRAGMA foreign_keys = ON")
        conn.row_factory = sqlite3.Row
        return conn

    def create_file(
        self,
        file_id: str,
        filename: str,
        path: str,
        size: int,
        content_type: str = "audio/mpeg",
    ) -> None:
        """Save uploaded file metadata.

        Args:
            file_id: Unique file identifier
            filename: Original filename
            path: Storage path
            size: File size in bytes
            content_type: MIME type
        """
        with closing(self._connect()) as conn:
            with conn:
                conn.execute(
                    """
                    INSERT INTO files (
                        id, filename, path, size, content_type, created_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        file_id,
                        filename,
                        path,
                        size,
                        content_type,
                        datetime.now().isoformat(),
                    ),
                )

    def get_file(self, file_id: str) -> FileRow | None:
        """Get file metadata by ID.

        Args:
            file_id: File identifier

        Returns:
            File dictionary or None if not found
        """
        with closing(self._connect()) as conn:
            cursor = conn.execute("SELECT * FROM files WHERE id = ?", (file_id,))
            row = cursor.fetchone()

            if row is None:
                return None

            return cast(FileRow, dict(row))

    def get_file_path(self, file_id: str) -> str | None:
        """Get file storage path for transcription.

        Args:
            file_id: File identifier

        Returns:
            File path or None if not found
        """
        file = self.get_file(file_id)
        return file["path"] if file else None

    def count_linked_tasks(self, file_id: str) -> int:
        """Return how many transcription tasks still reference one file."""
        with closing(self._connect()) as conn:
            cursor = conn.execute(
                "SELECT COUNT(*) FROM transcription_tasks WHERE file_id = ?",
                (file_id,),
            )
            return int(cursor.fetchone()[0])

    def delete_file(self, file_id: str) -> bool:
        """Delete file metadata (not the actual file).

        Args:
            file_id: File identifier

        Returns:
            True if deleted, False if not found
        """
        with closing(self._connect()) as conn:
            with conn:
                cursor = conn.execute("DELETE FROM files WHERE id = ?", (file_id,))
                deleted = cursor.rowcount > 0

                return deleted

    def _build_file_filter_sql(
        self,
        *,
        q: str | None,
        content_type: str | None,
    ) -> tuple[str, list[str]]:
        """Build safe file list filters."""
        where_clauses: list[str] = []
        params: list[str] = []

        if q:
            pattern = build_contains_like_pattern(q)
            where_clauses.append(
                "("
                "LOWER(id) LIKE ? ESCAPE '\\' OR "
                "LOWER(filename) LIKE ? ESCAPE '\\' OR "
                "LOWER(COALESCE(content_type, '')) LIKE ? ESCAPE '\\'"
                ")"
            )
            params.extend([pattern, pattern, pattern])

        if content_type:
            where_clauses.append("LOWER(content_type) = LOWER(?)")
            params.append(content_type)

        where_sql = f" WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
        return where_sql, params

    def list_files(
        self,
        limit: int = 50,
        offset: int = 0,
        q: str | None = None,
        content_type: str | None = None,
        sort_by: FileSortField = DEFAULT_FILE_SORT_BY,
        order: FileSortOrder = DEFAULT_FILE_SORT_ORDER,
    ) -> list[FileRow]:
        """List all files with pagination.

        Args:
            limit: Maximum number of results
            offset: Pagination offset
            q: Optional file id, filename, or content-type keyword
            content_type: Optional exact MIME type filter
            sort_by: Sort field
            order: Sort order

        Returns:
            List of file dictionaries
        """
        sort_column = FILE_SORT_COLUMNS[sort_by]
        sort_order = "ASC" if order == "asc" else "DESC"
        where_sql, filter_params = self._build_file_filter_sql(
            q=q,
            content_type=content_type,
        )
        params: list[str | int] = [*filter_params, limit, offset]
        with closing(self._connect()) as conn:
            cursor = conn.execute(
                "SELECT * FROM files "
                f"{where_sql} "
                f"ORDER BY {sort_column} {sort_order}, id DESC "
                "LIMIT ? OFFSET ?",
                tuple(params),
            )
            return [cast(FileRow, dict(row)) for row in cursor]

    def count_files(
        self,
        q: str | None = None,
        content_type: str | None = None,
    ) -> int:
        """Count total files."""
        where_sql, params = self._build_file_filter_sql(
            q=q,
            content_type=content_type,
        )
        with closing(self._connect()) as conn:
            cursor = conn.execute(f"SELECT COUNT(*) FROM files{where_sql}", params)
            return int(cursor.fetchone()[0])

    def check_integrity(self) -> FileIntegrityResult:
        """Check file-database consistency.

        Returns:
            Dict with 'missing_files' (DB records with no file on disk)
        """
        missing_files: list[MissingFileRow] = []

        with closing(self._connect()) as conn:
            cursor = conn.execute("SELECT * FROM files")

            for row in cursor:
                file_dict = dict(row)
                file_path = Path(file_dict["path"])
                if not file_path.exists():
                    missing_files.append(
                        {
                            "id": file_dict["id"],
                            "filename": file_dict["filename"],
                            "path": file_dict["path"],
                        }
                    )

        return {"missing_files": missing_files}

    def cleanup_orphans(self) -> FileCleanupResult:
        """Remove database records for files that no longer exist on disk.

        Returns:
            Dict with deleted_count and deleted_files list
        """
        integrity = self.check_integrity()
        orphan_ids = [o["id"] for o in integrity["missing_files"]]

        if not orphan_ids:
            return {"deleted_count": 0, "deleted_files": []}

        with closing(self._connect()) as conn:
            with conn:
                placeholders = ",".join("?" * len(orphan_ids))
                conn.execute(
                    f"DELETE FROM files WHERE id IN ({placeholders})", orphan_ids
                )

        return {
            "deleted_count": len(orphan_ids),
            "deleted_files": integrity["missing_files"],
        }
