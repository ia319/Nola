"""Application configuration key-value store backed by SQLite."""

import json
import logging
import sqlite3
from contextlib import closing
from pathlib import Path
from typing import Any

from nola.config import settings

logger = logging.getLogger(__name__)


class AppConfigDatabase:
    """Read and write application configuration from the app_config table.

    Values are stored as JSON-encoded strings. Scalar values (int, float,
    bool, str, None) and nested objects (dict, list) are both supported.
    """

    def __init__(self, db_path: str | Path | None = None) -> None:
        """Initialize app config database.

        Args:
            db_path: Path to SQLite database file. Defaults to settings.db_path.
        """
        self.db_path = Path(db_path) if db_path else settings.db_path

    def _connect(self) -> sqlite3.Connection:
        """Create connection with consistent settings."""
        conn = sqlite3.connect(self.db_path)
        conn.execute("PRAGMA foreign_keys = ON")
        conn.row_factory = sqlite3.Row
        return conn

    def get_all(self, prefix: str) -> dict[str, Any]:
        """Get all configuration entries matching a key prefix.

        Args:
            prefix: Key prefix to filter by (e.g. ``"transcription."``)

        Returns:
            Dict mapping unprefixed keys to deserialized values.
            For example, prefix ``"transcription."`` with key
            ``"transcription.beam_size"`` returns ``{"beam_size": 5}``.
        """
        with closing(self._connect()) as conn:
            cursor = conn.execute(
                "SELECT key, value FROM app_config WHERE key LIKE ?",
                (f"{prefix}%",),
            )
            result: dict[str, Any] = {}
            for row in cursor:
                raw_key: str = row["key"]
                unprefixed = raw_key[len(prefix) :]
                try:
                    result[unprefixed] = json.loads(row["value"])
                except json.JSONDecodeError:
                    logger.warning(
                        "Corrupted config value for key %s, skipping", raw_key
                    )
            return result

    def set_many(self, prefix: str, values: dict[str, Any]) -> list[str]:
        """Write multiple configuration entries with a key prefix.

        Existing keys are overwritten. Keys not present in *values* are
        left unchanged (incremental update).

        Args:
            prefix: Key prefix to prepend (e.g. ``"transcription."``)
            values: Dict of unprefixed keys to values

        Returns:
            List of full keys that were written.
        """
        written_keys: list[str] = []
        with closing(self._connect()) as conn:
            with conn:
                for key, value in values.items():
                    full_key = f"{prefix}{key}"
                    conn.execute(
                        "INSERT INTO app_config (key, value) VALUES (?, ?) "
                        "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                        (full_key, json.dumps(value)),
                    )
                    written_keys.append(full_key)
        return written_keys

    def delete_all(self, prefix: str) -> int:
        """Delete all configuration entries matching a key prefix.

        Args:
            prefix: Key prefix to filter by (e.g. ``"transcription."``)

        Returns:
            Number of entries deleted.
        """
        with closing(self._connect()) as conn:
            with conn:
                cursor = conn.execute(
                    "DELETE FROM app_config WHERE key LIKE ?",
                    (f"{prefix}%",),
                )
                deleted = cursor.rowcount
                return deleted
