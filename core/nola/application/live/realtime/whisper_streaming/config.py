"""Define Live WhisperStreaming runtime configuration."""

from dataclasses import dataclass
from typing import Final, Literal, TypedDict

from nola.application.live.realtime.whisper_streaming.errors import (
    WhisperStreamingRuntimeConfigError,
)

WHISPER_STREAMING_SAMPLE_RATE: Final = 16000


class WhisperStreamingVadParameters(TypedDict, total=False):
    """Match faster-whisper VadOptions fields used by Live runtime."""

    threshold: float
    neg_threshold: float | None
    min_speech_duration_ms: int
    max_speech_duration_s: float
    min_silence_duration_ms: int
    speech_pad_ms: int


@dataclass(frozen=True)
class WhisperStreamingRuntimeConfig:
    """Configure one Live WhisperStreaming runtime."""

    sample_rate: Literal[16000] = WHISPER_STREAMING_SAMPLE_RATE
    min_chunk_ms: int = 1000
    buffer_trimming_ms: int = 15000
    prompt_max_chars: int = 200
    timestamp_tolerance_ms: int = 100
    max_duplicate_ngram: int = 5
    vad_filter: bool = False
    vad_parameters: WhisperStreamingVadParameters | None = None
    segment_close_silence_ms: int = 500
    context_reset_silence_ms: int = 2000


def validate_whisper_streaming_runtime_config(
    config: WhisperStreamingRuntimeConfig,
) -> WhisperStreamingRuntimeConfig:
    """Return a valid runtime config or raise a stable runtime error."""
    if config.sample_rate != WHISPER_STREAMING_SAMPLE_RATE:
        raise WhisperStreamingRuntimeConfigError(
            "WhisperStreaming requires 16 kHz audio"
        )

    positive_fields = {
        "min_chunk_ms": config.min_chunk_ms,
        "buffer_trimming_ms": config.buffer_trimming_ms,
        "prompt_max_chars": config.prompt_max_chars,
        "max_duplicate_ngram": config.max_duplicate_ngram,
        "segment_close_silence_ms": config.segment_close_silence_ms,
        "context_reset_silence_ms": config.context_reset_silence_ms,
    }
    for field_name, value in positive_fields.items():
        if value <= 0:
            raise WhisperStreamingRuntimeConfigError(
                f"{field_name} must be greater than 0"
            )

    if config.timestamp_tolerance_ms < 0:
        raise WhisperStreamingRuntimeConfigError(
            "timestamp_tolerance_ms must be greater than or equal to 0"
        )

    if config.context_reset_silence_ms < config.segment_close_silence_ms:
        raise WhisperStreamingRuntimeConfigError(
            "context_reset_silence_ms must be greater than or equal to "
            "segment_close_silence_ms"
        )

    return config


__all__ = [
    "WHISPER_STREAMING_SAMPLE_RATE",
    "WhisperStreamingRuntimeConfig",
    "WhisperStreamingVadParameters",
    "validate_whisper_streaming_runtime_config",
]
