"""Live transcription REST and realtime endpoints."""

from typing import Annotated, NoReturn, TypeAlias
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket
from pydantic import ValidationError
from starlette.websockets import WebSocketDisconnect

from nola.api.deps import get_live_db, get_live_stream_connection_registry
from nola.api.schemas import (
    CreateLiveSessionRequest,
    LiveRealtimeAudioContract,
    LiveRealtimeClientHelloEvent,
    LiveRealtimeClientPingEvent,
    LiveRealtimeErrorPayload,
    LiveRealtimeEventEnvelope,
    LiveRealtimeServerErrorEvent,
    LiveRealtimeServerPongEvent,
    LiveRealtimeServerReadyEvent,
    LiveRealtimeSessionFinishedEvent,
    LiveRealtimeSessionFinishEvent,
    LiveSessionDetailResponse,
    LiveSessionListResponse,
)
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
    fail_live_session,
    finish_live_session,
    get_live_session,
    list_live_sessions,
)
from nola.application.live._clock import now_iso
from nola.application.live.realtime import (
    LIVE_REALTIME_PROTOCOL_VERSION,
    LIVE_REALTIME_SUPPORTED_PROTOCOL_VERSIONS,
    LiveRealtimeErrorCode,
    LiveStreamConnectionRegistry,
)
from nola.application.live.values import ensure_live_session_status

router = APIRouter(prefix="/api/live", tags=["live"])
LiveStoreDependency: TypeAlias = Annotated[SupportsLiveRepository, Depends(get_live_db)]
LiveStreamRegistryDependency: TypeAlias = Annotated[
    LiveStreamConnectionRegistry,
    Depends(get_live_stream_connection_registry),
]

LIVE_REALTIME_CLOSE_NORMAL = 1000
LIVE_REALTIME_CLOSE_POLICY = 1008
LIVE_REALTIME_CLOSE_NOT_FOUND = 4404
LIVE_REALTIME_CLOSE_CONFLICT = 4409


def _raise_live_http_error(error: LiveUseCaseError) -> NoReturn:
    """Raise an HTTPException from a live use-case error."""
    raise HTTPException(status_code=error.status_code, detail=error.detail) from error


def _event_id() -> str:
    """Create one server event id."""
    return f"server-{uuid4()}"


async def _send_realtime_error(
    websocket: WebSocket,
    *,
    session_id: str,
    code: LiveRealtimeErrorCode,
    message: str,
) -> None:
    """Send one realtime protocol error event."""
    event = LiveRealtimeServerErrorEvent(
        type="server.error",
        protocol_version=LIVE_REALTIME_PROTOCOL_VERSION,
        session_id=session_id,
        event_id=_event_id(),
        sent_at=now_iso(),
        error=LiveRealtimeErrorPayload(code=code, message=message),
    )
    await websocket.send_json(event.model_dump(mode="json"))


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

    handshake_complete = False
    finished_normally = False

    try:
        raw_hello = await websocket.receive_json()
        base_hello = LiveRealtimeEventEnvelope.model_validate(raw_hello)
        if base_hello.type != "client.hello":
            await _send_realtime_error(
                websocket,
                session_id=session_id,
                code="invalid_event_order",
                message="First realtime event must be client.hello",
            )
            await websocket.close(code=LIVE_REALTIME_CLOSE_POLICY)
            return

        hello = LiveRealtimeClientHelloEvent.model_validate(raw_hello)
        if hello.protocol_version not in LIVE_REALTIME_SUPPORTED_PROTOCOL_VERSIONS:
            await _send_realtime_error(
                websocket,
                session_id=session_id,
                code="protocol_version_unsupported",
                message="Realtime protocol version is not supported",
            )
            await websocket.close(code=LIVE_REALTIME_CLOSE_POLICY)
            return

        session_payload = get_live_session(
            live_store=live_store,
            session_id=session_id,
        )
        session_response = LiveSessionDetailResponse.model_validate(session_payload)
        ready = LiveRealtimeServerReadyEvent(
            type="server.ready",
            protocol_version=LIVE_REALTIME_PROTOCOL_VERSION,
            session_id=session_id,
            event_id=_event_id(),
            sent_at=now_iso(),
            audio_contract=LiveRealtimeAudioContract(),
            session=session_response,
        )
        await websocket.send_json(ready.model_dump(mode="json"))
        handshake_complete = True

        while True:
            raw_event = await websocket.receive_json()
            base_event = LiveRealtimeEventEnvelope.model_validate(raw_event)

            protocol_supported = (
                base_event.protocol_version in LIVE_REALTIME_SUPPORTED_PROTOCOL_VERSIONS
            )
            if not protocol_supported:
                await _send_realtime_error(
                    websocket,
                    session_id=session_id,
                    code="protocol_version_unsupported",
                    message="Realtime protocol version is not supported",
                )
                await websocket.close(code=LIVE_REALTIME_CLOSE_POLICY)
                return

            if base_event.type == "client.ping":
                LiveRealtimeClientPingEvent.model_validate(raw_event)
                pong = LiveRealtimeServerPongEvent(
                    type="server.pong",
                    protocol_version=LIVE_REALTIME_PROTOCOL_VERSION,
                    session_id=session_id,
                    event_id=_event_id(),
                    sent_at=now_iso(),
                )
                await websocket.send_json(pong.model_dump(mode="json"))
                continue

            if base_event.type == "session.finish":
                LiveRealtimeSessionFinishEvent.model_validate(raw_event)
                payload = finish_live_session(
                    live_store=live_store,
                    session_id=session_id,
                )
                session_response = LiveSessionDetailResponse.model_validate(payload)
                finished = LiveRealtimeSessionFinishedEvent(
                    type="session.finished",
                    protocol_version=LIVE_REALTIME_PROTOCOL_VERSION,
                    session_id=session_id,
                    event_id=_event_id(),
                    sent_at=now_iso(),
                    session=session_response,
                )
                await websocket.send_json(finished.model_dump(mode="json"))
                finished_normally = True
                await websocket.close(code=LIVE_REALTIME_CLOSE_NORMAL)
                return

            await _send_realtime_error(
                websocket,
                session_id=session_id,
                code="invalid_event",
                message="Realtime event is not implemented in this phase",
            )
            await websocket.close(code=LIVE_REALTIME_CLOSE_POLICY)
            return
    except ValidationError:
        await _send_realtime_error(
            websocket,
            session_id=session_id,
            code="invalid_event",
            message="Realtime event payload is invalid",
        )
        await websocket.close(code=LIVE_REALTIME_CLOSE_POLICY)
    except WebSocketDisconnect:
        if handshake_complete and not finished_normally:
            fail_live_session(
                live_store=live_store,
                session_id=session_id,
                error="connection_closed",
            )
    finally:
        await stream_registry.release(session_id)
