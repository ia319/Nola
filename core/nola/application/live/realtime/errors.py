"""Define live realtime application errors."""

from nola.application.live.realtime.protocol import LiveRealtimeErrorCode


class LiveRealtimeSessionError(Exception):
    """Report one stable realtime session error."""

    def __init__(self, *, code: LiveRealtimeErrorCode, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


class LiveRealtimeTranscriberError(Exception):
    """Report one stable realtime transcriber error."""

    def __init__(self, *, code: LiveRealtimeErrorCode, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
