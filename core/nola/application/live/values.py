"""Validate live transcription domain values."""

from typing import cast

from nola.application.live.errors import LiveUseCaseError
from nola.application.live.types import (
    DEFAULT_LIVE_SEGMENT_LIMIT,
    DEFAULT_LIVE_SESSION_LIMIT,
    DEFAULT_LIVE_SESSION_SORT_BY,
    DEFAULT_LIVE_SORT_ORDER,
    LIVE_SESSION_MODES,
    LIVE_SESSION_SORT_FIELDS,
    LIVE_SESSION_STATUSES,
    LIVE_SORT_ORDERS,
    LIVE_TRACK_SOURCES,
    MAX_LIVE_SEGMENT_LIMIT,
    MAX_LIVE_SESSION_LIMIT,
    LiveSessionMode,
    LiveSessionSortBy,
    LiveSessionStatus,
    LiveSortOrder,
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


def ensure_optional_live_session_status(
    status: object | None,
) -> LiveSessionStatus | None:
    """Return a supported live session status when provided."""
    if status is None:
        return None
    raw_status = str(status)
    if raw_status not in LIVE_SESSION_STATUSES:
        raise LiveUseCaseError(
            status_code=422,
            detail=f"Invalid live session status: {raw_status}",
        )
    return cast(LiveSessionStatus, raw_status)


def ensure_live_session_sort_by(sort_by: object | None) -> LiveSessionSortBy:
    """Return a supported live session sort field."""
    if sort_by is None:
        return DEFAULT_LIVE_SESSION_SORT_BY
    raw_sort_by = str(sort_by)
    if raw_sort_by not in LIVE_SESSION_SORT_FIELDS:
        raise LiveUseCaseError(
            status_code=422,
            detail=f"Invalid live session sort field: {raw_sort_by}",
        )
    return cast(LiveSessionSortBy, raw_sort_by)


def ensure_live_sort_order(order: object | None) -> LiveSortOrder:
    """Return a supported live sort order."""
    if order is None:
        return DEFAULT_LIVE_SORT_ORDER
    raw_order = str(order).lower()
    if raw_order not in LIVE_SORT_ORDERS:
        raise LiveUseCaseError(
            status_code=422,
            detail=f"Invalid live sort order: {raw_order}",
        )
    return cast(LiveSortOrder, raw_order)


def ensure_live_track_source(source: object) -> LiveTrackSource:
    """Return a supported live track source."""
    raw_source = str(source)
    if raw_source not in LIVE_TRACK_SOURCES:
        raise LiveUseCaseError(
            status_code=409,
            detail=f"Invalid live track source: {raw_source}",
        )
    return cast(LiveTrackSource, raw_source)


def ensure_live_segment_page(
    *,
    limit: int = DEFAULT_LIVE_SEGMENT_LIMIT,
    offset: int = 0,
) -> tuple[int, int]:
    """Return bounded live segment pagination values."""
    if limit < 1 or limit > MAX_LIVE_SEGMENT_LIMIT:
        raise LiveUseCaseError(
            status_code=422,
            detail=(
                f"Live segment limit must be between 1 and {MAX_LIVE_SEGMENT_LIMIT}"
            ),
        )
    if offset < 0:
        raise LiveUseCaseError(
            status_code=422,
            detail="Live segment offset must be greater than or equal to 0",
        )
    return limit, offset


def ensure_live_session_page(
    *,
    limit: int = DEFAULT_LIVE_SESSION_LIMIT,
    offset: int = 0,
) -> tuple[int, int]:
    """Return bounded live session pagination values."""
    if limit < 1 or limit > MAX_LIVE_SESSION_LIMIT:
        raise LiveUseCaseError(
            status_code=422,
            detail=(
                f"Live session limit must be between 1 and {MAX_LIVE_SESSION_LIMIT}"
            ),
        )
    if offset < 0:
        raise LiveUseCaseError(
            status_code=422,
            detail="Live session offset must be greater than or equal to 0",
        )
    return limit, offset
