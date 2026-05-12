"""List-live-sessions use-case."""

from nola.application.live.contracts import SupportsLiveSessionQueries
from nola.application.live.payloads import build_live_session_list_payload
from nola.application.live.types import (
    DEFAULT_LIVE_SESSION_SORT_BY,
    DEFAULT_LIVE_SORT_ORDER,
    LiveSessionListPayload,
)
from nola.application.live.values import (
    ensure_live_session_page,
    ensure_live_session_sort_by,
    ensure_live_sort_order,
    ensure_optional_live_session_status,
)


def list_live_sessions(
    *,
    live_store: SupportsLiveSessionQueries,
    limit: int,
    offset: int,
    q: str | None = None,
    status: str | None = None,
    sort_by: str = DEFAULT_LIVE_SESSION_SORT_BY,
    order: str = DEFAULT_LIVE_SORT_ORDER,
) -> LiveSessionListPayload:
    """Return paged live session summaries."""
    resolved_limit, resolved_offset = ensure_live_session_page(
        limit=limit,
        offset=offset,
    )
    resolved_status = ensure_optional_live_session_status(status)
    resolved_sort_by = ensure_live_session_sort_by(sort_by)
    resolved_order = ensure_live_sort_order(order)
    resolved_query = q.strip() if q and q.strip() else None
    sessions = live_store.list_sessions(
        limit=resolved_limit,
        offset=resolved_offset,
        q=resolved_query,
        status=resolved_status,
        sort_by=resolved_sort_by,
        order=resolved_order,
    )
    total = live_store.count_sessions(q=resolved_query, status=resolved_status)
    return build_live_session_list_payload(
        sessions=sessions,
        total=total,
        limit=resolved_limit,
        offset=resolved_offset,
    )
