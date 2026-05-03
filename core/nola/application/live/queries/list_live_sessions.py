"""List-live-sessions use-case."""

from nola.application.live.contracts import SupportsLiveSessionQueries
from nola.application.live.payloads import build_live_session_list_payload
from nola.application.live.types import LiveSessionListPayload


def list_live_sessions(
    *,
    live_store: SupportsLiveSessionQueries,
    limit: int,
    offset: int,
) -> LiveSessionListPayload:
    """Return paged live session summaries."""
    sessions = live_store.list_sessions(limit=limit, offset=offset)
    total = live_store.count_sessions()
    return build_live_session_list_payload(
        sessions=sessions,
        total=total,
        limit=limit,
        offset=offset,
    )
