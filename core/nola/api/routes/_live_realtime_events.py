"""Build live realtime server events for route adapters."""

from uuid import uuid4

from nola.api.schemas.live import LiveSessionDetailResponse, LiveTrackResponse
from nola.api.schemas.live_realtime import (
    LiveRealtimeAudioContract,
    LiveRealtimeDiagnosticsWavFileResponse,
    LiveRealtimeDiagnosticsWavStartedEvent,
    LiveRealtimeDiagnosticsWavStoppedEvent,
    LiveRealtimeErrorPayload,
    LiveRealtimeServerErrorEvent,
    LiveRealtimeServerPongEvent,
    LiveRealtimeServerReadyEvent,
    LiveRealtimeSessionFinishedEvent,
    LiveRealtimeTrackReadyEvent,
    LiveRealtimeTranscriptFinalEvent,
    LiveRealtimeTranscriptFinalPayload,
    LiveRealtimeTranscriptPartialEvent,
    LiveRealtimeTranscriptPartialPayload,
)
from nola.application.live._clock import now_iso
from nola.application.live.realtime import (
    LIVE_REALTIME_PROTOCOL_VERSION,
    LiveRealtimeDiagnosticsWavStarted,
    LiveRealtimeDiagnosticsWavStopped,
    LiveRealtimeErrorCode,
    LiveRealtimeTranscriptFinal,
    LiveRealtimeTranscriptPartial,
)


def build_realtime_error_event(
    *,
    session_id: str,
    code: LiveRealtimeErrorCode,
    message: str,
) -> LiveRealtimeServerErrorEvent:
    """Build one realtime protocol error event."""
    return LiveRealtimeServerErrorEvent(
        type="server.error",
        protocol_version=LIVE_REALTIME_PROTOCOL_VERSION,
        session_id=session_id,
        event_id=_server_event_id(),
        sent_at=now_iso(),
        error=LiveRealtimeErrorPayload(code=code, message=message),
    )


def build_server_ready_event(
    *,
    session_id: str,
    session: LiveSessionDetailResponse,
) -> LiveRealtimeServerReadyEvent:
    """Build a successful realtime handshake event."""
    return LiveRealtimeServerReadyEvent(
        type="server.ready",
        protocol_version=LIVE_REALTIME_PROTOCOL_VERSION,
        session_id=session_id,
        event_id=_server_event_id(),
        sent_at=now_iso(),
        audio_contract=LiveRealtimeAudioContract(),
        session=session,
    )


def build_track_ready_event(
    *,
    session_id: str,
    track: LiveTrackResponse,
) -> LiveRealtimeTrackReadyEvent:
    """Build a live track ready event."""
    return LiveRealtimeTrackReadyEvent(
        type="track.ready",
        protocol_version=LIVE_REALTIME_PROTOCOL_VERSION,
        session_id=session_id,
        event_id=_server_event_id(),
        sent_at=now_iso(),
        track=track,
    )


def build_diagnostics_wav_started_event(
    *,
    session_id: str,
    started: LiveRealtimeDiagnosticsWavStarted,
) -> LiveRealtimeDiagnosticsWavStartedEvent:
    """Build a diagnostics WAV started event."""
    return LiveRealtimeDiagnosticsWavStartedEvent(
        type="diagnostics.wav.started",
        protocol_version=LIVE_REALTIME_PROTOCOL_VERSION,
        session_id=session_id,
        event_id=_server_event_id(),
        sent_at=now_iso(),
        output_dir=started.output_dir,
        manifest_path=started.manifest_path,
        max_duration_ms=started.max_duration_ms,
        max_bytes=started.max_bytes,
        tracks=list(started.track_ids) if started.track_ids is not None else None,
    )


def build_diagnostics_wav_stopped_event(
    *,
    session_id: str,
    stopped: LiveRealtimeDiagnosticsWavStopped,
) -> LiveRealtimeDiagnosticsWavStoppedEvent:
    """Build a diagnostics WAV stopped event."""
    return LiveRealtimeDiagnosticsWavStoppedEvent(
        type="diagnostics.wav.stopped",
        protocol_version=LIVE_REALTIME_PROTOCOL_VERSION,
        session_id=session_id,
        event_id=_server_event_id(),
        sent_at=now_iso(),
        output_dir=stopped.output_dir,
        manifest_path=stopped.manifest_path,
        files=[
            LiveRealtimeDiagnosticsWavFileResponse(
                track_id=file.track_id,
                source=file.source,
                path=file.path,
                duration_ms=file.duration_ms,
                audio_byte_length=file.audio_byte_length,
                file_byte_length=file.file_byte_length,
            )
            for file in stopped.files
        ],
        total_file_byte_length=stopped.total_file_byte_length,
        reason=stopped.reason,
    )


def build_realtime_pong_event(*, session_id: str) -> LiveRealtimeServerPongEvent:
    """Build a realtime pong event."""
    return LiveRealtimeServerPongEvent(
        type="server.pong",
        protocol_version=LIVE_REALTIME_PROTOCOL_VERSION,
        session_id=session_id,
        event_id=_server_event_id(),
        sent_at=now_iso(),
    )


def build_transcript_partial_event(
    *,
    session_id: str,
    partial: LiveRealtimeTranscriptPartial,
) -> LiveRealtimeTranscriptPartialEvent:
    """Build a realtime partial transcript event."""
    return LiveRealtimeTranscriptPartialEvent(
        type="transcript.partial",
        protocol_version=LIVE_REALTIME_PROTOCOL_VERSION,
        session_id=session_id,
        event_id=_server_event_id(),
        sent_at=now_iso(),
        transcript=LiveRealtimeTranscriptPartialPayload(
            track_id=partial.track_id,
            source=partial.source,
            partial_index=partial.partial_index,
            start_ms=partial.start_ms,
            end_ms=partial.end_ms,
            text=partial.text,
            language=partial.language,
            confidence=partial.confidence,
            is_final=False,
        ),
    )


def build_transcript_final_event(
    *,
    session_id: str,
    final: LiveRealtimeTranscriptFinal,
) -> LiveRealtimeTranscriptFinalEvent:
    """Build a realtime final transcript event."""
    return LiveRealtimeTranscriptFinalEvent(
        type="transcript.final",
        protocol_version=LIVE_REALTIME_PROTOCOL_VERSION,
        session_id=session_id,
        event_id=_server_event_id(),
        sent_at=now_iso(),
        transcript=LiveRealtimeTranscriptFinalPayload(
            segment_id=final.segment_id,
            session_id=final.session_id,
            track_id=final.track_id,
            source=final.source,
            sequence=final.sequence,
            start_ms=final.start_ms,
            end_ms=final.end_ms,
            text=final.text,
            language=final.language,
            confidence=final.confidence,
            is_final=True,
            created_at=final.created_at,
        ),
    )


def build_session_finished_event(
    *,
    session_id: str,
    session: LiveSessionDetailResponse,
) -> LiveRealtimeSessionFinishedEvent:
    """Build a realtime session finished event."""
    return LiveRealtimeSessionFinishedEvent(
        type="session.finished",
        protocol_version=LIVE_REALTIME_PROTOCOL_VERSION,
        session_id=session_id,
        event_id=_server_event_id(),
        sent_at=now_iso(),
        session=session,
    )


def _server_event_id() -> str:
    return f"server-{uuid4()}"
