"""File management database operations."""

import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any


class FileDatabase:
    """Manage uploaded file metadata in SQLite."""

    def __init__(self, db_path: str | Path = "data/nola.db") -> None:
        """Initialize file database.

        Args:
            db_path: Path to SQLite database file
        """
        self.db_path = Path(db_path)

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
        with sqlite3.connect(self.db_path) as conn:
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

    def get_file(self, file_id: str) -> dict[str, Any] | None:
        """Get file metadata by ID.

        Args:
            file_id: File identifier

        Returns:
            File dictionary or None if not found
        """
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
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
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute("DELETE FROM files WHERE id = ?", (file_id,))
            deleted = cursor.rowcount > 0
            conn.commit()

            return deleted
