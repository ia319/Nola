"""Unit tests for live transcription application use-cases."""

from typing import cast

import pytest

from nola.application.live import (
    create_live_session,
    finish_live_session,
    get_live_session,
    list_live_sessions,
)
from nola.application.live.errors import LiveUseCaseError
from nola.application.live.types import (
    DEFAULT_LIVE_SEGMENT_LIMIT,
    MAX_LIVE_SEGMENT_LIMIT,
    LiveSegmentRecord,
    LiveSessionMode,
    LiveSessionRecord,
    LiveSessionStatus,
    LiveTrackRecord,
    LiveTrackSource,
)


class FakeLiveStore:
    """In-memory live repository for use-case tests."""

    def __init__(self, sessions: dict[str, LiveSessionRecord] | None = None) -> None:
        self.sessions = sessions or {}
        self.tracks: dict[str, list[LiveTrackRecord]] = {}
        self.segments: dict[str, list[LiveSegmentRecord]] = {}
        self.created_sessions: list[dict[str, object]] = []
        self.finish_calls = 0

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
        session: LiveSessionRecord = {
            "id": session_id,
            "title": title,
            "mode": mode,
            "status": status,
            "language_hint": language_hint,
            "model_id": model_id,
            "runtime": runtime,
            "audio_format": audio_format,
            "started_at": started_at,
            "ended_at": None,
            "error": None,
            "created_at": created_at,
            "updated_at": updated_at,
        }
        self.sessions[session_id] = session
        self.created_sessions.append(dict(session))
        return dict(session)  # type: ignore[return-value]

    def get_session(self, session_id: str) -> LiveSessionRecord | None:
        session = self.sessions.get(session_id)
        return dict(session) if session else None  # type: ignore[return-value]

    def list_sessions(
        self, limit: int = 50, offset: int = 0
    ) -> list[LiveSessionRecord]:
        sessions = sorted(
            self.sessions.values(),
            key=lambda session: (session["started_at"], session["id"]),
            reverse=True,
        )
        return [dict(session) for session in sessions[offset : offset + limit]]  # type: ignore[list-item]

    def count_sessions(self) -> int:
        return len(self.sessions)

    def finish_session(
        self,
        session_id: str,
        *,
        ended_at: str,
        updated_at: str,
    ) -> LiveSessionRecord | None:
        self.finish_calls += 1
        session = self.sessions.get(session_id)
        if session is None or session["status"] != "active":
            return None
        session["status"] = "finished"
        session["ended_at"] = ended_at
        session["updated_at"] = updated_at
        return dict(session)  # type: ignore[return-value]

    def fail_session(
        self,
        session_id: str,
        *,
        error: str,
        ended_at: str,
        updated_at: str,
    ) -> LiveSessionRecord | None:
        session = self.sessions.get(session_id)
        if session is None or session["status"] != "active":
            return None
        session["status"] = "failed"
        session["error"] = error
        session["ended_at"] = ended_at
        session["updated_at"] = updated_at
        return dict(session)  # type: ignore[return-value]

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
        track: LiveTrackRecord = {
            "id": track_id,
            "session_id": session_id,
            "source": source,
            "label": label,
            "device_label": device_label,
            "sample_rate": sample_rate,
            "channel_count": channel_count,
            "started_at": started_at,
            "ended_at": ended_at,
            "created_at": created_at,
        }
        self.tracks.setdefault(session_id, []).append(track)
        return dict(track)  # type: ignore[return-value]

    def list_tracks(self, session_id: str) -> list[LiveTrackRecord]:
        return [dict(track) for track in self.tracks.get(session_id, [])]  # type: ignore[list-item]

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
        segment: LiveSegmentRecord = {
            "id": segment_id,
            "session_id": session_id,
            "track_id": track_id,
            "sequence": sequence,
            "start_ms": start_ms,
            "end_ms": end_ms,
            "text": text,
            "language": language,
            "confidence": confidence,
            "is_final": is_final,
            "created_at": created_at,
        }
        self.segments.setdefault(session_id, []).append(segment)
        return dict(segment)  # type: ignore[return-value]

    def list_segments(
        self,
        session_id: str,
        limit: int = DEFAULT_LIVE_SEGMENT_LIMIT,
        offset: int = 0,
    ) -> list[LiveSegmentRecord]:
        segments = sorted(
            self.segments.get(session_id, []),
            key=lambda segment: (segment["sequence"], segment["id"]),
        )
        return [dict(segment) for segment in segments[offset : offset + limit]]  # type: ignore[list-item]

    def count_segments(self, session_id: str) -> int:
        return len(self.segments.get(session_id, []))


