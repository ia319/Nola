"""Live transcription database operations."""

import json
import logging
import sqlite3
from contextlib import closing
from pathlib import Path
from typing import cast

from nola.application.live.types import (
    DEFAULT_LIVE_SEGMENT_LIMIT,
    DEFAULT_LIVE_SESSION_LIMIT,
    DEFAULT_LIVE_SESSION_SORT_BY,
    DEFAULT_LIVE_SORT_ORDER,
    DELETABLE_LIVE_SESSION_STATUSES,
    LiveRequestOverrides,
    LiveSegmentRecord,
    LiveSessionMode,
    LiveSessionRecord,
    LiveSessionSortBy,
    LiveSessionStatus,
    LiveSortOrder,
    LiveTrackRecord,
    LiveTrackSource,
)
from nola.common.types import JsonDict
from nola.models.query_helpers import build_contains_like_pattern

logger = logging.getLogger(__name__)

_LIVE_SESSION_SORT_COLUMNS: dict[LiveSessionSortBy, str] = {
    "started_at": "started_at",
    "ended_at": "ended_at",
    "status": "status",
    "title": "title",
}


def _serialize_json_object(value: JsonDict | None, *, field_name: str) -> str | None:
    """Return a JSON object string or reject unsafe values."""
    if value is None:
        return None
    try:
        return json.dumps(value, allow_nan=False)
    except (TypeError, ValueError) as error:
        raise ValueError(
            f"{field_name} must be JSON-serializable and cannot contain "
            f"NaN/Infinity: {error}"
        ) from error


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
        values = dict(row)
        self._parse_session_json_object(
            values,
            session_id=row["id"],
            field_name="runtime_config",
        )
        self._parse_session_json_object(
            values,
            session_id=row["id"],
            field_name="request_overrides",
        )
        return cast(LiveSessionRecord, values)

    def _parse_session_json_object(
        self,
        values: dict[str, object],
        *,
        session_id: str,
        field_name: str,
    ) -> None:
        raw_value = values.get(field_name)
        if raw_value:
            try:
                parsed = json.loads(cast(str, raw_value))
                if isinstance(parsed, dict):
                    values[field_name] = cast(JsonDict, parsed)
                else:
                    logger.warning(
                        "Invalid live %s shape for %s",
                        field_name,
                        session_id,
                    )
                    values[field_name] = None
            except json.JSONDecodeError:
                logger.warning("Corrupted live %s for %s", field_name, session_id)
                values[field_name] = None
        else:
            values[field_name] = None

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
        runtime_config: JsonDict | None = None,
        request_overrides: LiveRequestOverrides | None = None,
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
                        runtime, audio_format, runtime_config, request_overrides,
                        started_at, created_at, updated_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                        _serialize_json_object(
                            runtime_config,
                            field_name="runtime_config",
                        ),
                        _serialize_json_object(
                            request_overrides,
                            field_name="request_overrides",
                        ),
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
        limit: int = DEFAULT_LIVE_SESSION_LIMIT,
        offset: int = 0,
        *,
        q: str | None = None,
        status: LiveSessionStatus | None = None,
        sort_by: LiveSessionSortBy = DEFAULT_LIVE_SESSION_SORT_BY,
        order: LiveSortOrder = DEFAULT_LIVE_SORT_ORDER,
    ) -> list[LiveSessionRecord]:
        """Return paged live sessions matching history filters."""
        where_sql, params = self._build_session_filters(q=q, status=status)
        sort_column = _LIVE_SESSION_SORT_COLUMNS[sort_by]
        order_sql = "ASC" if order == "asc" else "DESC"
        with closing(self._connect()) as conn:
            cursor = conn.execute(
                f"""
                SELECT * FROM live_sessions
                {where_sql}
                ORDER BY {sort_column} {order_sql}, id {order_sql}
                LIMIT ? OFFSET ?
                """,
                (*params, limit, offset),
            )
            return [self._to_session_record(row) for row in cursor.fetchall()]

    def count_sessions(
        self,
        *,
        q: str | None = None,
        status: LiveSessionStatus | None = None,
    ) -> int:
        """Return total live session count matching filters."""
        where_sql, params = self._build_session_filters(q=q, status=status)
        with closing(self._connect()) as conn:
            cursor = conn.execute(
                f"SELECT COUNT(*) FROM live_sessions {where_sql}",
                params,
            )
            return int(cursor.fetchone()[0])

    def _build_session_filters(
        self,
        *,
        q: str | None,
        status: LiveSessionStatus | None,
    ) -> tuple[str, tuple[object, ...]]:
        filters: list[str] = []
        params: list[object] = []
        if q:
            pattern = build_contains_like_pattern(q)
            filters.append(
                """
                (
                    lower(id) LIKE ? ESCAPE '\\'
                    OR lower(coalesce(title, '')) LIKE ? ESCAPE '\\'
                )
                """
            )
            params.extend([pattern, pattern])
        if status is not None:
            filters.append("status = ?")
            params.append(status)
        where_sql = f"WHERE {' AND '.join(filters)}" if filters else ""
        return where_sql, tuple(params)

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

    def delete_session_record(self, session_id: str) -> bool:
        """Delete one terminal live session record."""
        with closing(self._connect()) as conn:
            with conn:
                cursor = conn.execute(
                    """
                    DELETE FROM live_sessions
                    WHERE id = ? AND status IN (?, ?)
                    """,
                    (session_id, *DELETABLE_LIVE_SESSION_STATUSES),
                )
                return cursor.rowcount > 0

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

    def finish_track(
        self,
        track_id: str,
        session_id: str,
        *,
        ended_at: str,
    ) -> LiveTrackRecord | None:
        """Mark one active live track finished and return the updated row."""
        with closing(self._connect()) as conn:
            with conn:
                cursor = conn.execute(
                    """
                    UPDATE live_tracks
                    SET ended_at = ?
                    WHERE id = ? AND session_id = ? AND ended_at IS NULL
                    RETURNING *
                    """,
                    (ended_at, track_id, session_id),
                )
                row = cursor.fetchone()

        return self._to_track_record(row) if row is not None else None

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

    def list_segments(
        self,
        session_id: str,
        limit: int = DEFAULT_LIVE_SEGMENT_LIMIT,
        offset: int = 0,
    ) -> list[LiveSegmentRecord]:
        """Return paged transcript segments attached to one live session."""
        with closing(self._connect()) as conn:
            cursor = conn.execute(
                """
                SELECT * FROM live_segments
                WHERE session_id = ?
                ORDER BY sequence ASC, id ASC
                LIMIT ? OFFSET ?
                """,
                (session_id, limit, offset),
            )
            return [self._to_segment_record(row) for row in cursor.fetchall()]

    def list_final_segments(self, session_id: str) -> list[LiveSegmentRecord]:
        """Return final transcript segments attached to one live session."""
        with closing(self._connect()) as conn:
            cursor = conn.execute(
                """
                SELECT * FROM live_segments
                WHERE session_id = ? AND is_final = 1
                ORDER BY sequence ASC, id ASC
                """,
                (session_id,),
            )
            return [self._to_segment_record(row) for row in cursor.fetchall()]

    def count_segments(self, session_id: str) -> int:
        """Return total transcript segment count for one live session."""
        with closing(self._connect()) as conn:
            cursor = conn.execute(
                "SELECT COUNT(*) FROM live_segments WHERE session_id = ?",
                (session_id,),
            )
            return int(cursor.fetchone()[0])
