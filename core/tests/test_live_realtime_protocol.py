"""Tests for live realtime WebSocket protocol builders."""

from nola.api.routes._live_realtime_events import (
    build_transcript_committed_partial_event,
    build_transcript_preview_event,
)
from nola.application.live.realtime import (
    LIVE_REALTIME_PROTOCOL_VERSION,
    LiveRealtimeTranscriptCommittedPartial,
    LiveRealtimeTranscriptPreview,
)


def test_transcript_preview_event_payload_is_non_persisted() -> None:
    """Preview transcript events should expose stable WebSocket-only metadata."""
    event = build_transcript_preview_event(
        session_id="live-001",
        preview=LiveRealtimeTranscriptPreview(
            track_id="track-001",
            source="microphone",
            preview_index=1,
            start_ms=0,
            end_ms=240,
            text="preview text",
            language=None,
            confidence=None,
        ),
    )

    payload = event.model_dump(mode="json")

    assert payload["type"] == "transcript.preview"
    assert payload["protocol_version"] == LIVE_REALTIME_PROTOCOL_VERSION
    assert payload["session_id"] == "live-001"
    assert payload["transcript"] == {
        "result_kind": "preview",
        "session_id": "live-001",
        "track_id": "track-001",
        "source": "microphone",
        "preview_index": 1,
        "start_ms": 0,
        "end_ms": 240,
        "text": "preview text",
        "language": None,
        "confidence": None,
        "is_final": False,
    }


def test_transcript_committed_partial_event_payload_uses_stable_order() -> None:
    """Committed transcript events should expose stable ordering metadata."""
    event = build_transcript_committed_partial_event(
        session_id="live-001",
        committed_partial=LiveRealtimeTranscriptCommittedPartial(
            track_id="track-001",
            source="microphone",
            committed_index=2,
            start_ms=240,
            end_ms=500,
            text="committed text",
            language="en",
            confidence=0.75,
        ),
    )

    transcript = event.model_dump(mode="json")["transcript"]

    assert transcript["result_kind"] == "committed_partial"
    assert transcript["session_id"] == "live-001"
    assert transcript["track_id"] == "track-001"
    assert transcript["source"] == "microphone"
    assert transcript["committed_index"] == 2
    assert transcript["is_final"] is False
