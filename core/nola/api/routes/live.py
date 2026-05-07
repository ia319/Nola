"""Live transcription REST and realtime endpoints."""

from json import JSONDecodeError
from pathlib import Path
from typing import Annotated, NoReturn, TypeAlias

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket
from pydantic import ValidationError
from starlette.websockets import WebSocketDisconnect

from nola.api.deps import (
    get_live_db,
    get_live_diagnostics_output_dir,
    get_live_stream_connection_registry,
)
from nola.api.routes._live_realtime_events import (
    build_diagnostics_wav_started_event,
    build_diagnostics_wav_stopped_event,
    build_realtime_error_event,
    build_realtime_pong_event,
    build_server_ready_event,
    build_session_finished_event,
    build_track_ready_event,
    build_transcript_committed_partial_event,
    build_transcript_final_event,
    build_transcript_preview_event,
)
from nola.api.schemas import (
    CreateLiveSessionRequest,
    LiveRealtimeAudioFrameMetadataEvent,
    LiveRealtimeClientHelloEvent,
    LiveRealtimeClientPingEvent,
    LiveRealtimeDiagnosticsWavStopEvent,
    LiveRealtimeEventEnvelope,
    LiveRealtimeSessionFinishEvent,
    LiveRealtimeTrackStartEvent,
    LiveRealtimeTrackStopEvent,
    LiveSessionDetailResponse,
    LiveSessionListResponse,
    LiveTrackResponse,
)
from nola.api.schemas.live_realtime import LiveRealtimeDiagnosticsWavStartEvent
from nola.application.live import (
    DEFAULT_LIVE_SEGMENT_LIMIT,
    DEFAULT_LIVE_SESSION_LIMIT,
    MAX_LIVE_SEGMENT_LIMIT,
    MAX_LIVE_SESSION_LIMIT,
    LiveSessionListPayload,
    LiveSessionPayload,
    LiveUseCaseError,
    SupportsLiveRepository,
    create_live_session,
    finish_live_session,
    get_live_session,
    list_live_sessions,
)
from nola.application.live.realtime import (
    LiveRealtimeAudioFrameMetadata,
    LiveRealtimeDiagnosticsWavStart,
    LiveRealtimeErrorCode,
    LiveRealtimeSessionError,
    LiveRealtimeSessionRuntime,
    LiveRealtimeTrackStart,
    LiveRealtimeTrackStop,
    LiveRealtimeTranscriptCommittedPartial,
    LiveRealtimeTranscriptPreview,
    LiveStreamConnectionRegistry,
    ensure_pcm16le_contract,
)
from nola.application.live.values import ensure_live_session_status
from nola.common.types import JsonValue

router = APIRouter(prefix="/api/live", tags=["live"])
LiveStoreDependency: TypeAlias = Annotated[SupportsLiveRepository, Depends(get_live_db)]
LiveStreamRegistryDependency: TypeAlias = Annotated[
    LiveStreamConnectionRegistry,
    Depends(get_live_stream_connection_registry),
]
LiveDiagnosticsOutputDependency: TypeAlias = Annotated[
    Path,
    Depends(get_live_diagnostics_output_dir),
]

LIVE_REALTIME_CLOSE_NORMAL = 1000
LIVE_REALTIME_CLOSE_POLICY = 1008
LIVE_REALTIME_CLOSE_NOT_FOUND = 4404
LIVE_REALTIME_CLOSE_CONFLICT = 4409


def _raise_live_http_error(error: LiveUseCaseError) -> NoReturn:
    """Raise an HTTPException from a live use-case error."""
    raise HTTPException(status_code=error.status_code, detail=error.detail) from error


async def _send_realtime_error(
    websocket: WebSocket,
    *,
    session_id: str,
    code: LiveRealtimeErrorCode,
    message: str,
) -> None:
    """Send one realtime protocol error event."""
    event = build_realtime_error_event(
        session_id=session_id,
        code=code,
        message=message,
    )
    await websocket.send_json(event.model_dump(mode="json"))


async def _receive_realtime_json(websocket: WebSocket) -> JsonValue:
    """Receive one client JSON event and normalize malformed JSON."""
    try:
        event: JsonValue = await websocket.receive_json()
        return event
    except JSONDecodeError as error:
        raise LiveRealtimeSessionError(
            code="invalid_event",
            message="Realtime event payload is invalid JSON",
        ) from error
    except KeyError as error:
        raise LiveRealtimeSessionError(
            code="invalid_event",
            message="Realtime event must be sent as a JSON text frame",
        ) from error