def _session(
    *,
    session_id: str,
    status: LiveSessionStatus = "active",
    started_at: str = "2026-01-01T00:00:00",
) -> LiveSessionRecord:
    return {
        "id": session_id,
        "title": "Meeting",
        "mode": "streaming",
        "status": status,
        "language_hint": "en",
        "model_id": "small",
        "runtime": None,
        "audio_format": None,
        "started_at": started_at,
        "ended_at": "2026-01-01T00:10:00" if status != "active" else None,
        "error": "failed" if status == "failed" else None,
        "created_at": started_at,
        "updated_at": started_at,
    }


def test_create_live_session_returns_active_payload() -> None:
    live_store = FakeLiveStore()

    payload = create_live_session(
        live_store=live_store,
        title="Planning",
        mode="background",
        language_hint="zh",
        model_id="small",
        session_id_factory=lambda: "live-001",
        timestamp_factory=lambda: "2026-01-01T00:00:00",
    )

    assert payload["session_id"] == "live-001"
    assert payload["title"] == "Planning"
    assert payload["mode"] == "background"
    assert payload["status"] == "active"
    assert payload["language_hint"] == "zh"
    assert payload["model_id"] == "small"
    assert payload["tracks"] == []
    assert payload["segments"] == []
    assert payload["segment_total"] == 0
    assert payload["segment_limit"] == DEFAULT_LIVE_SEGMENT_LIMIT
    assert payload["segment_offset"] == 0
    assert live_store.created_sessions[0]["started_at"] == "2026-01-01T00:00:00"


def test_create_live_session_rejects_invalid_mode() -> None:
    live_store = FakeLiveStore()

    with pytest.raises(LiveUseCaseError) as error:
        create_live_session(
            live_store=live_store,
            title="Planning",
            mode=cast(LiveSessionMode, "invalid"),
            language_hint=None,
            model_id=None,
        )

    assert error.value.status_code == 422
    assert live_store.created_sessions == []


def test_list_live_sessions_returns_paged_payload() -> None:
    live_store = FakeLiveStore(
        sessions={
            "old": _session(session_id="old", started_at="2026-01-01T00:00:00"),
            "new": _session(session_id="new", started_at="2026-01-02T00:00:00"),
        }
    )

    payload = list_live_sessions(live_store=live_store, limit=1, offset=0)

    assert payload["total"] == 2
    assert payload["limit"] == 1
    assert payload["offset"] == 0
    assert [session["session_id"] for session in payload["sessions"]] == ["new"]


