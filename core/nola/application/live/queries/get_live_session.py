"""Get-live-session use-case."""

from nola.application.live.contracts import SupportsLiveRepository
from nola.application.live.errors import LiveUseCaseError
from nola.application.live.payloads import build_live_session_payload
from nola.application.live.types import LiveSessionPayload


def get_live_session(
    *,
    live_store: SupportsLiveRepository,
    session_id: str,
) -> LiveSessionPayload:
    """Return live session detail by session id."""
    session = live_store.get_session(session_id)
    if session is None:
        raise LiveUseCaseError(status_code=404, detail="Live session not found")

    return build_live_session_payload(
        session=session,
        tracks=live_store.list_tracks(session_id),
        segments=live_store.list_segments(session_id),
    )
