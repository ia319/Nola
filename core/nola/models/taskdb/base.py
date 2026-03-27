"""Shared SQLite connection setup for task repositories."""

import sqlite3
from pathlib import Path


class TaskRepositoryBase:
    """Provide consistent SQLite connection behavior."""

    def __init__(self, db_path: str | Path = "data/nola.db") -> None:
        self.db_path = Path(db_path)

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        return conn
