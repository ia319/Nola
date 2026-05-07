"""Unit tests for deterministic live realtime mock transcription."""

from nola.application.live.realtime import (
    MockLiveRealtimeTranscriber,
)
from nola.application.live.realtime.transcriber import (
    LiveRealtimeTranscriberFrame,
    LiveRealtimeTranscriptCommittedPartial,
    LiveRealtimeTranscriptFinalCandidate,
    LiveRealtimeTranscriptPartial,
    LiveRealtimeTranscriptPreview,
)


def _frame(sequence: int) -> LiveRealtimeTranscriberFrame:
    return LiveRealtimeTranscriberFrame(
        track_id="track-001",
        source="microphone",
        sequence=sequence,
        start_ms=sequence * 20,
        end_ms=(sequence + 1) * 20,
        duration_ms=20,
        waveform=(0.0,) * 320,
    )


def test_mock_transcriber_emits_deterministic_partial_and_final() -> None:
    """Mock transcriber should emit stable timing-based transcript events."""
    transcriber = MockLiveRealtimeTranscriber()

    early_results = [
        result
        for sequence in range(24)
        for result in transcriber.accept_frame(_frame(sequence))
    ]
    partial_results = transcriber.accept_frame(_frame(24))
    middle_results = [
        result
        for sequence in range(25, 49)
        for result in transcriber.accept_frame(_frame(sequence))
    ]
    final_results = transcriber.accept_frame(_frame(49))

    assert early_results == []
    assert middle_results == []
    assert len(partial_results) == 1
    assert len(final_results) == 1

    partial = partial_results[0]
    final = final_results[0]

    assert isinstance(partial, LiveRealtimeTranscriptPartial)
    assert isinstance(partial, LiveRealtimeTranscriptCommittedPartial)
    assert partial.result_kind == "committed_partial"
    assert partial.partial_index == 1
    assert partial.committed_index == 1
    assert partial.start_ms == 0
    assert partial.end_ms == 500
    assert partial.text == "Mock microphone partial 1"

    assert isinstance(final, LiveRealtimeTranscriptFinalCandidate)
    assert final.result_kind == "final"
    assert final.start_ms == 0
    assert final.end_ms == 1000
    assert final.text == "Mock microphone segment 1"


def test_mock_transcriber_tracks_sources_independently() -> None:
    """Mock transcriber should keep each track's thresholds independent."""
    transcriber = MockLiveRealtimeTranscriber()
    microphone_results = tuple(
        result
        for sequence in range(25)
        for result in transcriber.accept_frame(_frame(sequence))
    )
    system_results = tuple(
        result
        for sequence in range(24)
        for result in transcriber.accept_frame(
            LiveRealtimeTranscriberFrame(
                track_id="track-002",
                source="system",
                sequence=sequence,
                start_ms=sequence * 20,
                end_ms=(sequence + 1) * 20,
                duration_ms=20,
                waveform=(0.0,) * 320,
            )
        )
    )

    assert len(microphone_results) == 1
    assert isinstance(microphone_results[0], LiveRealtimeTranscriptPartial)
    assert microphone_results[0].result_kind == "committed_partial"
    assert microphone_results[0].text == "Mock microphone partial 1"
    assert system_results == ()


def test_realtime_transcript_preview_contract_is_websocket_only() -> None:
    """Preview transcript should expose a stable non-final result kind."""
    preview = LiveRealtimeTranscriptPreview(
        track_id="track-001",
        source="microphone",
        preview_index=1,
        start_ms=0,
        end_ms=240,
        text="Mock preview",
        language=None,
        confidence=None,
    )

    assert preview.result_kind == "preview"
    assert preview.preview_index == 1
