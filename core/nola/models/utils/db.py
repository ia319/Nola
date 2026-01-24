"""Database helper utilities."""

import sqlite3


def ensure_sqlite_version() -> None:
    """Ensure SQLite version supports required features (RETURNING clause).

    Raises:
        RuntimeError: If SQLite version is too old.
    """
    min_version = (3, 35, 0)
    current_version = tuple(map(int, sqlite3.sqlite_version.split(".")))

    if current_version < min_version:
        raise RuntimeError(
            f"SQLite version {sqlite3.sqlite_version} is too old. "
            f"Nola requires SQLite >= {'.'.join(map(str, min_version))} "
            "for atomic queue operations (UPDATE ... RETURNING)."
        )
