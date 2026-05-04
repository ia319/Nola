import sqlite3
from contextlib import closing
from pathlib import Path

from nola.config import settings

from .utils import ensure_sqlite_version


def init_db(db_path: str | Path | None = None) -> None:
    """Initialize database schema for files, tasks, and app config."""
    ensure_sqlite_version()

    path = Path(db_path) if db_path else settings.db_path
    path.parent.mkdir(parents=True, exist_ok=True)

    with closing(sqlite3.connect(path)) as conn:
        with conn:
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
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_files_filename ON files(filename)"
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

                    -- Transcription options (JSON)
                    options TEXT,

                    -- Task execution config
                    model_id TEXT,
                    engine_device TEXT,
                    engine_compute_type TEXT,

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
                "CREATE INDEX IF NOT EXISTS idx_worker "
                "ON transcription_tasks(worker_id)"
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_heartbeat "
                "ON transcription_tasks(last_heartbeat)"
            )

            # Application configuration key-value store
            conn.execute("""
                CREATE TABLE IF NOT EXISTS app_config (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                )
            """)

            # Live transcription sessions and history
            conn.execute("""
                CREATE TABLE IF NOT EXISTS live_sessions (
                    id TEXT PRIMARY KEY,
                    title TEXT,
                    mode TEXT NOT NULL,
                    status TEXT NOT NULL,
                    language_hint TEXT,
                    model_id TEXT,
                    runtime TEXT,
                    audio_format TEXT,
                    started_at TEXT NOT NULL,
                    ended_at TEXT,
                    error TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS live_tracks (
                    id TEXT PRIMARY KEY,
                    session_id TEXT NOT NULL,
                    source TEXT NOT NULL,
                    label TEXT,
                    device_label TEXT,
                    sample_rate INTEGER,
                    channel_count INTEGER,
                    started_at TEXT,
                    ended_at TEXT,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (session_id)
                        REFERENCES live_sessions(id)
                        ON DELETE CASCADE
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS live_segments (
                    id TEXT PRIMARY KEY,
                    session_id TEXT NOT NULL,
                    track_id TEXT,
                    sequence INTEGER NOT NULL,
                    start_ms INTEGER NOT NULL,
                    end_ms INTEGER NOT NULL,
                    text TEXT NOT NULL,
                    language TEXT,
                    confidence REAL,
                    is_final INTEGER NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (session_id)
                        REFERENCES live_sessions(id)
                        ON DELETE CASCADE,
                    FOREIGN KEY (track_id)
                        REFERENCES live_tracks(id)
                        ON DELETE SET NULL
                )
            """)
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_live_sessions_started "
                "ON live_sessions(started_at DESC)"
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_live_sessions_status "
                "ON live_sessions(status)"
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_live_tracks_session "
                "ON live_tracks(session_id)"
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_live_segments_session_sequence "
                "ON live_segments(session_id, sequence)"
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_live_segments_track_sequence "
                "ON live_segments(track_id, sequence)"
            )

            # Schema migrations for task execution config columns
            cursor = conn.execute("PRAGMA table_info(transcription_tasks)")
            existing_columns = {row[1] for row in cursor.fetchall()}
            task_execution_columns = {
                "model_id": "ALTER TABLE transcription_tasks ADD COLUMN model_id TEXT",
                "engine_device": (
                    "ALTER TABLE transcription_tasks ADD COLUMN engine_device TEXT"
                ),
                "engine_compute_type": (
                    "ALTER TABLE transcription_tasks "
                    "ADD COLUMN engine_compute_type TEXT"
                ),
            }
            for column_name, alter_sql in task_execution_columns.items():
                if column_name not in existing_columns:
                    conn.execute(alter_sql)
