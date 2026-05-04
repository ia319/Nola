"""Get-live-session use-case."""

from nola.application.live.contracts import SupportsLiveRepository
from nola.application.live.errors import LiveUseCaseError
from nola.application.live.payloads import build_live_session_payload
from nola.application.live.types import DEFAULT_LIVE_SEGMENT_LIMIT, LiveSessionPayload
from nola.application.live.values import ensure_live_segment_page


def get_live_session(
    *,
    live_store: SupportsLiveRepository,
    session_id: str,
    segment_limit: int = DEFAULT_LIVE_SEGMENT_LIMIT,
    segment_offset: int = 0,
) -> LiveSessionPayload:
    """Return live session detail by session id."""
    resolved_segment_limit, resolved_segment_offset = ensure_live_segment_page(
        limit=segment_limit,
        offset=segment_offset,
    )
    session = live_store.get_session(session_id)
    if session is None:
        raise LiveUseCaseError(status_code=404, detail="Live session not found")

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