def test_get_live_session_returns_tracks_and_segments() -> None:
    live_store = FakeLiveStore(sessions={"live-001": _session(session_id="live-001")})
    live_store.create_track(
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
    live_store.create_segment(
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

    payload = get_live_session(live_store=live_store, session_id="live-001")

    assert payload["session_id"] == "live-001"
    assert payload["tracks"][0]["track_id"] == "track-001"
    assert payload["segments"][0]["segment_id"] == "segment-001"
    assert payload["segment_total"] == 1
    assert payload["segment_limit"] == DEFAULT_LIVE_SEGMENT_LIMIT
    assert payload["segment_offset"] == 0


def test_get_live_session_returns_paged_segments() -> None:
    live_store = FakeLiveStore(sessions={"live-001": _session(session_id="live-001")})
    for sequence in range(1, 4):
        live_store.create_segment(
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

    payload = get_live_session(
        live_store=live_store,
        session_id="live-001",
        segment_limit=1,
        segment_offset=1,
    )

    assert [segment["segment_id"] for segment in payload["segments"]] == ["segment-002"]
    assert payload["segment_total"] == 3
    assert payload["segment_limit"] == 1
    assert payload["segment_offset"] == 1


def test_get_live_session_rejects_invalid_segment_pagination() -> None:
    live_store = FakeLiveStore(sessions={"live-001": _session(session_id="live-001")})

    with pytest.raises(LiveUseCaseError) as limit_error:
        get_live_session(
            live_store=live_store,
            session_id="live-001",
            segment_limit=MAX_LIVE_SEGMENT_LIMIT + 1,
        )

    with pytest.raises(LiveUseCaseError) as offset_error:
        get_live_session(
            live_store=live_store,
            session_id="live-001",
            segment_offset=-1,
        )

    assert limit_error.value.status_code == 422
    assert offset_error.value.status_code == 422


def test_get_live_session_raises_when_missing() -> None:
    live_store = FakeLiveStore()

    with pytest.raises(LiveUseCaseError) as error:
        get_live_session(live_store=live_store, session_id="missing")

    assert error.value.status_code == 404
    assert error.value.detail == "Live session not found"


def test_get_live_session_rejects_invalid_persisted_mode() -> None:
    invalid_session = _session(session_id="live-001")
    invalid_session["mode"] = cast(LiveSessionMode, "offline")
    live_store = FakeLiveStore(sessions={"live-001": invalid_session})

    with pytest.raises(LiveUseCaseError) as error:
        get_live_session(live_store=live_store, session_id="live-001")

    assert error.value.status_code == 409
    assert error.value.detail == "Invalid live session mode: offline"


def test_list_live_sessions_rejects_invalid_persisted_status() -> None:
    invalid_session = _session(session_id="live-001")
    invalid_session["status"] = cast(LiveSessionStatus, "paused")
    live_store = FakeLiveStore(sessions={"live-001": invalid_session})

    with pytest.raises(LiveUseCaseError) as error:
        list_live_sessions(live_store=live_store, limit=10, offset=0)

    assert error.value.status_code == 409
    assert error.value.detail == "Invalid live session status: paused"


def test_get_live_session_rejects_invalid_persisted_track_source() -> None:
    live_store = FakeLiveStore(sessions={"live-001": _session(session_id="live-001")})
    live_store.create_track(
        track_id="track-001",
        session_id="live-001",
        source=cast(LiveTrackSource, "speaker"),
        label="Speaker",
        device_label="Built-in speaker",
        sample_rate=16000,
        channel_count=1,
        started_at="2026-01-01T00:00:00",
        ended_at=None,
        created_at="2026-01-01T00:00:00",
    )

    with pytest.raises(LiveUseCaseError) as error:
        get_live_session(live_store=live_store, session_id="live-001")

    assert error.value.status_code == 409
    assert error.value.detail == "Invalid live track source: speaker"


def test_finish_live_session_finishes_active_session() -> None:
    live_store = FakeLiveStore(sessions={"live-001": _session(session_id="live-001")})

    payload = finish_live_session(
        live_store=live_store,
        session_id="live-001",
        timestamp_factory=lambda: "2026-01-01T00:05:00",
    )

    assert payload["status"] == "finished"
    assert payload["ended_at"] == "2026-01-01T00:05:00"
    assert payload["segment_total"] == 0
    assert live_store.finish_calls == 1


def test_finish_live_session_returns_existing_finished_session() -> None:
    live_store = FakeLiveStore(
        sessions={"live-001": _session(session_id="live-001", status="finished")}
    )

    payload = finish_live_session(
        live_store=live_store,
        session_id="live-001",
        timestamp_factory=lambda: "2026-01-01T00:20:00",
    )

    assert payload["status"] == "finished"
    assert payload["ended_at"] == "2026-01-01T00:10:00"
    assert live_store.finish_calls == 0


def test_finish_live_session_returns_existing_failed_session() -> None:
    live_store = FakeLiveStore(
        sessions={"live-001": _session(session_id="live-001", status="failed")}
    )

    payload = finish_live_session(
        live_store=live_store,
        session_id="live-001",
        timestamp_factory=lambda: "2026-01-01T00:20:00",
    )

    assert payload["status"] == "failed"
    assert payload["error"] == "failed"
    assert live_store.finish_calls == 0


def test_finish_live_session_raises_when_missing() -> None:
    live_store = FakeLiveStore()

    with pytest.raises(LiveUseCaseError) as error:
        finish_live_session(live_store=live_store, session_id="missing")

    assert error.value.status_code == 404


def test_finish_live_session_rejects_stale_active_after_failed_transition() -> None:
    class StaleActiveStore(FakeLiveStore):
        def finish_session(
            self,
            session_id: str,
            *,
            ended_at: str,
            updated_at: str,
        ) -> LiveSessionRecord | None:
            self.finish_calls += 1
            return None

    live_store = StaleActiveStore(
        sessions={"live-001": _session(session_id="live-001", status="active")}
    )

    with pytest.raises(LiveUseCaseError) as error:
        finish_live_session(live_store=live_store, session_id="live-001")

    assert error.value.status_code == 409


def test_finish_live_session_rejects_invalid_status() -> None:
    invalid_session = _session(session_id="live-001")
    invalid_session["status"] = cast(LiveSessionStatus, "paused")
    live_store = FakeLiveStore(sessions={"live-001": invalid_session})

    with pytest.raises(LiveUseCaseError) as error:
        finish_live_session(live_store=live_store, session_id="live-001")

    assert error.value.status_code == 409
