"""Validate and convert live realtime PCM frames."""

from dataclasses import dataclass
from struct import iter_unpack

from nola.application.live.realtime.errors import LiveRealtimeSessionError
from nola.application.live.realtime.protocol import (
    LIVE_REALTIME_AUDIO_BYTES_PER_SAMPLE,
    LIVE_REALTIME_AUDIO_CHANNEL_COUNT,
    LIVE_REALTIME_AUDIO_ENCODING,
    LIVE_REALTIME_AUDIO_FRAME_MAX_BYTES,
    LIVE_REALTIME_AUDIO_FRAME_MAX_MS,
    LIVE_REALTIME_AUDIO_FRAME_MIN_MS,
    LIVE_REALTIME_AUDIO_SAMPLE_RATE,
)
from nola.application.live.types import LiveTrackSource


@dataclass(frozen=True)
class LiveRealtimeAudioFrameMetadata:
    """Carry metadata for one track-scoped audio frame."""

    track_id: str
    source: LiveTrackSource
    sequence: int
    captured_at_ms: int
    duration_ms: int
    byte_length: int


@dataclass(frozen=True)
class LiveRealtimePcm16Frame:
    """Carry one validated PCM16LE/16 kHz/mono frame."""

    track_id: str
    source: LiveTrackSource
    sequence: int
    captured_at_ms: int
    duration_ms: int
    payload: bytes


def expected_pcm16le_byte_length(duration_ms: int) -> int:
    """Return the byte length required by the realtime PCM contract."""
    return (
        duration_ms
        * LIVE_REALTIME_AUDIO_SAMPLE_RATE
        // 1000
        * LIVE_REALTIME_AUDIO_CHANNEL_COUNT
        * LIVE_REALTIME_AUDIO_BYTES_PER_SAMPLE
    )


def validate_pcm16le_frame_metadata(
    metadata: LiveRealtimeAudioFrameMetadata,
) -> None:
    """Validate frame metadata against the realtime PCM contract."""
    if metadata.byte_length <= 0:
        raise LiveRealtimeSessionError(
            code="audio_frame_invalid",
            message="Audio frame byte length must be positive",
        )
    if metadata.duration_ms < LIVE_REALTIME_AUDIO_FRAME_MIN_MS:
        raise LiveRealtimeSessionError(
            code="audio_frame_invalid",
            message="Audio frame duration is shorter than the contract minimum",
        )
    if metadata.duration_ms > LIVE_REALTIME_AUDIO_FRAME_MAX_MS:
        raise LiveRealtimeSessionError(
            code="audio_frame_too_large",
            message="Audio frame duration exceeds the contract maximum",
        )
    if metadata.byte_length > LIVE_REALTIME_AUDIO_FRAME_MAX_BYTES:
        raise LiveRealtimeSessionError(
            code="audio_frame_too_large",
            message="Audio frame payload exceeds the contract maximum",
        )

    expected_byte_length = expected_pcm16le_byte_length(metadata.duration_ms)
    if metadata.byte_length != expected_byte_length:
        raise LiveRealtimeSessionError(
            code="audio_frame_invalid",
            message="Audio frame byte length does not match its duration",
        )


def build_pcm16le_frame(
    *,
    metadata: LiveRealtimeAudioFrameMetadata,
    payload: bytes,
) -> LiveRealtimePcm16Frame:
    """Build a validated PCM frame without altering the audio content."""
    validate_pcm16le_frame_metadata(metadata)
    if len(payload) != metadata.byte_length:
        raise LiveRealtimeSessionError(
            code="audio_frame_invalid",
            message="Audio frame payload length does not match metadata",
        )
    if len(payload) > LIVE_REALTIME_AUDIO_FRAME_MAX_BYTES:
        raise LiveRealtimeSessionError(
            code="audio_frame_too_large",
            message="Audio frame payload exceeds the contract maximum",
        )

    return LiveRealtimePcm16Frame(
        track_id=metadata.track_id,
        source=metadata.source,
        sequence=metadata.sequence,
        captured_at_ms=metadata.captured_at_ms,
        duration_ms=metadata.duration_ms,
        payload=payload,
    )


def pcm16le_to_float32_waveform(payload: bytes) -> tuple[float, ...]:
    """Convert signed PCM16LE samples to float32-compatible values."""
    if len(payload) % 2 != 0:
        raise LiveRealtimeSessionError(
            code="audio_frame_invalid",
            message="PCM16LE payload must contain whole 16-bit samples",
        )

    return tuple(sample / 32768.0 for (sample,) in iter_unpack("<h", payload))


def ensure_pcm16le_contract(
    *,
    encoding: str,
    sample_rate: int,
    channel_count: int,
) -> None:
    """Validate explicit audio format metadata."""
    if (
        encoding != LIVE_REALTIME_AUDIO_ENCODING
        or sample_rate != LIVE_REALTIME_AUDIO_SAMPLE_RATE
        or channel_count != LIVE_REALTIME_AUDIO_CHANNEL_COUNT
    ):
        raise LiveRealtimeSessionError(
            code="audio_format_unsupported",
            message="Audio frame format must be PCM16LE, 16 kHz, mono",
        )
