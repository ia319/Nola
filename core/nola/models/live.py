"""Live transcription database operations."""

import sqlite3
from contextlib import closing
from pathlib import Path
from typing import cast

from nola.application.live.types import (
    LiveSegmentRecord,
    LiveSessionMode,
    LiveSessionRecord,
    LiveSessionStatus,
    LiveTrackRecord,
    LiveTrackSource,
)


class LiveDatabase:
    """Manage live transcription sessions, tracks, and segments in SQLite."""

    def __init__(self, db_path: str | Path = "data/nola.db") -> None:
        self.db_path = Path(db_path)

    def _connect(self) -> sqlite3.Connection:
        """Create connection with consistent settings."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    def _to_session_record(self, row: sqlite3.Row) -> LiveSessionRecord:
        """Return one live session row as an application record."""
        return cast(LiveSessionRecord, dict(row))

    def _to_track_record(self, row: sqlite3.Row) -> LiveTrackRecord:
        """Return one live track row as an application record."""
        return cast(LiveTrackRecord, dict(row))

    def _to_segment_record(self, row: sqlite3.Row) -> LiveSegmentRecord:
        """Return one live segment row as an application record."""
        values = dict(row)
        values["is_final"] = bool(values["is_final"])
        return cast(LiveSegmentRecord, values)

    def create_session(
        self,
        *,
        session_id: str,
        title: str | None,
        mode: LiveSessionMode,
        status: LiveSessionStatus,
        language_hint: str | None,
        model_id: str | None,
        runtime: str | None,
        audio_format: str | None,
        started_at: str,
        created_at: str,
        updated_at: str,
    ) -> LiveSessionRecord:
        """Create one live session and return its stored snapshot."""
        with closing(self._connect()) as conn:
            with conn:
                cursor = conn.execute(
                    """
                    INSERT INTO live_sessions (
                        id, title, mode, status, language_hint, model_id,
                        runtime, audio_format, started_at, created_at, updated_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    RETURNING *
                    """,
                    (
                        session_id,
                        title,
                        mode,
                        status,
                        language_hint,
                        model_id,
                        runtime,
                        audio_format,
                        started_at,
                        created_at,
                        updated_at,
                    ),
                )
                return self._to_session_record(cursor.fetchone())

    def get_session(self, session_id: str) -> LiveSessionRecord | None:
        """Return one live session by id."""
        with closing(self._connect()) as conn:
            cursor = conn.execute(
                "SELECT * FROM live_sessions WHERE id = ?",
                (session_id,),
            )
            row = cursor.fetchone()

        return self._to_session_record(row) if row is not None else None

    def list_sessions(
        self,
        limit: int = 50,
        offset: int = 0,
    ) -> list[LiveSessionRecord]:
        """Return paged live sessions in newest-first order."""
        with closing(self._connect()) as conn:
            cursor = conn.execute(
                """
                SELECT * FROM live_sessions
                ORDER BY started_at DESC, id DESC
                LIMIT ? OFFSET ?
                """,
                (limit, offset),
            )
            return [self._to_session_record(row) for row in cursor.fetchall()]

    def count_sessions(self) -> int:
        """Return total live session count."""
        with closing(self._connect()) as conn:
            cursor = conn.execute("SELECT COUNT(*) FROM live_sessions")
            return int(cursor.fetchone()[0])

    def finish_session(
        self,
        session_id: str,
        *,
        ended_at: str,
        updated_at: str,
    ) -> LiveSessionRecord | None:
        """Mark an active live session finished and return the updated row."""
        with closing(self._connect()) as conn:
            with conn:
                cursor = conn.execute(
                    """
                    UPDATE live_sessions
                    SET status = ?, ended_at = ?, updated_at = ?
                    WHERE id = ? AND status = ?
                    RETURNING *
                    """,
                    ("finished", ended_at, updated_at, session_id, "active"),
                )
                row = cursor.fetchone()

        return self._to_session_record(row) if row is not None else None

    def fail_session(
        self,
        session_id: str,
        *,
        error: str,
        ended_at: str,
        updated_at: str,
    ) -> LiveSessionRecord | None:
        """Mark an active live session failed and return the updated row."""
        with closing(self._connect()) as conn:
            with conn:
                cursor = conn.execute(
                    """
                    UPDATE live_sessions
                    SET status = ?, error = ?, ended_at = ?, updated_at = ?
                    WHERE id = ? AND status = ?
                    RETURNING *
                    """,
                    ("failed", error, ended_at, updated_at, session_id, "active"),
                )
                row = cursor.fetchone()

        return self._to_session_record(row) if row is not None else None

    def create_track(
        self,
        *,
        track_id: str,
        session_id: str,
        source: LiveTrackSource,
        label: str | None,
        device_label: str | None,
        sample_rate: int | None,
        channel_count: int | None,
        started_at: str | None,
        ended_at: str | None,
        created_at: str,
    ) -> LiveTrackRecord:
        """Create one live audio track and return its stored snapshot."""
        with closing(self._connect()) as conn:
            with conn:
                cursor = conn.execute(
                    """
                    INSERT INTO live_tracks (
                        id, session_id, source, label, device_label, sample_rate,
                        channel_count, started_at, ended_at, created_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    RETURNING *
                    """,
                    (
                        track_id,
                        session_id,
                        source,
                        label,
                        device_label,
                        sample_rate,
                        channel_count,
                        started_at,
                        ended_at,
                        created_at,
                    ),
                )
                return self._to_track_record(cursor.fetchone())

    def list_tracks(self, session_id: str) -> list[LiveTrackRecord]:
        """Return tracks attached to one live session."""
        with closing(self._connect()) as conn:
            cursor = conn.execute(
                """
                SELECT * FROM live_tracks
                WHERE session_id = ?
                ORDER BY created_at ASC, id ASC
                """,
                (session_id,),
            )
            return [self._to_track_record(row) for row in cursor.fetchall()]

    def create_segment(
        self,
        *,
        segment_id: str,
        session_id: str,
        track_id: str | None,
        sequence: int,
        start_ms: int,
        end_ms: int,
        text: str,
        language: str | None,
        confidence: float | None,
        is_final: bool,
        created_at: str,
    ) -> LiveSegmentRecord:
        """Create one live transcript segment and return its stored snapshot."""
        with closing(self._connect()) as conn:
            with conn:
                if track_id is not None:
                    cursor = conn.execute(
                        """
                        SELECT 1 FROM live_tracks
                        WHERE id = ? AND session_id = ?
                        """,
                        (track_id, session_id),
                    )
                    if cursor.fetchone() is None:
                        raise sqlite3.IntegrityError(
                            "Live segment track must belong to the same session"
                        )

                cursor = conn.execute(
                    """
                    INSERT INTO live_segments (
                        id, session_id, track_id, sequence, start_ms, end_ms, text,
                        language, confidence, is_final, created_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    RETURNING *
                    """,
                    (
                        segment_id,
                        session_id,
                        track_id,
                        sequence,
                        start_ms,
                        end_ms,
                        text,
                        language,
                        confidence,
                        int(is_final),
                        created_at,
                    ),
                )
                return self._to_segment_record(cursor.fetchone())

    def list_segments(self, session_id: str) -> list[LiveSegmentRecord]:
        """Return transcript segments attached to one live session."""
        with closing(self._connect()) as conn:
            cursor = conn.execute(
                """
                SELECT * FROM live_segments
                WHERE session_id = ?
                ORDER BY sequence ASC, id ASC
                """,
                (session_id,),
            )
            return [self._to_segment_record(row) for row in cursor.fetchall()]
