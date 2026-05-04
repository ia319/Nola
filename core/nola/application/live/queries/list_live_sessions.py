"""List-live-sessions use-case."""

from nola.application.live.contracts import SupportsLiveSessionQueries
from nola.application.live.payloads import build_live_session_list_payload
from nola.application.live.types import LiveSessionListPayload
from nola.application.live.values import ensure_live_session_page


def list_live_sessions(
    *,
    live_store: SupportsLiveSessionQueries,
    limit: int,
    offset: int,
) -> LiveSessionListPayload:
    """Return paged live session summaries."""
    resolved_limit, resolved_offset = ensure_live_session_page(
        limit=limit,
        offset=offset,
    )
    sessions = live_store.list_sessions(limit=resolved_limit, offset=resolved_offset)
    total = live_store.count_sessions()
    return build_live_session_list_payload(
        sessions=sessions,
        total=total,
        limit=resolved_limit,
        offset=resolved_offset,
    )
