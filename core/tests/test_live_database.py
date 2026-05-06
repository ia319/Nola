"""Repository tests for live transcription database operations."""

import gc
import sqlite3
import tempfile
from contextlib import closing
from pathlib import Path

import pytest

from nola.models import FileDatabase, LiveDatabase, TaskDatabase, init_db


@pytest.fixture
def live_database():
    """Create an isolated live repository with a fresh SQLite database."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "test.db"
        init_db(db_path)

        try:
            yield LiveDatabase(db_path)
        finally:
            gc.collect()


def _create_session(live_db: LiveDatabase, session_id: str = "live-001") -> None:
    """Create one active live session for repository tests."""
    live_db.create_session(
        session_id=session_id,
        title="Daily meeting",
        mode="streaming",
        status="active",
        language_hint="en",
        model_id=None,
        runtime=None,
        audio_format="pcm_s16le_16khz_mono",
        started_at="2026-01-01T00:00:00",
        created_at="2026-01-01T00:00:00",
        updated_at="2026-01-01T00:00:00",
    )


def test_init_db_creates_live_tables_and_indexes():
    """init_db() should create live tables and indexes."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "test.db"
        init_db(db_path)

        with closing(sqlite3.connect(db_path)) as conn:
            table_rows = conn.execute(
                """
                SELECT name FROM sqlite_master
                WHERE type = 'table' AND name LIKE 'live_%'
                """
            ).fetchall()
            index_rows = conn.execute(
                """
                SELECT name FROM sqlite_master
                WHERE type = 'index' AND name LIKE 'idx_live_%'
                """
            ).fetchall()

    tables = {row[0] for row in table_rows}
    indexes = {row[0] for row in index_rows}

    assert {"live_sessions", "live_tracks", "live_segments"} <= tables
    assert {
        "idx_live_sessions_started",
        "idx_live_sessions_status",
        "idx_live_tracks_session",
        "idx_live_segments_session_sequence",
        "idx_live_segments_track_sequence",
    } <= indexes


def test_create_get_list_and_count_session(live_database):
    """Live sessions should be created and listed independently."""
    live_db = live_database

    _create_session(live_db)

    stored = live_db.get_session("live-001")
    sessions = live_db.list_sessions(limit=10, offset=0)

    assert stored is not None
    assert stored["id"] == "live-001"
    assert stored["mode"] == "streaming"
    assert stored["status"] == "active"
    assert stored["audio_format"] == "pcm_s16le_16khz_mono"
    assert live_db.count_sessions() == 1
    assert [session["id"] for session in sessions] == ["live-001"]


def test_finish_session_only_updates_active_session(live_database):
    """finish_session() should return an updated active session snapshot."""
    live_db = live_database
    _create_session(live_db)

    finished = live_db.finish_session(
        "live-001",
        ended_at="2026-01-01T00:01:00",
        updated_at="2026-01-01T00:01:00",
    )
    repeated = live_db.finish_session(
        "live-001",
        ended_at="2026-01-01T00:02:00",
        updated_at="2026-01-01T00:02:00",
    )

    assert finished is not None
    assert finished["status"] == "finished"
    assert finished["ended_at"] == "2026-01-01T00:01:00"
    assert repeated is None


def test_fail_session_only_updates_active_session(live_database):
    """fail_session() should preserve failed session error details."""
    live_db = live_database
    _create_session(live_db)

    failed = live_db.fail_session(
        "live-001",
        error="Audio stream disconnected",
        ended_at="2026-01-01T00:01:00",
        updated_at="2026-01-01T00:01:00",
    )
    repeated = live_db.fail_session(
        "live-001",
        error="Second failure",
        ended_at="2026-01-01T00:02:00",
        updated_at="2026-01-01T00:02:00",
    )

    assert failed is not None
    assert failed["status"] == "failed"
    assert failed["error"] == "Audio stream disconnected"
    assert repeated is None


def test_create_tracks_and_segments(live_database):
    """Live tracks and segments should be stored under one session."""
    live_db = live_database
    _create_session(live_db)

    track = live_db.create_track(
        track_id="track-001",
        session_id="live-001",
        source="microphone",
        label="Mic",
        device_label="Built-in microphone",
        sample_rate=16000,
        channel_count=1,
        started_at="2026-01-01T00:00:00",
        ended_at=None,
        created_at="2026-01-01T00:00:00",
    )
    live_db.create_segment(
        segment_id="segment-002",
        session_id="live-001",
        track_id="track-001",
        sequence=2,
        start_ms=1000,
        end_ms=2000,
        text="world",
        language="en",
        confidence=0.9,
        is_final=True,
        created_at="2026-01-01T00:00:02",
    )
    live_db.create_segment(
        segment_id="segment-001",
        session_id="live-001",
        track_id="track-001",
        sequence=1,
        start_ms=0,
        end_ms=1000,
        text="hello",
        language="en",
        confidence=0.95,
        is_final=True,
        created_at="2026-01-01T00:00:01",
    )

    tracks = live_db.list_tracks("live-001")
    segments = live_db.list_segments("live-001")

    assert track["source"] == "microphone"
    assert tracks[0]["device_label"] == "Built-in microphone"
    assert [segment["id"] for segment in segments] == ["segment-001", "segment-002"]
    assert segments[0]["is_final"] is True
    assert live_db.count_segments("live-001") == 2


