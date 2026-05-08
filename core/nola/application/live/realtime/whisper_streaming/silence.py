"""Track realtime silence state for segment decisions."""

from collections.abc import Sequence
from dataclasses import dataclass
from math import sqrt

from nola.application.live.realtime.whisper_streaming.config import (
    WhisperStreamingRuntimeConfig,
)


@dataclass(frozen=True)
class WhisperStreamingSilenceUpdate:
    """Carry silence boundary decisions for one audio frame."""

    is_silence: bool
    rms: float
    consecutive_silence_ms: int
    segment_close: bool
    context_reset: bool


class WhisperStreamingSilenceDetector:
    """Track consecutive silence without altering audio samples."""

    def __init__(self, *, config: WhisperStreamingRuntimeConfig) -> None:
        self._config = config
        self._consecutive_silence_ms = 0
        self._context_reset_emitted = False

    @property
    def consecutive_silence_ms(self) -> int:
        """Return the current consecutive silence duration."""
        return self._consecutive_silence_ms

    def inspect(
        self,
        waveform: Sequence[float],
        *,
        duration_ms: int,
    ) -> WhisperStreamingSilenceUpdate:
        """Inspect one waveform frame and return boundary decisions."""
        rms = _rms(waveform)
        is_silence = rms <= self._config.silence_rms_threshold
        if is_silence:
            self._consecutive_silence_ms += duration_ms
        else:
            self._consecutive_silence_ms = 0
            self._context_reset_emitted = False

        context_reset = (
            self._consecutive_silence_ms >= self._config.context_reset_silence_ms
            and not self._context_reset_emitted
        )
        if context_reset:
            self._context_reset_emitted = True

        return WhisperStreamingSilenceUpdate(
            is_silence=is_silence,
            rms=rms,
            consecutive_silence_ms=self._consecutive_silence_ms,
            segment_close=(
                self._consecutive_silence_ms >= self._config.segment_close_silence_ms
            ),
            context_reset=context_reset,
        )

    def reset(self) -> None:
        """Clear tracked silence state."""
        self._consecutive_silence_ms = 0
        self._context_reset_emitted = False


def _rms(waveform: Sequence[float]) -> float:
    if not waveform:
        return 0.0
    squared_sum = sum(sample * sample for sample in waveform)
    return sqrt(squared_sum / len(waveform))


__all__ = [
    "WhisperStreamingSilenceDetector",
    "WhisperStreamingSilenceUpdate",
]
