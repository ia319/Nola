import sqlite3
from pathlib import Path

from .utils import ensure_sqlite_version

DB_PATH = Path("data/nola.db")


def init_db(db_path: str | Path = DB_PATH) -> None:
    """Initialize database schema with files and tasks tables."""
    ensure_sqlite_version()

    path = Path(db_path)
    path.parent.mkdir(parents=True, exist_ok=True)

    with sqlite3.connect(path) as conn:
        # Enable foreign key constraints
        conn.execute("PRAGMA foreign_keys = ON")

        # Files table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS files (
                id TEXT PRIMARY KEY,
                filename TEXT NOT NULL,
                path TEXT NOT NULL,
                size INTEGER NOT NULL,
                content_type TEXT,
                created_at TEXT NOT NULL
            )
        """)
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_files_created ON files(created_at DESC)"
        )

        # Transcription tasks table with production-grade features
        conn.execute("""
            CREATE TABLE IF NOT EXISTS transcription_tasks (
                id TEXT PRIMARY KEY,
                file_id TEXT NOT NULL,
                status TEXT NOT NULL,
                
                -- Scheduling fields
                priority INTEGER DEFAULT 0,
                retry_count INTEGER DEFAULT 0,
                max_retries INTEGER DEFAULT 3,
                
                -- Worker management
                worker_id TEXT,
                started_at TEXT,
                last_heartbeat TEXT,
                timeout_seconds INTEGER DEFAULT 3600,
                
                -- Result fields
                progress REAL DEFAULT 0.0,
                duration REAL,
                segments TEXT,
                error TEXT,
                
                -- Timestamps
                created_at TEXT NOT NULL,
                completed_at TEXT,
                
                FOREIGN KEY (file_id) REFERENCES files(id)
            )
        """)

        # Indexes for efficient querying
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_queue "
            "ON transcription_tasks(status, priority DESC, created_at ASC)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_worker ON transcription_tasks(worker_id)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_heartbeat "
            "ON transcription_tasks(last_heartbeat)"
        )

        conn.commit()
