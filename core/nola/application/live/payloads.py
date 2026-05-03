"""Build stable payloads shared by live transcription use-cases."""

from nola.application.live.types import (
    LiveSegmentPayload,
    LiveSegmentRecord,
    LiveSessionListPayload,
    LiveSessionPayload,
    LiveSessionRecord,
    LiveSessionSummaryPayload,
    LiveTrackPayload,
    LiveTrackRecord,
)


def to_live_session_summary_payload(
    session: LiveSessionRecord,
) -> LiveSessionSummaryPayload:
    """Build a live session summary payload from one stored record."""
    return {
        "session_id": session["id"],
        "title": session["title"],
        "mode": session["mode"],
        "status": session["status"],
        "language_hint": session["language_hint"],
        "model_id": session["model_id"],
        "runtime": session["runtime"],
        "audio_format": session["audio_format"],
        "started_at": session["started_at"],
        "ended_at": session["ended_at"],
        "error": session["error"],
        "created_at": session["created_at"],
        "updated_at": session["updated_at"],
    }


def to_live_track_payload(track: LiveTrackRecord) -> LiveTrackPayload:
    """Build a live track payload from one stored record."""
    return {
        "track_id": track["id"],
        "session_id": track["session_id"],
        "source": track["source"],
        "label": track["label"],
        "device_label": track["device_label"],
        "sample_rate": track["sample_rate"],
        "channel_count": track["channel_count"],
        "started_at": track["started_at"],
        "ended_at": track["ended_at"],
        "created_at": track["created_at"],
    }


def to_live_segment_payload(segment: LiveSegmentRecord) -> LiveSegmentPayload:
    """Build a live segment payload from one stored record."""
    return {
        "segment_id": segment["id"],
        "session_id": segment["session_id"],
        "track_id": segment["track_id"],
        "sequence": segment["sequence"],
        "start_ms": segment["start_ms"],
        "end_ms": segment["end_ms"],
        "text": segment["text"],
        "language": segment["language"],
        "confidence": segment["confidence"],
        "is_final": segment["is_final"],
        "created_at": segment["created_at"],
    }


def build_live_session_payload(
    *,
    session: LiveSessionRecord,
    tracks: list[LiveTrackRecord],
    segments: list[LiveSegmentRecord],
) -> LiveSessionPayload:
    """Build a live session detail payload."""
    return {
        **to_live_session_summary_payload(session),
        "tracks": [to_live_track_payload(track) for track in tracks],
        "segments": [to_live_segment_payload(segment) for segment in segments],
    }


def build_live_session_list_payload(
    *,
    sessions: list[LiveSessionRecord],
    total: int,
    limit: int,
    offset: int,
) -> LiveSessionListPayload:
    """Build a paged live session list payload."""
    return {
        "sessions": [to_live_session_summary_payload(session) for session in sessions],
        "total": total,
        "limit": limit,
        "offset": offset,
    }
