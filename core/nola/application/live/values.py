"""Validate live transcription domain values."""

from typing import cast

from nola.application.live.errors import LiveUseCaseError
from nola.application.live.types import (
    LIVE_SESSION_MODES,
    LIVE_SESSION_STATUSES,
    LIVE_TRACK_SOURCES,
    LiveSessionMode,
    LiveSessionStatus,
    LiveTrackSource,
)


def ensure_live_session_mode(
    mode: object,
    *,
    status_code: int = 422,
) -> LiveSessionMode:
    """Return a supported live session mode."""
    raw_mode = str(mode)
    if raw_mode not in LIVE_SESSION_MODES:
        raise LiveUseCaseError(
            status_code=status_code,
            detail=f"Invalid live session mode: {raw_mode}",
        )
    return cast(LiveSessionMode, raw_mode)


def ensure_live_session_status(status: object) -> LiveSessionStatus:
    """Return a supported live session status."""
    raw_status = str(status)
    if raw_status not in LIVE_SESSION_STATUSES:
        raise LiveUseCaseError(
            status_code=409,
            detail=f"Invalid live session status: {raw_status}",
        )
    return cast(LiveSessionStatus, raw_status)


def ensure_live_track_source(source: object) -> LiveTrackSource:
    """Return a supported live track source."""
    raw_source = str(source)
    if raw_source not in LIVE_TRACK_SOURCES:
        raise LiveUseCaseError(
            status_code=409,
            detail=f"Invalid live track source: {raw_source}",
        )
    return cast(LiveTrackSource, raw_source)