async def _receive_audio_payload(websocket: WebSocket) -> bytes:
    """Require the binary payload that follows audio.frame metadata."""
    message = await websocket.receive()
    if message["type"] == "websocket.disconnect":
        raise WebSocketDisconnect(code=message.get("code", 1000))

    payload = message.get("bytes")
    if not isinstance(payload, bytes):
        raise LiveRealtimeSessionError(
            code="audio_frame_invalid",
            message="Audio frame metadata must be followed by a binary payload",
        )
    return payload


@router.post(
    "/sessions",
    summary="Create live session",
    response_model=LiveSessionDetailResponse,
)
def create_live_session_endpoint(
    request: CreateLiveSessionRequest,
    live_store: LiveStoreDependency,
) -> LiveSessionPayload:
    """Create an active live transcription session."""
    try:
        return create_live_session(
            live_store=live_store,
            title=request.title,
            mode=request.mode,
            language_hint=request.language_hint,
            model_id=request.model_id,
        )
    except LiveUseCaseError as error:
        _raise_live_http_error(error)


@router.get(
    "/sessions",
    summary="List live sessions",
    response_model=LiveSessionListResponse,
)
def list_live_sessions_endpoint(
    live_store: LiveStoreDependency,
    limit: int = Query(
        DEFAULT_LIVE_SESSION_LIMIT,
        ge=1,
        le=MAX_LIVE_SESSION_LIMIT,
        description="Max results",
    ),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
) -> LiveSessionListPayload:
    """Return paged live session summaries."""
    try:
        return list_live_sessions(
            live_store=live_store,
            limit=limit,
            offset=offset,
        )
    except LiveUseCaseError as error:
        _raise_live_http_error(error)


@router.get(
    "/sessions/{session_id}",
    summary="Get live session",
    response_model=LiveSessionDetailResponse,
)
def get_live_session_endpoint(
    session_id: str,
    live_store: LiveStoreDependency,
    segment_limit: int = Query(
        DEFAULT_LIVE_SEGMENT_LIMIT,
        ge=1,
        le=MAX_LIVE_SEGMENT_LIMIT,
        description="Max transcript segments in the detail payload",
    ),
    segment_offset: int = Query(
        0,
        ge=0,
        description="Transcript segment pagination offset",
    ),
) -> LiveSessionPayload:
    """Return one live session with tracks and a paged segment window."""
    try:
        return get_live_session(
            live_store=live_store,
            session_id=session_id,
            segment_limit=segment_limit,
            segment_offset=segment_offset,
        )
    except LiveUseCaseError as error:
        _raise_live_http_error(error)


@router.post(
    "/sessions/{session_id}/finish",
    summary="Finish live session",
    response_model=LiveSessionDetailResponse,
)
def finish_live_session_endpoint(
    session_id: str,
    live_store: LiveStoreDependency,
    segment_limit: int = Query(
        DEFAULT_LIVE_SEGMENT_LIMIT,
        ge=1,
        le=MAX_LIVE_SEGMENT_LIMIT,
        description="Max transcript segments in the detail payload",
    ),
    segment_offset: int = Query(
        0,
        ge=0,
        description="Transcript segment pagination offset",
    ),
) -> LiveSessionPayload:
    """Finish an active live session and return its current snapshot."""
    try:
        return finish_live_session(
            live_store=live_store,
            session_id=session_id,
            segment_limit=segment_limit,
            segment_offset=segment_offset,
        )
    except LiveUseCaseError as error:
        _raise_live_http_error(error)


