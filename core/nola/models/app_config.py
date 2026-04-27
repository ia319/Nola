"""Application configuration key-value store backed by SQLite."""

import json
import logging
import sqlite3
from collections.abc import Mapping
from contextlib import closing
from pathlib import Path
from typing import cast

from nola.config import settings
from nola.config.common.types import ConfigMap, ConfigValue

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

    def get_all(self, prefix: str) -> ConfigMap:
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
            result: ConfigMap = {}
            for row in cursor:
                raw_key: str = row["key"]
                unprefixed = raw_key[len(prefix) :]
                try:
                    result[unprefixed] = cast(ConfigValue, json.loads(row["value"]))
                except json.JSONDecodeError:
                    logger.warning(
                        "Corrupted config value for key %s, skipping", raw_key
                    )
            return result

    def set_many(self, prefix: str, values: ConfigMap) -> list[str]:
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

    def patch_many(self, prefix: str, values: ConfigMap) -> list[str]:
        """Patch configuration keys under a prefix in one transaction.

        Values set to ``None`` remove the key; other values are upserted.
        This supports PATCH semantics without read-merge-replace on the full
        prefix, so concurrent updates to different keys do not clobber each
        other.

        Args:
            prefix: Key prefix to patch (e.g. ``"export."``)
            values: Mapping of unprefixed keys to values or ``None`` to delete

        Returns:
            List of full keys touched by the patch operation.
        """
        return self.patch_many_prefixes({prefix: values})

    def patch_many_prefixes(
        self,
        patches_by_prefix: Mapping[str, ConfigMap],
    ) -> list[str]:
        """Patch configuration keys across prefixes in one transaction.

        Values set to ``None`` remove the key; other values are upserted.
        This keeps related settings under separate key prefixes while applying
        one logical update atomically.

        Args:
            patches_by_prefix: Mapping of key prefixes to unprefixed patch values

        Returns:
            List of full keys touched by the patch operation.
        """
        touched_keys: list[str] = []
        with closing(self._connect()) as conn:
            with conn:
                for prefix, values in patches_by_prefix.items():
                    for key, value in values.items():
                        full_key = f"{prefix}{key}"
                        if value is None:
                            conn.execute(
                                "DELETE FROM app_config WHERE key = ?",
                                (full_key,),
                            )
                        else:
                            conn.execute(
                                "INSERT INTO app_config (key, value) VALUES (?, ?) "
                                "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                                (full_key, json.dumps(value)),
                            )
                        touched_keys.append(full_key)
        return touched_keys

    def replace_many(self, prefix: str, values: ConfigMap) -> list[str]:
        """Replace all entries under a prefix in one transaction.

        Args:
            prefix: Key prefix to replace (e.g. ``"transcription."``)
            values: Full replacement mapping of unprefixed keys to values

        Returns:
            List of full keys that were written after the replacement.
        """
        written_keys: list[str] = []
        with closing(self._connect()) as conn:
            with conn:
                conn.execute(
                    "DELETE FROM app_config WHERE key LIKE ?",
                    (f"{prefix}%",),
                )
                for key, value in values.items():
                    full_key = f"{prefix}{key}"
                    conn.execute(
                        "INSERT INTO app_config (key, value) VALUES (?, ?)",
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
