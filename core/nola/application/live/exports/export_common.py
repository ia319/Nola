"""Shared helpers for live session export use-cases."""

from fastapi.responses import Response

from nola.application.live.contracts import SupportsLiveRepository
from nola.application.live.errors import LiveUseCaseError
from nola.application.live.types import LiveSegmentRecord, LiveSessionRecord
from nola.config.export import build_download_content_disposition, build_export_filename
from nola.services.formatters import SegmentData


def build_live_segment_data(segments: list[LiveSegmentRecord]) -> list[SegmentData]:
    """Convert final live segments into formatter segment data."""
    return [
        SegmentData(
            start=segment["start_ms"] / 1000,
            end=segment["end_ms"] / 1000,
            text=segment["text"],
        )
        for segment in segments
    ]


def build_live_export_filename(
    *,
    session: LiveSessionRecord,
    requested_name: str | None,
    extension: str,
) -> str:
    """Build a safe live export filename."""
    fallback_name = (
        session["title"]
        if isinstance(session["title"], str) and session["title"].strip()
        else session["id"]
    )
    return build_export_filename(
        requested_name=requested_name,
        fallback_name=fallback_name,
        extension=extension,
    )


def build_live_download_response(
    *,
    content: str,
    filename: str,
    media_type: str,
) -> Response:
    """Build a subtitle download response with a safe filename header."""
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": build_download_content_disposition(filename)},
    )


def require_live_export_session(
    live_store: SupportsLiveRepository,
    session_id: str,
) -> LiveSessionRecord:
    """Return one finished live session or raise a controlled export error."""
    session = live_store.get_session(session_id)
    if session is None:
        raise LiveUseCaseError(status_code=404, detail="Live session not found")
    if session["status"] != "finished":
        raise LiveUseCaseError(
            status_code=400,
            detail=f"Live session not finished, current status: {session['status']}",
        )
    return session
