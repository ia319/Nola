"""Generate deterministic live realtime transcript results."""

from dataclasses import dataclass
from typing import Final

from nola.application.live.realtime.transcriber import (
    LiveRealtimeTranscriberFrame,
    LiveRealtimeTranscriberResult,
    LiveRealtimeTranscriptFinalCandidate,
    LiveRealtimeTranscriptPartial,
)

LIVE_REALTIME_MOCK_PARTIAL_INTERVAL_MS: Final = 500
LIVE_REALTIME_MOCK_FINAL_SEGMENT_MS: Final = 1000


@dataclass
class _MockTrackTranscriptionState:
    """Keep deterministic counters for one source track."""

    segment_start_ms: int | None = None
    segment_duration_ms: int = 0
    next_partial_duration_ms: int = LIVE_REALTIME_MOCK_PARTIAL_INTERVAL_MS
    partial_index: int = 0
    segment_index: int = 0


class MockLiveRealtimeTranscriber:
    """Produce deterministic partial and final transcripts from frame timing."""

    def __init__(
        self,
        *,
        partial_interval_ms: int = LIVE_REALTIME_MOCK_PARTIAL_INTERVAL_MS,
        final_segment_ms: int = LIVE_REALTIME_MOCK_FINAL_SEGMENT_MS,
    ) -> None:
        if partial_interval_ms <= 0:
            raise ValueError("Mock partial interval must be positive")
        if final_segment_ms <= partial_interval_ms:
            raise ValueError("Mock final segment duration must exceed partial interval")
        self._partial_interval_ms = partial_interval_ms
        self._final_segment_ms = final_segment_ms
        self._tracks: dict[str, _MockTrackTranscriptionState] = {}

    def accept_frame(
        self,
        frame: LiveRealtimeTranscriberFrame,
    ) -> tuple[LiveRealtimeTranscriberResult, ...]:
        """Accept one frame and emit threshold-driven transcript results."""
        state = self._tracks.setdefault(
            frame.track_id,
            _MockTrackTranscriptionState(
                next_partial_duration_ms=self._partial_interval_ms
            ),
        )
        if state.segment_start_ms is None:
            state.segment_start_ms = frame.start_ms

        state.segment_duration_ms += frame.duration_ms

        if state.segment_duration_ms >= self._final_segment_ms:
            state.segment_index += 1
            final = LiveRealtimeTranscriptFinalCandidate(
                track_id=frame.track_id,
                source=frame.source,
                start_ms=state.segment_start_ms,
                end_ms=frame.end_ms,
                text=f"Mock {frame.source} segment {state.segment_index}",
                language=None,
                confidence=None,
            )
            state.segment_start_ms = None
            state.segment_duration_ms = 0
            state.next_partial_duration_ms = self._partial_interval_ms
            return (final,)

        if state.segment_duration_ms >= state.next_partial_duration_ms:
            state.partial_index += 1
            partial = LiveRealtimeTranscriptPartial(
                track_id=frame.track_id,
                source=frame.source,
                partial_index=state.partial_index,
                start_ms=state.segment_start_ms,
                end_ms=frame.end_ms,
                text=f"Mock {frame.source} partial {state.partial_index}",
                language=None,
                confidence=None,
            )
            while state.next_partial_duration_ms <= state.segment_duration_ms:
                state.next_partial_duration_ms += self._partial_interval_ms
            return (partial,)

        return ()

    def release(self) -> None:
        """Clear buffered track timing state."""
        self._tracks.clear()