def test_finish_track_only_updates_open_track(live_database):
    """finish_track() should persist one open live track end timestamp."""
    live_db = live_database
    _create_session(live_db)
    live_db.create_track(
        track_id="track-001",
        session_id="live-001",
        source="microphone",
        label="Mic",
        device_label="Built-in microphone",
        sample_rate=16000,
        channel_count=1,
        started_at="2026-01-01T00:00:00",
        ended_at=None,
        created_at="2026-01-01T00:00:00",
    )

    finished = live_db.finish_track(
        "track-001",
        "live-001",
        ended_at="2026-01-01T00:01:00",
    )
    repeated = live_db.finish_track(
        "track-001",
        "live-001",
        ended_at="2026-01-01T00:02:00",
    )

    assert finished is not None
    assert finished["ended_at"] == "2026-01-01T00:01:00"
    assert repeated is None
    assert live_db.list_tracks("live-001")[0]["ended_at"] == "2026-01-01T00:01:00"


def test_create_segment_allows_untracked_segment(live_database):
    """Live segments may be stored before a source track is known."""
    live_db = live_database
    _create_session(live_db)

    segment = live_db.create_segment(
        segment_id="segment-001",
        session_id="live-001",
        track_id=None,
        sequence=1,
        start_ms=0,
        end_ms=1000,
        text="interim text",
        language=None,
        confidence=None,
        is_final=False,
        created_at="2026-01-01T00:00:01",
    )
    segments = live_db.list_segments("live-001")

    assert segment["track_id"] is None
    assert segment["is_final"] is False
    assert segments == [segment]


def test_list_segments_returns_paged_results(live_database):
    """Live segments should be paged in sequence order."""
    live_db = live_database
    _create_session(live_db)

    for sequence in range(1, 4):
        live_db.create_segment(
            segment_id=f"segment-00{sequence}",
            session_id="live-001",
            track_id=None,
            sequence=sequence,
            start_ms=(sequence - 1) * 1000,
            end_ms=sequence * 1000,
            text=f"text {sequence}",
            language="en",
            confidence=None,
            is_final=True,
            created_at=f"2026-01-01T00:00:0{sequence}",
        )

    segments = live_db.list_segments("live-001", limit=1, offset=1)

    assert [segment["id"] for segment in segments] == ["segment-002"]
    assert live_db.count_segments("live-001") == 3


def test_create_segment_rejects_cross_session_track(live_database):
    """Segments should not reference tracks from another live session."""
    live_db = live_database
    _create_session(live_db, session_id="live-a")
    _create_session(live_db, session_id="live-b")
    live_db.create_track(
        track_id="track-a",
        session_id="live-a",
        source="microphone",
        label="Mic",
        device_label="Built-in microphone",
        sample_rate=16000,
        channel_count=1,
        started_at="2026-01-01T00:00:00",
        ended_at=None,
        created_at="2026-01-01T00:00:00",
    )

    with pytest.raises(sqlite3.IntegrityError):
        live_db.create_segment(
            segment_id="segment-b",
            session_id="live-b",
            track_id="track-a",
            sequence=1,
            start_ms=0,
            end_ms=1000,
            text="wrong track",
            language="en",
            confidence=0.1,
            is_final=True,
            created_at="2026-01-01T00:00:01",
        )

    assert live_db.list_segments("live-b") == []


def test_live_tables_do_not_affect_task_tables():
    """Live rows should not write into transcription task storage."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "test.db"
        init_db(db_path)

        live_db = LiveDatabase(db_path)
        file_db = FileDatabase(db_path)
        task_db = TaskDatabase(db_path)

        _create_session(live_db)
        file_db.create_file("file-001", "test.wav", "/tmp/test.wav", 100)
        task_db.enqueue("task-001", "file-001")

        assert live_db.count_sessions() == 1
        assert task_db.count_tasks() == 1
        assert task_db.get_task("live-001") is None
