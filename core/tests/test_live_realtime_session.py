"""Unit tests for live realtime session runtime state."""

import pytest

from nola.application.live.realtime import (
    LIVE_REALTIME_PROTOCOL_VERSION,
    LiveRealtimeAudioFrameMetadata,
    LiveRealtimeSessionError,
    LiveRealtimeSessionRuntime,
    LiveRealtimeTrackStart,
    LiveRealtimeTrackStop,
)
from nola.application.live.types import LiveTrackSource
from tests.test_live_use_cases import FakeLiveStore, _session


def _runtime(
    *,
    live_store: FakeLiveStore,
    track_ids: list[str] | None = None,
) -> LiveRealtimeSessionRuntime:
    ids = iter(track_ids or ["track-001"])
    return LiveRealtimeSessionRuntime(
        live_store=live_store,
        session_id="live-001",
        track_id_factory=lambda: next(ids),
        timestamp_factory=lambda: "2026-01-01T00:00:00+00:00",
    )


def _start_event(source: LiveTrackSource = "microphone") -> LiveRealtimeTrackStart:
    return LiveRealtimeTrackStart(
        source=source,
        sequence=0,
        label="Mic",
        device_label=None,
        sample_rate=16000,
        channel_count=1,
    )


def test_realtime_session_rejects_track_before_hello() -> None:
    """Realtime runtime should require client.hello before track events."""
    live_store = FakeLiveStore(sessions={"live-001": _session(session_id="live-001")})
    runtime = _runtime(live_store=live_store)

    with pytest.raises(LiveRealtimeSessionError) as error:
        runtime.start_track(_start_event())

    assert error.value.code == "invalid_event_order"
    assert live_store.list_tracks("live-001") == []


def test_realtime_session_creates_microphone_and_system_tracks() -> None:
    """Realtime runtime should create source-scoped live tracks."""
    live_store = FakeLiveStore(sessions={"live-001": _session(session_id="live-001")})
    runtime = _runtime(live_store=live_store, track_ids=["track-mic", "track-system"])
    runtime.accept_hello(protocol_version=LIVE_REALTIME_PROTOCOL_VERSION)

    microphone = runtime.start_track(_start_event("microphone"))
    system = runtime.start_track(_start_event("system"))

    assert microphone["track_id"] == "track-mic"
    assert microphone["source"] == "microphone"
    assert system["track_id"] == "track-system"
    assert system["source"] == "system"
    assert runtime.active_track_count == 2


def test_realtime_session_validates_audio_sequence_and_stop_state() -> None:
    """Realtime runtime should reject repeated, skipped, and stopped writes."""
    live_store = FakeLiveStore(sessions={"live-001": _session(session_id="live-001")})
    runtime = _runtime(live_store=live_store)
    runtime.accept_hello(protocol_version=LIVE_REALTIME_PROTOCOL_VERSION)
    runtime.start_track(_start_event())
    runtime.accept_audio_frame_metadata(
        LiveRealtimeAudioFrameMetadata(
            track_id="track-001",
            source="microphone",
            sequence=0,
            captured_at_ms=0,
            duration_ms=20,
        )
    )

    with pytest.raises(LiveRealtimeSessionError) as repeated_error:
        runtime.accept_audio_frame_metadata(
            LiveRealtimeAudioFrameMetadata(
                track_id="track-001",
                source="microphone",
                sequence=0,
                captured_at_ms=20,
                duration_ms=20,
            )
        )
    with pytest.raises(LiveRealtimeSessionError) as skipped_error:
        runtime.accept_audio_frame_metadata(
            LiveRealtimeAudioFrameMetadata(
                track_id="track-001",
                source="microphone",
                sequence=2,
                captured_at_ms=20,
                duration_ms=20,
            )
        )

    stopped = runtime.stop_track(
        LiveRealtimeTrackStop(
            track_id="track-001",
            source="microphone",
            sequence=1,
        )
    )

    with pytest.raises(LiveRealtimeSessionError) as stopped_error:
        runtime.accept_audio_frame_metadata(
            LiveRealtimeAudioFrameMetadata(
                track_id="track-001",
                source="microphone",
                sequence=1,
                captured_at_ms=20,
                duration_ms=20,
            )
        )

    assert repeated_error.value.code == "audio_sequence_invalid"
    assert skipped_error.value.code == "audio_sequence_invalid"
    assert stopped_error.value.code == "invalid_track"
    assert stopped["ended_at"] == "2026-01-01T00:00:00+00:00"
    assert runtime.active_track_count == 0


def test_realtime_session_rejects_unknown_track() -> None:
    """Realtime runtime should reject audio for unknown tracks."""
    live_store = FakeLiveStore(sessions={"live-001": _session(session_id="live-001")})
    runtime = _runtime(live_store=live_store)
    runtime.accept_hello(protocol_version=LIVE_REALTIME_PROTOCOL_VERSION)

    with pytest.raises(LiveRealtimeSessionError) as error:
        runtime.accept_audio_frame_metadata(
            LiveRealtimeAudioFrameMetadata(
                track_id="missing-track",
                source="microphone",
                sequence=0,
                captured_at_ms=0,
                duration_ms=20,
            )
        )

    assert error.value.code == "invalid_track"


def test_realtime_session_finish_releases_track_state() -> None:
    """Realtime runtime should clear track state after session finish."""
    live_store = FakeLiveStore(sessions={"live-001": _session(session_id="live-001")})
    runtime = _runtime(live_store=live_store)
    runtime.accept_hello(protocol_version=LIVE_REALTIME_PROTOCOL_VERSION)
    runtime.start_track(_start_event())

    payload = runtime.finish()

    assert payload["status"] == "finished"
    assert runtime.finished_normally is True
    assert runtime.active_track_count == 0
