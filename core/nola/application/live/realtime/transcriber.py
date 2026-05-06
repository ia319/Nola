"""Define live realtime transcriber boundaries."""

from dataclasses import dataclass
from typing import Protocol, TypeAlias

from nola.application.live.types import LiveTrackSource


@dataclass(frozen=True)
class LiveRealtimeTranscriberFrame:
    """Carry one track-scoped waveform frame to a realtime transcriber."""

    track_id: str
    source: LiveTrackSource
    sequence: int
    start_ms: int
    end_ms: int
    duration_ms: int
    waveform: tuple[float, ...]


@dataclass(frozen=True)
class LiveRealtimeTranscriptPartial:
    """Carry one non-persisted realtime partial transcript."""

    track_id: str
    source: LiveTrackSource
    partial_index: int
    start_ms: int
    end_ms: int
    text: str
    language: str | None
    confidence: float | None


@dataclass(frozen=True)
class LiveRealtimeTranscriptFinalCandidate:
    """Carry one transcriber final candidate before repository persistence."""

    track_id: str
    source: LiveTrackSource
    start_ms: int
    end_ms: int
    text: str
    language: str | None
    confidence: float | None


@dataclass(frozen=True)
class LiveRealtimeTranscriptFinal:
    """Carry one persisted realtime final transcript."""

    segment_id: str
    session_id: str
    track_id: str
    source: LiveTrackSource
    sequence: int
    start_ms: int
    end_ms: int
    text: str
    language: str | None
    confidence: float | None
    created_at: str


LiveRealtimeTranscriberResult: TypeAlias = (
    LiveRealtimeTranscriptPartial | LiveRealtimeTranscriptFinalCandidate
)
LiveRealtimeTranscriptEvent: TypeAlias = (
    LiveRealtimeTranscriptPartial | LiveRealtimeTranscriptFinal
)


class LiveRealtimeTranscriber(Protocol):
    """Consume realtime waveform frames and emit transcript results."""

    def accept_frame(
        self,
        frame: LiveRealtimeTranscriberFrame,
    ) -> tuple[LiveRealtimeTranscriberResult, ...]:
        """Accept one waveform frame and return new transcript results."""
        ...

    def release(self) -> None:
        """Release connection-local transcriber state."""
        ...
