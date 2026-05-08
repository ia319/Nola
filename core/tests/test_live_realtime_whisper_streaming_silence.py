"""Unit tests for WhisperStreaming silence boundary detection."""

import pytest

from nola.application.live.realtime.whisper_streaming import (
    WhisperStreamingRuntimeConfig,
    WhisperStreamingSilenceDetector,
)


def test_silence_detector_tracks_close_and_reset_thresholds() -> None:
    """Validate silence thresholds without altering waveform data."""
    detector = WhisperStreamingSilenceDetector(
        config=WhisperStreamingRuntimeConfig(
            silence_rms_threshold=0.05,
            segment_close_silence_ms=500,
            context_reset_silence_ms=1000,
        )
    )
    waveform = (0.0,) * 1600

    first = detector.inspect(waveform, duration_ms=250)
    second = detector.inspect(waveform, duration_ms=250)
    third = detector.inspect(waveform, duration_ms=500)
    repeated = detector.inspect(waveform, duration_ms=250)

    assert first.is_silence is True
    assert first.segment_close is False
    assert second.segment_close is True
    assert third.context_reset is True
    assert repeated.context_reset is False


def test_silence_detector_resets_after_speech() -> None:
    """Validate speech clears accumulated silence state."""
    detector = WhisperStreamingSilenceDetector(
        config=WhisperStreamingRuntimeConfig(silence_rms_threshold=0.05)
    )

    detector.inspect((0.0,) * 1600, duration_ms=500)
    speech = detector.inspect((0.2,) * 1600, duration_ms=100)

    assert speech.is_silence is False
    assert speech.consecutive_silence_ms == 0
    assert detector.consecutive_silence_ms == 0


def test_silence_detector_rejects_non_positive_duration() -> None:
    """Validate positive duration requirements at the detector boundary."""
    detector = WhisperStreamingSilenceDetector(config=WhisperStreamingRuntimeConfig())

    with pytest.raises(ValueError, match="duration_ms must be positive"):
        detector.inspect((), duration_ms=0)
