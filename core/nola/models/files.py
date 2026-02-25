"""File management database operations."""

import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any, TypedDict


class FileRow(TypedDict):
    """Row from the files table."""

    id: str
    filename: str
    path: str
    size: int
    content_type: str | None
    created_at: str


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
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO files (id, filename, path, size, content_type, created_at)
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
            conn.commit()

    def get_file(self, file_id: str) -> FileRow | None:
        """Get file metadata by ID.

        Args:
            file_id: File identifier

        Returns:
            File dictionary or None if not found
        """
        with self._connect() as conn:
            cursor = conn.execute("SELECT * FROM files WHERE id = ?", (file_id,))
            row = cursor.fetchone()

            if row is None:
                return None

            return dict(row)

    def get_file_path(self, file_id: str) -> str | None:
        """Get file storage path for transcription.

        Args:
            file_id: File identifier

        Returns:
            File path or None if not found
        """
        file = self.get_file(file_id)
        return file["path"] if file else None

    def delete_file(self, file_id: str) -> bool:
        """Delete file metadata (not the actual file).

        Args:
            file_id: File identifier

        Returns:
            True if deleted, False if not found
        """
        with self._connect() as conn:
            cursor = conn.execute("DELETE FROM files WHERE id = ?", (file_id,))
            deleted = cursor.rowcount > 0
            conn.commit()

            return deleted

    def list_files(self, limit: int = 50, offset: int = 0) -> list[FileRow]:
        """List all files with pagination.

        Args:
            limit: Maximum number of results
            offset: Pagination offset

        Returns:
            List of file dictionaries
        """
        with self._connect() as conn:
            cursor = conn.execute(
                "SELECT * FROM files ORDER BY created_at DESC LIMIT ? OFFSET ?",
                (limit, offset),
            )
            return [dict(row) for row in cursor]

    def count_files(self) -> int:
        """Count total files."""
        with self._connect() as conn:
            cursor = conn.execute("SELECT COUNT(*) FROM files")
            return int(cursor.fetchone()[0])

    def check_integrity(self) -> dict[str, list[dict[str, Any]]]:
        """Check file-database consistency.

        Returns:
            Dict with 'missing_files' (DB records with no file on disk)
        """
        missing_files = []

        with self._connect() as conn:
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

    def cleanup_orphans(self) -> dict[str, Any]:
        """Remove database records for files that no longer exist on disk.

        Returns:
            Dict with deleted_count and deleted_files list
        """
        integrity = self.check_integrity()
        orphan_ids = [o["id"] for o in integrity["missing_files"]]

        if not orphan_ids:
            return {"deleted_count": 0, "deleted_files": []}

        with self._connect() as conn:
            placeholders = ",".join("?" * len(orphan_ids))
            conn.execute(f"DELETE FROM files WHERE id IN ({placeholders})", orphan_ids)
            conn.commit()

        return {
            "deleted_count": len(orphan_ids),
            "deleted_files": integrity["missing_files"],
        }
