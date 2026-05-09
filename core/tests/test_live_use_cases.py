"""Unit tests for live transcription application use-cases."""

from datetime import datetime, timedelta
from typing import cast

import pytest

from nola.application.live import (
    create_live_session,
    fail_live_session,
    finish_live_session,
    get_live_session,
    list_live_sessions,
)
from nola.application.live.errors import LiveUseCaseError
from nola.application.live.types import (
    DEFAULT_LIVE_SEGMENT_LIMIT,
    DEFAULT_LIVE_SESSION_LIMIT,
    MAX_LIVE_SEGMENT_LIMIT,
    MAX_LIVE_SESSION_LIMIT,
    LiveSegmentRecord,
    LiveSessionMode,
    LiveSessionRecord,
    LiveSessionStatus,
    LiveTrackRecord,
    LiveTrackSource,
)
from nola.config.common.types import ConfigMap
from nola.model_hub.contracts import ModelCacheState


class FakeLiveStore:
    """In-memory live repository for use-case tests."""

    def __init__(self, sessions: dict[str, LiveSessionRecord] | None = None) -> None:
        self.sessions = sessions or {}
        self.tracks: dict[str, list[LiveTrackRecord]] = {}
        self.segments: dict[str, list[LiveSegmentRecord]] = {}
        self.created_sessions: list[LiveSessionRecord] = []
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
        runtime_config: dict[str, object] | None = None,
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
            "runtime_config": runtime_config,
            "started_at": started_at,
            "ended_at": None,
            "error": None,
            "created_at": created_at,
            "updated_at": updated_at,
        }
        self.sessions[session_id] = session
        self.created_sessions.append(session.copy())
        return session.copy()

    def get_session(self, session_id: str) -> LiveSessionRecord | None:
        session = self.sessions.get(session_id)
        return session.copy() if session else None

    def list_sessions(
        self, limit: int = DEFAULT_LIVE_SESSION_LIMIT, offset: int = 0
    ) -> list[LiveSessionRecord]:
        sessions = sorted(
            self.sessions.values(),
            key=lambda session: (session["started_at"], session["id"]),
            reverse=True,
        )
        return [session.copy() for session in sessions[offset : offset + limit]]

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
        return track.copy()

    def finish_track(
        self,
        track_id: str,
        session_id: str,
        *,
        ended_at: str,
    ) -> LiveTrackRecord | None:
        for track in self.tracks.get(session_id, []):
            if track["id"] == track_id and track["ended_at"] is None:
                track["ended_at"] = ended_at
                return track.copy()
        return None

    def list_tracks(self, session_id: str) -> list[LiveTrackRecord]:
        tracks = sorted(
            self.tracks.get(session_id, []),
            key=lambda track: (track["created_at"], track["id"]),
        )
        return [track.copy() for track in tracks]

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
        return segment.copy()

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
        return [segment.copy() for segment in segments[offset : offset + limit]]

    def count_segments(self, session_id: str) -> int:
        return len(self.segments.get(session_id, []))


class FakeConfigStore:
    """In-memory config store for Live runtime use-case tests."""

    def __init__(self, values_by_prefix: dict[str, ConfigMap]) -> None:
        self.values_by_prefix = values_by_prefix

    def get_all(self, prefix: str) -> ConfigMap:
        """Return values under one prefix."""
        return dict(self.values_by_prefix.get(prefix, {}))


class FakeModelStorage:
    """Expose downloaded model state for Live runtime use-case tests."""

    def get_cache_state(self, repo_id: str) -> ModelCacheState:
        """Return downloaded for registered test models."""
        assert repo_id
        return "downloaded"


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
        "runtime_config": None,
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
        runtime_config={"schema_version": 1, "runtime": "mock"},
        session_id_factory=lambda: "live-001",
        timestamp_factory=lambda: "2026-01-01T00:00:00",
    )

    assert payload["session_id"] == "live-001"
    assert payload["title"] == "Planning"
    assert payload["mode"] == "background"
    assert payload["status"] == "active"
    assert payload["language_hint"] == "zh"
    assert payload["model_id"] == "small"
    assert payload["runtime_config"] == {"schema_version": 1, "runtime": "mock"}
    assert payload["tracks"] == []
    assert payload["segments"] == []
    assert payload["segment_total"] == 0
    assert payload["segment_limit"] == DEFAULT_LIVE_SEGMENT_LIMIT
    assert payload["segment_offset"] == 0
    assert live_store.created_sessions[0]["started_at"] == "2026-01-01T00:00:00"
    assert live_store.created_sessions[0]["runtime_config"] == {
        "schema_version": 1,
        "runtime": "mock",
    }


def test_create_live_session_requires_config_store_for_runtime_overrides() -> None:
    live_store = FakeLiveStore()

    with pytest.raises(ValueError, match="config_store is required"):
        create_live_session(
            live_store=live_store,
            title="Planning",
            mode="streaming",
            language_hint="zh",
            model_id="small",
            runtime_overrides={"language": "en", "context_prompt": None},
            session_id_factory=lambda: "live-overrides",
            timestamp_factory=lambda: "2026-01-01T00:00:00",
        )

    assert live_store.created_sessions == []


