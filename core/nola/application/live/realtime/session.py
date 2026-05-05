"""Manage one live realtime session runtime."""

from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from uuid import uuid4

from nola.application.live._clock import now_iso
from nola.application.live.actions import fail_live_session, finish_live_session
from nola.application.live.contracts import SupportsLiveRepository
from nola.application.live.payloads import to_live_track_payload
from nola.application.live.realtime.audio import (
    LiveRealtimeAudioFrameMetadata,
    LiveRealtimePcm16Frame,
    build_pcm16le_frame,
    validate_pcm16le_frame_metadata,
)
from nola.application.live.realtime.diagnostics import (
    LiveRealtimeDiagnosticsWavStart,
    LiveRealtimeDiagnosticsWavStarted,
    LiveRealtimeDiagnosticsWavStopped,
    LiveRealtimeDiagnosticsWavStopReason,
    LiveRealtimeWavDiagnosticsSession,
)
from nola.application.live.realtime.errors import LiveRealtimeSessionError
from nola.application.live.realtime.protocol import (
    LIVE_REALTIME_SUPPORTED_PROTOCOL_VERSIONS,
)
from nola.application.live.types import (
    LiveSessionPayload,
    LiveTrackPayload,
    LiveTrackSource,
)


@dataclass(frozen=True)
class LiveRealtimeTrackStart:
    """Carry one track start command."""

    source: LiveTrackSource
    sequence: int
    label: str | None
    device_label: str | None
    sample_rate: int | None
    channel_count: int | None


@dataclass(frozen=True)
class LiveRealtimeTrackStop:
    """Carry one track stop command."""

    track_id: str
    source: LiveTrackSource
    sequence: int


@dataclass
class _LiveRealtimeTrackState:
    """Track connection-local audio ordering state."""

    source: LiveTrackSource
    started_at: str
    next_sequence: int = 0
    first_frame_start_ms: int | None = None
    last_frame_end_ms: int | None = None
    total_duration_ms: int = 0


