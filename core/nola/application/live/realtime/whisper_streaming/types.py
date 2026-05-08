"""Define Live WhisperStreaming runtime internal types."""

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Protocol

from nola.application.live.realtime.whisper_streaming.config import (
    WhisperStreamingRuntimeConfig,
)


@dataclass(frozen=True)
class WhisperStreamingWord:
    """Carry one model word with session-relative timing."""

    start_ms: int
    end_ms: int
    text: str


@dataclass(frozen=True)
class WhisperStreamingTranscriptChunk:
    """Carry one joined transcript chunk."""

    start_ms: int | None
    end_ms: int | None
    text: str

    @property
    def is_empty(self) -> bool:
        """Return whether the chunk has no persistable text."""
        return self.start_ms is None or self.end_ms is None or not self.text.strip()


@dataclass(frozen=True)
class WhisperStreamingProcessorUpdate:
    """Carry one online processor update."""

    processed: bool
    preview: WhisperStreamingTranscriptChunk
    committed_partial: WhisperStreamingTranscriptChunk
    final: WhisperStreamingTranscriptChunk
    context_reset: bool = False


@dataclass(frozen=True)
class WhisperStreamingModelOutput:
    """Carry one inference result normalized for online processing."""

    words: tuple[WhisperStreamingWord, ...]
    segment_end_ms: tuple[int, ...]


class WhisperStreamingInferenceBackend(Protocol):
    """Transcribe accumulated audio for one online processor."""

    separator: str

    def transcribe(
        self,
        waveform: Sequence[float],
        *,
        prompt: str,
        config: WhisperStreamingRuntimeConfig,
    ) -> WhisperStreamingModelOutput:
        """Return timestamped words for the accumulated waveform."""
        ...

    def close(self) -> None:
        """Release backend runtime resources."""
        ...


__all__ = [
    "WhisperStreamingInferenceBackend",
    "WhisperStreamingModelOutput",
    "WhisperStreamingProcessorUpdate",
    "WhisperStreamingTranscriptChunk",
    "WhisperStreamingWord",
]
