"""Define Live WhisperStreaming runtime errors."""

from nola.application.live.realtime.errors import LiveRealtimeTranscriberError
from nola.application.live.realtime.protocol import LiveRealtimeErrorCode


class WhisperStreamingRuntimeError(LiveRealtimeTranscriberError):
    """Report one stable WhisperStreaming runtime error."""

    def __init__(self, *, code: LiveRealtimeErrorCode, message: str) -> None:
        super().__init__(code=code, message=message)


class WhisperStreamingRuntimeConfigError(WhisperStreamingRuntimeError):
    """Report invalid WhisperStreaming runtime configuration."""

    def __init__(self, message: str) -> None:
        super().__init__(code="runtime_config_invalid", message=message)


__all__ = [
    "WhisperStreamingRuntimeConfigError",
    "WhisperStreamingRuntimeError",
]