def test_create_live_session_resolves_runtime_config_before_writing() -> None:
    live_store = FakeLiveStore()

    payload = create_live_session(
        live_store=live_store,
        title="Planning",
        mode="streaming",
        language_hint="zh",
        model_id="small",
        runtime_overrides={"language": "en", "beam_size": 3},
        runtime_adapter="whisper_streaming",
        config_store=FakeConfigStore({"live_realtime.": {"beam_size": 2}}),
        model_storage=FakeModelStorage(),
        session_id_factory=lambda: "live-runtime",
        timestamp_factory=lambda: "2026-01-01T00:00:00",
    )

    stored = live_store.created_sessions[0]
    assert payload["session_id"] == "live-runtime"
    assert payload["runtime"] == "whisper_streaming"
    assert payload["model_id"] == "small"
    assert payload["runtime_config"]["language"] == "en"
    assert payload["runtime_config"]["faster_whisper"]["beam_size"] == 3
    assert stored["runtime"] == "whisper_streaming"
    assert stored["audio_format"] == "pcm_s16le_16khz_mono"
    assert stored["runtime_config"] == payload["runtime_config"]


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


def test_create_live_session_uses_utc_timestamp_by_default() -> None:
    live_store = FakeLiveStore()

    create_live_session(
        live_store=live_store,
        title=None,
        mode="streaming",
        language_hint=None,
        model_id=None,
        session_id_factory=lambda: "live-utc",
    )

    started_at = live_store.created_sessions[0]["started_at"]
    timestamp = datetime.fromisoformat(started_at)

    assert timestamp.utcoffset() == timedelta(0)
    assert live_store.created_sessions[0]["created_at"] == started_at
    assert live_store.created_sessions[0]["updated_at"] == started_at


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


def test_list_live_sessions_rejects_invalid_pagination() -> None:
    live_store = FakeLiveStore()

    with pytest.raises(LiveUseCaseError) as limit_error:
        list_live_sessions(live_store=live_store, limit=0, offset=0)

    with pytest.raises(LiveUseCaseError) as max_limit_error:
        list_live_sessions(
            live_store=live_store,
            limit=MAX_LIVE_SESSION_LIMIT + 1,
            offset=0,
        )

    with pytest.raises(LiveUseCaseError) as offset_error:
        list_live_sessions(live_store=live_store, limit=10, offset=-1)

    assert limit_error.value.status_code == 422
    assert max_limit_error.value.status_code == 422
    assert offset_error.value.status_code == 422


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


def test_get_live_session_returns_tracks_in_created_order() -> None:
    live_store = FakeLiveStore(sessions={"live-001": _session(session_id="live-001")})
    live_store.create_track(
        track_id="track-new",
        session_id="live-001",
        source="system",
        label="System",
        device_label="System audio",
        sample_rate=48000,
        channel_count=2,
        started_at="2026-01-01T00:00:02",
        ended_at=None,
        created_at="2026-01-01T00:00:02",
    )
    live_store.create_track(
        track_id="track-old",
        session_id="live-001",
        source="microphone",
        label="Mic",
        device_label="Built-in microphone",
        sample_rate=16000,
        channel_count=1,
        started_at="2026-01-01T00:00:01",
        ended_at=None,
        created_at="2026-01-01T00:00:01",
    )

    payload = get_live_session(live_store=live_store, session_id="live-001")

    assert [track["track_id"] for track in payload["tracks"]] == [
        "track-old",
        "track-new",
    ]


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


def test_fail_live_session_fails_active_session() -> None:
    live_store = FakeLiveStore(sessions={"live-001": _session(session_id="live-001")})

    payload = fail_live_session(
        live_store=live_store,
        session_id="live-001",
        error="connection_closed",
        timestamp_factory=lambda: "2026-01-01T00:05:00",
    )

    assert payload["status"] == "failed"
    assert payload["error"] == "connection_closed"
    assert payload["ended_at"] == "2026-01-01T00:05:00"


def test_fail_live_session_returns_existing_terminal_session() -> None:
    live_store = FakeLiveStore(
        sessions={"live-001": _session(session_id="live-001", status="finished")}
    )

    payload = fail_live_session(
        live_store=live_store,
        session_id="live-001",
        error="connection_closed",
        timestamp_factory=lambda: "2026-01-01T00:20:00",
    )

    assert payload["status"] == "finished"
    assert payload["ended_at"] == "2026-01-01T00:10:00"


def test_fail_live_session_raises_when_missing() -> None:
    live_store = FakeLiveStore()

    with pytest.raises(LiveUseCaseError) as error:
        fail_live_session(
            live_store=live_store,
            session_id="missing",
            error="connection_closed",
        )

    assert error.value.status_code == 404