@router.websocket("/sessions/{session_id}/stream")
async def stream_live_session_endpoint(
    websocket: WebSocket,
    session_id: str,
    live_store: LiveStoreDependency,
    stream_registry: LiveStreamRegistryDependency,
    diagnostics_output_dir: LiveDiagnosticsOutputDependency,
) -> None:
    """Handle one live realtime WebSocket stream."""
    await websocket.accept()

    session = live_store.get_session(session_id)
    if session is None:
        await _send_realtime_error(
            websocket,
            session_id=session_id,
            code="session_not_found",
            message="Live session not found",
        )
        await websocket.close(code=LIVE_REALTIME_CLOSE_NOT_FOUND)
        return

    if ensure_live_session_status(session["status"]) != "active":
        await _send_realtime_error(
            websocket,
            session_id=session_id,
            code="session_not_active",
            message="Live session is not active",
        )
        await websocket.close(code=LIVE_REALTIME_CLOSE_CONFLICT)
        return

    acquired = await stream_registry.acquire(session_id)
    if not acquired:
        await _send_realtime_error(
            websocket,
            session_id=session_id,
            code="session_already_streaming",
            message="Live session already has an active realtime stream",
        )
        await websocket.close(code=LIVE_REALTIME_CLOSE_CONFLICT)
        return

    runtime: LiveRealtimeSessionRuntime | None = None

    try:
        session = live_store.get_session(session_id)
        if session is None:
            await _send_realtime_error(
                websocket,
                session_id=session_id,
                code="session_not_found",
                message="Live session not found",
            )
            await websocket.close(code=LIVE_REALTIME_CLOSE_NOT_FOUND)
            return

        if ensure_live_session_status(session["status"]) != "active":
            await _send_realtime_error(
                websocket,
                session_id=session_id,
                code="session_not_active",
                message="Live session is not active",
            )
            await websocket.close(code=LIVE_REALTIME_CLOSE_CONFLICT)
            return

        runtime = LiveRealtimeSessionRuntime(
            live_store=live_store,
            session_id=session_id,
            diagnostics_output_dir=diagnostics_output_dir,
        )

        raw_hello = await _receive_realtime_json(websocket)
        base_hello = LiveRealtimeEventEnvelope.model_validate(raw_hello)
        if base_hello.session_id != session_id:
            raise LiveRealtimeSessionError(
                code="invalid_event",
                message="Realtime event session does not match the stream",
            )
        if base_hello.type != "client.hello":
            raise LiveRealtimeSessionError(
                code="invalid_event_order",
                message="First realtime event must be client.hello",
            )

        hello = LiveRealtimeClientHelloEvent.model_validate(raw_hello)
        runtime.accept_hello(protocol_version=hello.protocol_version)

        session_payload = get_live_session(
            live_store=live_store,
            session_id=session_id,
        )
        session_response = LiveSessionDetailResponse.model_validate(session_payload)
        ready = build_server_ready_event(
            session_id=session_id,
            session=session_response,
        )
        await websocket.send_json(ready.model_dump(mode="json"))

        while True:
            raw_event = await _receive_realtime_json(websocket)
            base_event = LiveRealtimeEventEnvelope.model_validate(raw_event)
            if base_event.session_id != session_id:
                raise LiveRealtimeSessionError(
                    code="invalid_event",
                    message="Realtime event session does not match the stream",
                )

            runtime.ensure_protocol_version(
                protocol_version=base_event.protocol_version
            )

            if base_event.type == "client.ping":
                LiveRealtimeClientPingEvent.model_validate(raw_event)
                pong = build_realtime_pong_event(session_id=session_id)
                await websocket.send_json(pong.model_dump(mode="json"))
                continue

            if base_event.type == "track.start":
                track_start = LiveRealtimeTrackStartEvent.model_validate(raw_event)
                track_payload = runtime.start_track(
                    LiveRealtimeTrackStart(
                        source=track_start.source,
                        sequence=track_start.sequence,
                        label=track_start.label,
                        device_label=track_start.device_label,
                        sample_rate=track_start.sample_rate,
                        channel_count=track_start.channel_count,
                    )
                )
                track_ready = build_track_ready_event(
                    session_id=session_id,
                    track=LiveTrackResponse.model_validate(track_payload),
                )
                await websocket.send_json(track_ready.model_dump(mode="json"))
                continue

            if base_event.type == "audio.frame":
                frame_metadata = LiveRealtimeAudioFrameMetadataEvent.model_validate(
                    raw_event
                )
                ensure_pcm16le_contract(
                    encoding=frame_metadata.encoding,
                    sample_rate=frame_metadata.sample_rate,
                    channel_count=frame_metadata.channel_count,
                )
                audio_frame = LiveRealtimeAudioFrameMetadata(
                    track_id=frame_metadata.track_id,
                    source=frame_metadata.source,
                    sequence=frame_metadata.sequence,
                    captured_at_ms=frame_metadata.captured_at_ms,
                    duration_ms=frame_metadata.duration_ms,
                    byte_length=frame_metadata.byte_length,
                )
                runtime.validate_audio_frame_metadata(audio_frame)
                audio_payload = await _receive_audio_payload(websocket)
                audio_frame_result = runtime.accept_audio_frame(
                    audio_frame,
                    audio_payload,
                )
                if audio_frame_result.diagnostics_wav_stopped is not None:
                    await websocket.send_json(
                        build_diagnostics_wav_stopped_event(
                            session_id=session_id,
                            stopped=audio_frame_result.diagnostics_wav_stopped,
                        ).model_dump(mode="json")
                    )

                for transcript_event in audio_frame_result.transcript_events:
                    if isinstance(transcript_event, LiveRealtimeTranscriptPreview):
                        await websocket.send_json(
                            build_transcript_preview_event(
                                session_id=session_id,
                                preview=transcript_event,
                            ).model_dump(mode="json")
                        )
                    elif isinstance(
                        transcript_event,
                        LiveRealtimeTranscriptCommittedPartial,
                    ):
                        await websocket.send_json(
                            build_transcript_committed_partial_event(
                                session_id=session_id,
                                committed_partial=transcript_event,
                            ).model_dump(mode="json")
                        )
                    else:
                        await websocket.send_json(
                            build_transcript_final_event(
                                session_id=session_id,
                                final=transcript_event,
                            ).model_dump(mode="json")
                        )
                continue

            if base_event.type == "diagnostics.wav.start":
                diagnostics_start = LiveRealtimeDiagnosticsWavStartEvent.model_validate(
                    raw_event
                )
                started = runtime.start_diagnostics_wav(
                    LiveRealtimeDiagnosticsWavStart(
                        max_duration_ms=diagnostics_start.max_duration_ms,
                        max_bytes=diagnostics_start.max_bytes,
                        track_ids=(
                            tuple(diagnostics_start.tracks)
                            if diagnostics_start.tracks is not None
                            else None
                        ),
                    )
                )
                started_event = build_diagnostics_wav_started_event(
                    session_id=session_id,
                    started=started,
                )
                await websocket.send_json(started_event.model_dump(mode="json"))
                continue

            if base_event.type == "diagnostics.wav.stop":
                LiveRealtimeDiagnosticsWavStopEvent.model_validate(raw_event)
                stopped = runtime.stop_diagnostics_wav(reason="client_stop")
                stopped_event = build_diagnostics_wav_stopped_event(
                    session_id=session_id,
                    stopped=stopped,
                )
                await websocket.send_json(stopped_event.model_dump(mode="json"))
                continue

            if base_event.type == "track.stop":
                track_stop = LiveRealtimeTrackStopEvent.model_validate(raw_event)
                runtime.stop_track(
                    LiveRealtimeTrackStop(
                        track_id=track_stop.track_id,
                        source=track_stop.source,
                        sequence=track_stop.sequence,
                    )
                )
                continue

            if base_event.type == "session.finish":
                LiveRealtimeSessionFinishEvent.model_validate(raw_event)
                if runtime.diagnostics_wav_active:
                    stopped = runtime.stop_diagnostics_wav(reason="session_finish")
                    await websocket.send_json(
                        build_diagnostics_wav_stopped_event(
                            session_id=session_id,
                            stopped=stopped,
                        ).model_dump(mode="json")
                    )

                finish_payload = runtime.finish()
                session_response = LiveSessionDetailResponse.model_validate(
                    finish_payload
                )
                finished = build_session_finished_event(
                    session_id=session_id,
                    session=session_response,
                )
                await websocket.send_json(finished.model_dump(mode="json"))
                await websocket.close(code=LIVE_REALTIME_CLOSE_NORMAL)
                return

            raise LiveRealtimeSessionError(
                code="invalid_event",
                message="Realtime event is not implemented in this phase",
            )
    except ValidationError:
        await _send_realtime_error(
            websocket,
            session_id=session_id,
            code="invalid_event",
            message="Realtime event payload is invalid",
        )
        await websocket.close(code=LIVE_REALTIME_CLOSE_POLICY)
    except LiveRealtimeSessionError as error:
        await _send_realtime_error(
            websocket,
            session_id=session_id,
            code=error.code,
            message=error.message,
        )
        await websocket.close(code=LIVE_REALTIME_CLOSE_POLICY)
    except WebSocketDisconnect:
        if runtime is not None:
            runtime.fail_after_disconnect()
    finally:
        if runtime is not None:
            runtime.release()
        await stream_registry.release(session_id)
