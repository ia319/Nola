"""Define live realtime transcriber boundaries."""

from dataclasses import dataclass
from typing import Literal, Protocol, TypeAlias

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
class LiveRealtimeTranscriptPreview:
    """Carry one non-persisted realtime preview transcript."""

    track_id: str
    source: LiveTrackSource
    preview_index: int
    start_ms: int
    end_ms: int
    text: str
    language: str | None
    confidence: float | None

    @property
    def result_kind(self) -> Literal["preview"]:
        """Return the stable transcriber result kind."""
        return "preview"


@dataclass(frozen=True)
class LiveRealtimeTranscriptCommittedPartial:
    """Carry one non-persisted LocalAgreement committed transcript."""

    track_id: str
    source: LiveTrackSource
    committed_index: int
    start_ms: int
    end_ms: int
    text: str
    language: str | None
    confidence: float | None

    @property
    def result_kind(self) -> Literal["committed_partial"]:
        """Return the stable transcriber result kind."""
        return "committed_partial"


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

    @property
    def result_kind(self) -> Literal["final"]:
        """Return the stable transcriber result kind."""
        return "final"


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
    LiveRealtimeTranscriptPreview
    | LiveRealtimeTranscriptCommittedPartial
    | LiveRealtimeTranscriptFinalCandidate
)
LiveRealtimeTranscriptEvent: TypeAlias = (
    LiveRealtimeTranscriptPreview
    | LiveRealtimeTranscriptCommittedPartial
    | LiveRealtimeTranscriptFinal
)


class LiveRealtimeTranscriber(Protocol):
    """Consume realtime waveform frames and emit transcript results."""

    def accept_frame(
        self,
        frame: LiveRealtimeTranscriberFrame,
    ) -> tuple[LiveRealtimeTranscriberResult, ...]:
        """Accept one waveform frame and return new transcript results."""
        ...

    def flush_track(
        self,
        *,
        track_id: str,
        source: LiveTrackSource,
    ) -> tuple[LiveRealtimeTranscriberResult, ...]:
        """Flush one track-scoped transcriber state."""
        ...

    def flush_all(self) -> tuple[LiveRealtimeTranscriberResult, ...]:
        """Flush all open track-scoped transcriber states."""
        ...

    def release(self) -> None:
        """Release connection-local transcriber state."""
        ...
