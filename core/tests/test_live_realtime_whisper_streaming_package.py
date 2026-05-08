"""Unit tests for the Live WhisperStreaming runtime package skeleton."""

import pytest

from nola.application.live.realtime.whisper_streaming import (
    WHISPER_STREAMING_SAMPLE_RATE,
    WhisperStreamingRuntimeConfig,
    WhisperStreamingRuntimeConfigError,
    WhisperStreamingTranscriptChunk,
    WhisperStreamingVadParameters,
    validate_whisper_streaming_runtime_config,
)


def test_whisper_streaming_package_exports_runtime_config() -> None:
    """Validate package-level runtime config exports."""
    config = validate_whisper_streaming_runtime_config(WhisperStreamingRuntimeConfig())

    assert config.sample_rate == WHISPER_STREAMING_SAMPLE_RATE
    assert config.buffer_trimming_ms == 15000
    assert config.prompt_max_chars == 200
    assert config.max_duplicate_ngram == 5


def test_whisper_streaming_config_accepts_typed_vad_parameters() -> None:
    """Validate runtime VAD parameters match faster-whisper fields."""
    vad_parameters: WhisperStreamingVadParameters = {
        "threshold": 0.5,
        "neg_threshold": None,
        "min_silence_duration_ms": 500,
        "speech_pad_ms": 100,
    }

    config = WhisperStreamingRuntimeConfig(vad_parameters=vad_parameters)

    assert config.vad_parameters == vad_parameters


def test_whisper_streaming_config_rejects_invalid_silence_order() -> None:
    """Validate stable config errors for invalid silence thresholds."""
    with pytest.raises(WhisperStreamingRuntimeConfigError) as exc_info:
        validate_whisper_streaming_runtime_config(
            WhisperStreamingRuntimeConfig(
                segment_close_silence_ms=1000,
                context_reset_silence_ms=500,
            )
        )

    assert exc_info.value.code == "runtime_config_invalid"
    assert "context_reset_silence_ms" in exc_info.value.message


def test_whisper_streaming_transcript_chunk_reports_empty_text() -> None:
    """Validate empty chunk detection for final suppression."""
    assert WhisperStreamingTranscriptChunk(None, None, "").is_empty is True
    assert WhisperStreamingTranscriptChunk(0, 1000, "   ").is_empty is True
    assert WhisperStreamingTranscriptChunk(0, 1000, "hello").is_empty is False