class LiveRealtimeSessionRuntime:
    """Coordinate one live realtime connection state machine."""

    def __init__(
        self,
        *,
        live_store: SupportsLiveRepository,
        session_id: str,
        track_id_factory: Callable[[], str] | None = None,
        timestamp_factory: Callable[[], str] | None = None,
        diagnostics_output_dir: Path | None = None,
        repository_root: Path | None = None,
    ) -> None:
        self._live_store = live_store
        self._session_id = session_id
        self._track_id_factory = track_id_factory or self._default_track_id
        self._timestamp_factory = timestamp_factory or now_iso
        self._diagnostics_output_dir = diagnostics_output_dir
        self._repository_root = repository_root
        self._handshake_complete = False
        self._finished_normally = False
        self._tracks: dict[str, _LiveRealtimeTrackState] = {}
        self._diagnostics_wav: LiveRealtimeWavDiagnosticsSession | None = None

    @property
    def handshake_complete(self) -> bool:
        """Return whether the client handshake has completed."""
        return self._handshake_complete

    @property
    def finished_normally(self) -> bool:
        """Return whether the session ended through session.finish."""
        return self._finished_normally

    @property
    def active_track_count(self) -> int:
        """Return the number of open track buffers."""
        return len(self._tracks)

    @property
    def diagnostics_wav_active(self) -> bool:
        """Return whether explicit WAV diagnostics capture is active."""
        return self._diagnostics_wav is not None and self._diagnostics_wav.active

    def accept_hello(self, *, protocol_version: int) -> None:
        """Accept the initial client handshake."""
        if self._handshake_complete:
            raise LiveRealtimeSessionError(
                code="invalid_event_order",
                message="Client hello has already completed",
            )
        if protocol_version not in LIVE_REALTIME_SUPPORTED_PROTOCOL_VERSIONS:
            raise LiveRealtimeSessionError(
                code="protocol_version_unsupported",
                message="Realtime protocol version is not supported",
            )
        self._handshake_complete = True

    def ensure_protocol_version(self, *, protocol_version: int) -> None:
        """Validate one client event protocol version."""
        if protocol_version not in LIVE_REALTIME_SUPPORTED_PROTOCOL_VERSIONS:
            raise LiveRealtimeSessionError(
                code="protocol_version_unsupported",
                message="Realtime protocol version is not supported",
            )

    def start_track(self, event: LiveRealtimeTrackStart) -> LiveTrackPayload:
        """Create one live track and start tracking frame order."""
        self._ensure_ready()
        if event.sequence != 0:
            raise LiveRealtimeSessionError(
                code="audio_sequence_invalid",
                message="Track start sequence must be 0",
            )

        track_id = self._track_id_factory()
        now = self._timestamp_factory()
        try:
            track = self._live_store.create_track(
                track_id=track_id,
                session_id=self._session_id,
                source=event.source,
                label=event.label,
                device_label=event.device_label,
                sample_rate=event.sample_rate,
                channel_count=event.channel_count,
                started_at=now,
                ended_at=None,
                created_at=now,
            )
        except Exception as error:
            raise LiveRealtimeSessionError(
                code="repository_write_failed",
                message="Live track could not be created",
            ) from error

        self._tracks[track_id] = _LiveRealtimeTrackState(
            source=event.source,
            started_at=now,
        )
        return to_live_track_payload(track)

    def accept_audio_frame(
        self,
        event: LiveRealtimeAudioFrameMetadata,
        payload: bytes,
    ) -> LiveRealtimePcm16Frame:
        """Validate one audio frame payload and update track state."""
        state = self._get_expected_audio_track(event)
        frame = build_pcm16le_frame(metadata=event, payload=payload)

        if self._diagnostics_wav is not None:
            self._diagnostics_wav.record_frame(frame)

        self._commit_audio_frame_metadata(state, event)
        return frame

    def _commit_audio_frame_metadata(
        self,
        state: _LiveRealtimeTrackState,
        event: LiveRealtimeAudioFrameMetadata,
    ) -> None:
        if state.first_frame_start_ms is None:
            state.first_frame_start_ms = event.captured_at_ms
        state.last_frame_end_ms = event.captured_at_ms + event.duration_ms
        state.total_duration_ms += event.duration_ms
        state.next_sequence += 1

    def validate_audio_frame_metadata(
        self,
        event: LiveRealtimeAudioFrameMetadata,
    ) -> None:
        """Validate one audio frame metadata event without mutating state."""
        self._get_expected_audio_track(event)
        validate_pcm16le_frame_metadata(event)

    def start_diagnostics_wav(
        self,
        event: LiveRealtimeDiagnosticsWavStart,
    ) -> LiveRealtimeDiagnosticsWavStarted:
        """Start explicit real-capture WAV diagnostics."""
        self._ensure_ready()
        if self._diagnostics_wav is not None and self._diagnostics_wav.active:
            raise LiveRealtimeSessionError(
                code="diagnostics_wav_already_started",
                message="Diagnostics WAV capture is already active",
            )
        if event.track_ids is not None:
            missing_track_ids = [
                track_id for track_id in event.track_ids if track_id not in self._tracks
            ]
            if missing_track_ids:
                raise LiveRealtimeSessionError(
                    code="invalid_track",
                    message="Diagnostics WAV track is not active",
                )

        self._diagnostics_wav = LiveRealtimeWavDiagnosticsSession.start(
            session_id=self._session_id,
            output_base_dir=self._diagnostics_output_dir,
            repository_root=self._repository_root,
            command=event,
        )
        return self._diagnostics_wav.started_event()

    def stop_diagnostics_wav(
        self,
        *,
        reason: LiveRealtimeDiagnosticsWavStopReason,
    ) -> LiveRealtimeDiagnosticsWavStopped:
        """Stop explicit real-capture WAV diagnostics."""
        self._ensure_ready()
        if self._diagnostics_wav is None or not self._diagnostics_wav.active:
            raise LiveRealtimeSessionError(
                code="diagnostics_wav_not_started",
                message="Diagnostics WAV capture is not active",
            )

        stopped = self._diagnostics_wav.stop(reason=reason)
        self._diagnostics_wav = None
        return stopped

    def _get_expected_audio_track(
        self,
        event: LiveRealtimeAudioFrameMetadata,
    ) -> _LiveRealtimeTrackState:
        """Return the writable track state for the expected frame sequence."""
        self._ensure_ready()
        state = self._get_writable_track(event.track_id, event.source)
        self._ensure_expected_sequence(state, event.sequence)
        return state

    def stop_track(self, event: LiveRealtimeTrackStop) -> LiveTrackPayload:
        """Stop one live track and persist its end timestamp."""
        self._ensure_ready()
        state = self._get_writable_track(event.track_id, event.source)
        self._ensure_expected_sequence(state, event.sequence)

        now = self._timestamp_factory()
        try:
            track = self._live_store.finish_track(
                event.track_id,
                self._session_id,
                ended_at=now,
            )
        except Exception as error:
            raise LiveRealtimeSessionError(
                code="repository_write_failed",
                message="Live track could not be stopped",
            ) from error

        if track is None:
            raise LiveRealtimeSessionError(
                code="invalid_track",
                message="Live track is not active",
            )

        self._tracks.pop(event.track_id, None)
        return to_live_track_payload(track)

    def finish(self) -> LiveSessionPayload:
        """Finish the live session and release connection-local buffers."""
        self._ensure_ready()
        if self._diagnostics_wav is not None and self._diagnostics_wav.active:
            self._diagnostics_wav.close_silently(reason="session_finish")
            self._diagnostics_wav = None
        payload = finish_live_session(
            live_store=self._live_store,
            session_id=self._session_id,
        )
        self._finished_normally = True
        self.release()
        return payload

    def fail_after_disconnect(self) -> None:
        """Fail one handshaked session after an unexpected disconnect."""
        if self._handshake_complete and not self._finished_normally:
            fail_live_session(
                live_store=self._live_store,
                session_id=self._session_id,
                error="connection_closed",
            )
        self.release()

    def release(self) -> None:
        """Clear connection-local track buffers."""
        if self._diagnostics_wav is not None and self._diagnostics_wav.active:
            self._diagnostics_wav.close_silently(reason="connection_closed")
            self._diagnostics_wav = None
        self._tracks.clear()

    def _ensure_ready(self) -> None:
        if not self._handshake_complete:
            raise LiveRealtimeSessionError(
                code="invalid_event_order",
                message="Client hello must complete before this event",
            )
        if self._finished_normally:
            raise LiveRealtimeSessionError(
                code="invalid_event_order",
                message="Live session has already finished",
            )

    def _get_writable_track(
        self,
        track_id: str,
        source: LiveTrackSource,
    ) -> _LiveRealtimeTrackState:
        state = self._tracks.get(track_id)
        if state is None:
            raise LiveRealtimeSessionError(
                code="invalid_track",
                message="Live track is not active",
            )
        if state.source != source:
            raise LiveRealtimeSessionError(
                code="invalid_track",
                message="Live track source does not match",
            )
        return state

    def _ensure_expected_sequence(
        self,
        state: _LiveRealtimeTrackState,
        sequence: int,
    ) -> None:
        if sequence != state.next_sequence:
            raise LiveRealtimeSessionError(
                code="audio_sequence_invalid",
                message="Live track sequence is out of order",
            )

    @staticmethod
    def _default_track_id() -> str:
        return str(uuid4())
