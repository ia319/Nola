"""Live transcription REST endpoints."""

from typing import Annotated, NoReturn, TypeAlias

from fastapi import APIRouter, Depends, HTTPException, Query

from nola.api.deps import get_live_db
from nola.api.schemas import (
    CreateLiveSessionRequest,
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
    finish_live_session,
    get_live_session,
    list_live_sessions,
)

router = APIRouter(prefix="/api/live", tags=["live"])
LiveStoreDependency: TypeAlias = Annotated[SupportsLiveRepository, Depends(get_live_db)]


def _raise_live_http_error(error: LiveUseCaseError) -> NoReturn:
    """Raise an HTTPException from a live use-case error."""
    raise HTTPException(status_code=error.status_code, detail=error.detail) from error


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
