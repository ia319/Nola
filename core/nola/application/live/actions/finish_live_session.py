"""Finish-live-session use-case."""

from collections.abc import Callable
from datetime import datetime

from nola.application.live.contracts import SupportsLiveRepository
from nola.application.live.errors import LiveUseCaseError
from nola.application.live.payloads import build_live_session_payload
from nola.application.live.types import LiveSessionPayload
from nola.application.live.values import ensure_live_session_status


def _now_iso() -> str:
    """Return the current local timestamp."""
    return datetime.now().isoformat()


def finish_live_session(
    *,
    live_store: SupportsLiveRepository,
    session_id: str,
    timestamp_factory: Callable[[], str] | None = None,
) -> LiveSessionPayload:
    """Finish an active live session or return an existing terminal snapshot."""
    session = live_store.get_session(session_id)
    if session is None:
        raise LiveUseCaseError(status_code=404, detail="Live session not found")

    status = ensure_live_session_status(session["status"])
    if status == "active":
        now = timestamp_factory() if timestamp_factory else _now_iso()
        updated_session = live_store.finish_session(
            session_id,
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
                    detail="Live session could not be finished",
                )
            session = latest_session
        else:
            session = updated_session

    return build_live_session_payload(
        session=session,
        tracks=live_store.list_tracks(session_id),
        segments=live_store.list_segments(session_id),
    )
