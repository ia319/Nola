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
    LiveRealtimeTranscriptCommittedPartialEvent,
    LiveRealtimeTranscriptCommittedPartialPayload,
    LiveRealtimeTranscriptFinalEvent,
    LiveRealtimeTranscriptFinalPayload,
    LiveRealtimeTranscriptPreviewEvent,
    LiveRealtimeTranscriptPreviewPayload,
)
from nola.application.live._clock import now_iso
from nola.application.live.realtime import (
    LIVE_REALTIME_PROTOCOL_VERSION,
    LiveRealtimeDiagnosticsWavStarted,
    LiveRealtimeDiagnosticsWavStopped,
    LiveRealtimeErrorCode,
    LiveRealtimeTranscriptCommittedPartial,
    LiveRealtimeTranscriptFinal,
    LiveRealtimeTranscriptPreview,
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
        capture_id=started.capture_id,
        manifest_name=started.manifest_name,
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
        capture_id=stopped.capture_id,
        manifest_name=stopped.manifest_name,
        files=[
            LiveRealtimeDiagnosticsWavFileResponse(
                track_id=file.track_id,
                source=file.source,
                file_name=file.file_name,
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


def build_transcript_preview_event(
    *,
    session_id: str,
    preview: LiveRealtimeTranscriptPreview,
) -> LiveRealtimeTranscriptPreviewEvent:
    """Build a realtime preview transcript event."""
    return LiveRealtimeTranscriptPreviewEvent(
        type="transcript.preview",
        protocol_version=LIVE_REALTIME_PROTOCOL_VERSION,
        session_id=session_id,
        event_id=_server_event_id(),
        sent_at=now_iso(),
        transcript=LiveRealtimeTranscriptPreviewPayload(
            session_id=session_id,
            track_id=preview.track_id,
            source=preview.source,
            preview_index=preview.preview_index,
            start_ms=preview.start_ms,
            end_ms=preview.end_ms,
            text=preview.text,
            language=preview.language,
            confidence=preview.confidence,
            is_final=False,
        ),
    )


def build_transcript_committed_partial_event(
    *,
    session_id: str,
    committed_partial: LiveRealtimeTranscriptCommittedPartial,
) -> LiveRealtimeTranscriptCommittedPartialEvent:
    """Build a realtime committed partial transcript event."""
    return LiveRealtimeTranscriptCommittedPartialEvent(
        type="transcript.committed_partial",
        protocol_version=LIVE_REALTIME_PROTOCOL_VERSION,
        session_id=session_id,
        event_id=_server_event_id(),
        sent_at=now_iso(),
        transcript=LiveRealtimeTranscriptCommittedPartialPayload(
            session_id=session_id,
            track_id=committed_partial.track_id,
            source=committed_partial.source,
            committed_index=committed_partial.committed_index,
            start_ms=committed_partial.start_ms,
            end_ms=committed_partial.end_ms,
            text=committed_partial.text,
            language=committed_partial.language,
            confidence=committed_partial.confidence,
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
            result_kind="final",
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
