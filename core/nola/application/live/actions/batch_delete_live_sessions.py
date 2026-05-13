"""Batch delete-live-session-record use-case."""

from nola.application.live.contracts import SupportsLiveRepository
from nola.application.live.types import (
    DELETABLE_LIVE_SESSION_STATUSES,
    BatchLiveSessionActionPayload,
    BatchLiveSessionActionResultPayload,
    LiveSessionRecord,
)


def _duplicate_session_id_result(
    session_id: str,
) -> BatchLiveSessionActionResultPayload:
    return {
        "session_id": session_id,
        "ok": False,
        "message": "Duplicate session_id in request",
        "error_code": "duplicate_session_id",
    }


def _session_not_found_result(session_id: str) -> BatchLiveSessionActionResultPayload:
    return {
        "session_id": session_id,
        "ok": False,
        "message": "Live session not found",
        "error_code": "not_found",
    }


def _build_batch_delete_response(
    results: list[BatchLiveSessionActionResultPayload],
) -> BatchLiveSessionActionPayload:
    succeeded = sum(1 for item in results if item["ok"])
    failed = len(results) - succeeded
    return {
        "action": "delete_record",
        "summary": {
            "requested": len(results),
            "succeeded": succeeded,
            "failed": failed,
        },
        "results": results,
    }


def _delete_existing_session(
    *,
    live_store: SupportsLiveRepository,
    session_id: str,
    session: LiveSessionRecord,
) -> BatchLiveSessionActionResultPayload:
    status = session["status"]
    if status not in DELETABLE_LIVE_SESSION_STATUSES:
        return {
            "session_id": session_id,
            "ok": False,
            "message": f"Cannot delete live session record with status: {status}",
            "error_code": "invalid_status",
            "status": status,
        }

    if not live_store.delete_session_record(session_id):
        latest_session = live_store.get_session(session_id)
        if latest_session is None:
            return _session_not_found_result(session_id)
        latest_status = latest_session["status"]
        return {
            "session_id": session_id,
            "ok": False,
            "message": (
                f"Cannot delete live session record with status: {latest_status}"
            ),
            "error_code": "invalid_status",
            "status": latest_status,
        }

    return {
        "session_id": session_id,
        "ok": True,
        "message": "Live session record deleted successfully",
        "status": status,
    }


def batch_delete_live_session_records(
    *,
    live_store: SupportsLiveRepository,
    session_ids: list[str],
) -> BatchLiveSessionActionPayload:
    """Delete multiple terminal live session records with per-session outcomes."""
    seen_session_ids: set[str] = set()
    results: list[BatchLiveSessionActionResultPayload] = []

    for session_id in session_ids:
        if session_id in seen_session_ids:
            results.append(_duplicate_session_id_result(session_id))
            continue
        seen_session_ids.add(session_id)

        session = live_store.get_session(session_id)
        if session is None:
            results.append(_session_not_found_result(session_id))
            continue

        results.append(
            _delete_existing_session(
                live_store=live_store,
                session_id=session_id,
                session=session,
            )
        )

    return _build_batch_delete_response(results)
