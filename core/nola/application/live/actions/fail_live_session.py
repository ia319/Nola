"""Fail-live-session use-case."""

from collections.abc import Callable

from nola.application.live._clock import now_iso
from nola.application.live.contracts import SupportsLiveRepository
from nola.application.live.errors import LiveUseCaseError
from nola.application.live.payloads import build_live_session_payload
from nola.application.live.types import DEFAULT_LIVE_SEGMENT_LIMIT, LiveSessionPayload
from nola.application.live.values import (
    ensure_live_segment_page,
    ensure_live_session_status,
)


def fail_live_session(
    *,
    live_store: SupportsLiveRepository,
    session_id: str,
    error: str,
    segment_limit: int = DEFAULT_LIVE_SEGMENT_LIMIT,
    segment_offset: int = 0,
    timestamp_factory: Callable[[], str] | None = None,
) -> LiveSessionPayload:
    """Fail an active live session or return an existing terminal snapshot."""
    resolved_segment_limit, resolved_segment_offset = ensure_live_segment_page(
        limit=segment_limit,
        offset=segment_offset,
    )
    session = live_store.get_session(session_id)
    if session is None:
        raise LiveUseCaseError(status_code=404, detail="Live session not found")

    status = ensure_live_session_status(session["status"])
    if status == "active":
        now = timestamp_factory() if timestamp_factory else now_iso()
        updated_session = live_store.fail_session(
            session_id,
            error=error,
            ended_at=now,
            updated_at=now,
        )
        if updated_session is None:
            latest_session = live_store.get_session(session_id)
            if latest_session is None:
                raise LiveUseCaseError(status_code=404, detail="Live session not found")
            if ensure_live_session_status(latest_session["status"]) == "active":
                raise LiveUseCaseError(
                    status_code=409,
                    detail="Live session could not be failed",
                )
            session = latest_session
        else:
            session = updated_session

    return build_live_session_payload(
        session=session,
        tracks=live_store.list_tracks(session_id),
        segments=live_store.list_segments(
            session_id,
            limit=resolved_segment_limit,
            offset=resolved_segment_offset,
        ),
        segment_total=live_store.count_segments(session_id),
        segment_limit=resolved_segment_limit,
        segment_offset=resolved_segment_offset,
    )
