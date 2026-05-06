"""Define live realtime protocol constants."""

from typing import Final, Literal, TypeAlias

LIVE_REALTIME_PROTOCOL_VERSION: Final = 1
LIVE_REALTIME_SUPPORTED_PROTOCOL_VERSIONS: Final = (LIVE_REALTIME_PROTOCOL_VERSION,)

LIVE_REALTIME_AUDIO_ENCODING: Final = "pcm_s16le"
LIVE_REALTIME_AUDIO_BYTE_ORDER: Final = "little_endian"
LIVE_REALTIME_AUDIO_SAMPLE_RATE: Final = 16000
LIVE_REALTIME_AUDIO_CHANNEL_COUNT: Final = 1
LIVE_REALTIME_AUDIO_BYTES_PER_SAMPLE: Final = 2
LIVE_REALTIME_AUDIO_FRAME_MIN_MS: Final = 20
LIVE_REALTIME_AUDIO_FRAME_MAX_MS: Final = 100
LIVE_REALTIME_AUDIO_FRAME_MAX_BYTES: Final = (
    LIVE_REALTIME_AUDIO_SAMPLE_RATE
    * LIVE_REALTIME_AUDIO_FRAME_MAX_MS
    // 1000
    * LIVE_REALTIME_AUDIO_CHANNEL_COUNT
    * LIVE_REALTIME_AUDIO_BYTES_PER_SAMPLE
)

LIVE_REALTIME_DIAGNOSTICS_WAV_DEFAULT_MAX_DURATION_MS: Final = 60_000
LIVE_REALTIME_DIAGNOSTICS_WAV_MAX_DURATION_MS: Final = 300_000
LIVE_REALTIME_DIAGNOSTICS_WAV_DEFAULT_MAX_BYTES: Final = 32 * 1024 * 1024
LIVE_REALTIME_DIAGNOSTICS_WAV_MAX_BYTES: Final = 128 * 1024 * 1024

LiveRealtimeErrorCode: TypeAlias = Literal[
    "protocol_version_unsupported",
    "session_not_found",
    "session_not_active",
    "session_already_streaming",
    "invalid_event",
    "invalid_event_order",
    "invalid_track",
    "track_source_unsupported",
    "audio_format_unsupported",
    "audio_frame_invalid",
    "audio_sequence_invalid",
    "audio_frame_too_large",
    "diagnostics_wav_already_started",
    "diagnostics_wav_not_started",
    "diagnostics_wav_output_invalid",
    "diagnostics_wav_limit_exceeded",
    "diagnostics_wav_write_failed",
    "connection_closed",
    "mock_transcriber_failed",
    "repository_write_failed",
    "internal_error",
]

LIVE_REALTIME_ERROR_CODES: tuple[LiveRealtimeErrorCode, ...] = (
    "protocol_version_unsupported",
    "session_not_found",
    "session_not_active",
    "session_already_streaming",
    "invalid_event",
    "invalid_event_order",
    "invalid_track",
    "track_source_unsupported",
    "audio_format_unsupported",
    "audio_frame_invalid",
    "audio_sequence_invalid",
    "audio_frame_too_large",
    "diagnostics_wav_already_started",
    "diagnostics_wav_not_started",
    "diagnostics_wav_output_invalid",
    "diagnostics_wav_limit_exceeded",
    "diagnostics_wav_write_failed",
    "connection_closed",
    "mock_transcriber_failed",
    "repository_write_failed",
    "internal_error",
)
