"""Delete-live-session-record use-case."""

from nola.application.live.contracts import SupportsLiveRepository
from nola.application.live.errors import LiveUseCaseError
from nola.application.live.types import (
    DELETABLE_LIVE_SESSION_STATUSES,
    DeleteLiveSessionRecordPayload,
)


def delete_live_session_record(
    *,
    live_store: SupportsLiveRepository,
    session_id: str,
) -> DeleteLiveSessionRecordPayload:
    """Delete a terminal live session record."""
    session = live_store.get_session(session_id)
    if session is None:
        raise LiveUseCaseError(status_code=404, detail="Live session not found")

    if session["status"] not in DELETABLE_LIVE_SESSION_STATUSES:
        raise LiveUseCaseError(
            status_code=400,
            detail="Only finished or failed live sessions can be deleted",
        )

    deleted = live_store.delete_session_record(session_id)
    if not deleted:
        raise LiveUseCaseError(status_code=404, detail="Live session not found")

    return {
        "session_id": session_id,
        "message": "Live session record deleted successfully",
    }
