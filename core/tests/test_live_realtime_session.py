"""Unit tests for live realtime session runtime state."""

from pathlib import Path

import pytest

from nola.application.live.realtime import (
    LIVE_REALTIME_PROTOCOL_VERSION,
    LiveRealtimeAudioFrameMetadata,
    LiveRealtimeDiagnosticsWavStart,
    LiveRealtimeSessionError,
    LiveRealtimeSessionRuntime,
    LiveRealtimeTrackStart,
    LiveRealtimeTrackStop,
    LiveRealtimeTranscriberFrame,
    LiveRealtimeTranscriberResult,
    LiveRealtimeTranscriptFinal,
    LiveRealtimeTranscriptPartial,
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


def _audio_metadata(
    *,
    track_id: str = "track-001",
    source: LiveTrackSource = "microphone",
    sequence: int = 0,
    captured_at_ms: int = 0,
    duration_ms: int = 20,
    byte_length: int = 640,
) -> LiveRealtimeAudioFrameMetadata:
    return LiveRealtimeAudioFrameMetadata(
        track_id=track_id,
        source=source,
        sequence=sequence,
        captured_at_ms=captured_at_ms,
        duration_ms=duration_ms,
        byte_length=byte_length,
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
    runtime.accept_audio_frame(_audio_metadata(), b"\x00" * 640)

    with pytest.raises(LiveRealtimeSessionError) as repeated_error:
        runtime.accept_audio_frame(
            _audio_metadata(sequence=0, captured_at_ms=20),
            b"\x00" * 640,
        )
    with pytest.raises(LiveRealtimeSessionError) as skipped_error:
        runtime.accept_audio_frame(
            _audio_metadata(sequence=2, captured_at_ms=20),
            b"\x00" * 640,
        )

    stopped = runtime.stop_track(
        LiveRealtimeTrackStop(
            track_id="track-001",
            source="microphone",
            sequence=1,
        )
    )

    with pytest.raises(LiveRealtimeSessionError) as stopped_error:
        runtime.accept_audio_frame(
            _audio_metadata(sequence=1, captured_at_ms=20),
            b"\x00" * 640,
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
        runtime.accept_audio_frame(
            _audio_metadata(track_id="missing-track"),
            b"\x00" * 640,
        )

    assert error.value.code == "invalid_track"


def test_realtime_session_finish_releases_track_state() -> None:
    """Realtime runtime should clear track state after session finish."""
    live_store = FakeLiveStore(sessions={"live-001": _session(session_id="live-001")})
    runtime = _runtime(live_store=live_store)
    runtime.accept_hello(protocol_version=LIVE_REALTIME_PROTOCOL_VERSION)
    runtime.start_track(_start_event())

    payload = runtime.finish()
    tracks = live_store.list_tracks("live-001")

    assert payload["status"] == "finished"
    assert payload["ended_at"] == "2026-01-01T00:00:00+00:00"
    assert payload["tracks"][0]["ended_at"] == "2026-01-01T00:00:00+00:00"
    assert tracks[0]["ended_at"] == "2026-01-01T00:00:00+00:00"
    assert runtime.finished_normally is True
    assert runtime.active_track_count == 0


def test_realtime_session_rejects_invalid_pcm_frame_before_state_update() -> None:
    """Realtime runtime should not advance sequence after invalid PCM data."""
    live_store = FakeLiveStore(sessions={"live-001": _session(session_id="live-001")})
    runtime = _runtime(live_store=live_store)
    runtime.accept_hello(protocol_version=LIVE_REALTIME_PROTOCOL_VERSION)
    runtime.start_track(_start_event())

    with pytest.raises(LiveRealtimeSessionError) as error:
        runtime.accept_audio_frame(_audio_metadata(byte_length=640), b"\x00" * 638)

    runtime.accept_audio_frame(_audio_metadata(byte_length=640), b"\x00" * 640)

    assert error.value.code == "audio_frame_invalid"


def test_realtime_session_keeps_wav_diagnostics_off_by_default(
    tmp_path: Path,
) -> None:
    """Realtime runtime should not write WAV diagnostics unless explicitly started."""
    output_dir = tmp_path / "diagnostics"
    repository_root = tmp_path / "repo"
    live_store = FakeLiveStore(sessions={"live-001": _session(session_id="live-001")})
    runtime = LiveRealtimeSessionRuntime(
        live_store=live_store,
        session_id="live-001",
        track_id_factory=lambda: "track-001",
        timestamp_factory=lambda: "2026-01-01T00:00:00+00:00",
        diagnostics_output_dir=output_dir,
        repository_root=repository_root,
    )
    runtime.accept_hello(protocol_version=LIVE_REALTIME_PROTOCOL_VERSION)
    runtime.start_track(_start_event())

    runtime.accept_audio_frame(_audio_metadata(), b"\x00" * 640)

    assert not output_dir.exists()


def test_realtime_session_writes_explicit_wav_diagnostics(tmp_path: Path) -> None:
    """Realtime runtime should write track-scoped WAV diagnostics when enabled."""
    output_dir = tmp_path / "diagnostics"
    repository_root = tmp_path / "repo"
    live_store = FakeLiveStore(sessions={"live-001": _session(session_id="live-001")})
    runtime = LiveRealtimeSessionRuntime(
        live_store=live_store,
        session_id="live-001",
        track_id_factory=lambda: "track-001",
        timestamp_factory=lambda: "2026-01-01T00:00:00+00:00",
        diagnostics_output_dir=output_dir,
        repository_root=repository_root,
    )
    runtime.accept_hello(protocol_version=LIVE_REALTIME_PROTOCOL_VERSION)
    runtime.start_track(_start_event())

    started = runtime.start_diagnostics_wav(
        LiveRealtimeDiagnosticsWavStart(
            max_duration_ms=1000,
            max_bytes=4096,
            track_ids=None,
        )
    )
    runtime.accept_audio_frame(_audio_metadata(), b"\x00" * 640)
    stopped = runtime.stop_diagnostics_wav(reason="client_stop")

    assert started.capture_id.startswith("live-001-")
    assert started.manifest_name == "manifest.json"
    assert started.manifest_path.endswith("manifest.json")
    assert stopped.reason == "client_stop"
    assert stopped.capture_id == started.capture_id
    assert stopped.manifest_name == "manifest.json"
    assert len(stopped.files) == 1
    assert stopped.files[0].track_id == "track-001"
    assert stopped.files[0].file_name == "track-001-microphone.wav"
    assert stopped.files[0].duration_ms == 20


def test_realtime_session_uses_unique_wav_diagnostics_directories(
    tmp_path: Path,
) -> None:
    """Realtime runtime should isolate repeated diagnostics captures."""
    output_dir = tmp_path / "diagnostics"
    repository_root = tmp_path / "repo"
    live_store = FakeLiveStore(sessions={"live-001": _session(session_id="live-001")})
    runtime = LiveRealtimeSessionRuntime(
        live_store=live_store,
        session_id="live-001",
        track_id_factory=lambda: "track-001",
        timestamp_factory=lambda: "2026-01-01T00:00:00+00:00",
        diagnostics_output_dir=output_dir,
        repository_root=repository_root,
    )
    runtime.accept_hello(protocol_version=LIVE_REALTIME_PROTOCOL_VERSION)
    runtime.start_track(_start_event())

    first_started = runtime.start_diagnostics_wav(
        LiveRealtimeDiagnosticsWavStart(
            max_duration_ms=1000,
            max_bytes=4096,
            track_ids=None,
        )
    )
    first_stopped = runtime.stop_diagnostics_wav(reason="client_stop")
    second_started = runtime.start_diagnostics_wav(
        LiveRealtimeDiagnosticsWavStart(
            max_duration_ms=1000,
            max_bytes=4096,
            track_ids=None,
        )
    )
    second_stopped = runtime.stop_diagnostics_wav(reason="client_stop")

    assert first_started.capture_id != second_started.capture_id
    assert first_stopped.output_dir != second_stopped.output_dir
    assert Path(first_stopped.manifest_path).exists()
    assert Path(second_stopped.manifest_path).exists()


def test_realtime_session_stops_wav_diagnostics_on_limit_without_failing(
    tmp_path: Path,
) -> None:
    """Realtime runtime should stop optional diagnostics when limits are reached."""
    output_dir = tmp_path / "diagnostics"
    repository_root = tmp_path / "repo"
    live_store = FakeLiveStore(sessions={"live-001": _session(session_id="live-001")})
    runtime = LiveRealtimeSessionRuntime(
        live_store=live_store,
        session_id="live-001",
        track_id_factory=lambda: "track-001",
        timestamp_factory=lambda: "2026-01-01T00:00:00+00:00",
        diagnostics_output_dir=output_dir,
        repository_root=repository_root,
    )
    runtime.accept_hello(protocol_version=LIVE_REALTIME_PROTOCOL_VERSION)
    runtime.start_track(_start_event())
    runtime.start_diagnostics_wav(
        LiveRealtimeDiagnosticsWavStart(
            max_duration_ms=20,
            max_bytes=4096,
            track_ids=None,
        )
    )

    first_result = runtime.accept_audio_frame(_audio_metadata(), b"\x00" * 640)
    second_result = runtime.accept_audio_frame(
        _audio_metadata(sequence=1, captured_at_ms=20),
        b"\x00" * 640,
    )
    third_result = runtime.accept_audio_frame(
        _audio_metadata(sequence=2, captured_at_ms=40),
        b"\x00" * 640,
    )

    assert first_result.diagnostics_wav_stopped is None
    assert second_result.diagnostics_wav_stopped is not None
    assert second_result.diagnostics_wav_stopped.reason == "limit_exceeded"
    assert third_result.diagnostics_wav_stopped is None
    assert runtime.diagnostics_wav_active is False
    assert runtime.active_track_count == 1


def test_realtime_session_release_is_idempotent() -> None:
    """Realtime runtime should release transcriber state once."""
    live_store = FakeLiveStore(sessions={"live-001": _session(session_id="live-001")})
    transcriber = _CountingTranscriber()
    runtime = LiveRealtimeSessionRuntime(
        live_store=live_store,
        session_id="live-001",
        track_id_factory=lambda: "track-001",
        timestamp_factory=lambda: "2026-01-01T00:00:00+00:00",
        transcriber=transcriber,
    )
    runtime.accept_hello(protocol_version=LIVE_REALTIME_PROTOCOL_VERSION)
    runtime.start_track(_start_event())

    runtime.finish()
    runtime.release()

    assert transcriber.release_count == 1


def test_realtime_session_emits_mock_transcripts_and_persists_final() -> None:
    """Realtime runtime should send partials and persist final transcript segments."""
    live_store = FakeLiveStore(sessions={"live-001": _session(session_id="live-001")})
    runtime = LiveRealtimeSessionRuntime(
        live_store=live_store,
        session_id="live-001",
        track_id_factory=lambda: "track-001",
        segment_id_factory=lambda: "segment-001",
        timestamp_factory=lambda: "2026-01-01T00:00:00+00:00",
    )
    runtime.accept_hello(protocol_version=LIVE_REALTIME_PROTOCOL_VERSION)
    runtime.start_track(_start_event())

    partial_events = tuple(
        event
        for sequence in range(25)
        for event in runtime.accept_audio_frame(
            _audio_metadata(
                sequence=sequence,
                captured_at_ms=sequence * 20,
            ),
            b"\x00" * 640,
        ).transcript_events
    )
    assert live_store.count_segments("live-001") == 0

    final_events = tuple(
        event
        for sequence in range(25, 50)
        for event in runtime.accept_audio_frame(
            _audio_metadata(
                sequence=sequence,
                captured_at_ms=sequence * 20,
            ),
            b"\x00" * 640,
        ).transcript_events
    )

    assert len(partial_events) == 1
    assert isinstance(partial_events[0], LiveRealtimeTranscriptPartial)
    assert partial_events[0].text == "Mock microphone partial 1"

    assert len(final_events) == 1
    assert isinstance(final_events[0], LiveRealtimeTranscriptFinal)
    assert final_events[0].segment_id == "segment-001"
    assert final_events[0].sequence == 1
    assert final_events[0].start_ms == 0
    assert final_events[0].end_ms == 1000
    assert final_events[0].text == "Mock microphone segment 1"
    assert live_store.count_segments("live-001") == 1


class _CountingTranscriber:
    def __init__(self) -> None:
        self.release_count = 0

    def accept_frame(
        self,
        _frame: LiveRealtimeTranscriberFrame,
    ) -> tuple[LiveRealtimeTranscriberResult, ...]:
        return ()

    def release(self) -> None:
        self.release_count += 1
