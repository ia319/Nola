"""Live realtime WebSocket protocol schemas."""

from typing import Annotated, Literal, TypeAlias

from pydantic import BaseModel, ConfigDict, Field

from nola.api.schemas.live import LiveSessionDetailResponse, LiveTrackResponse
from nola.application.live.realtime import (
    LIVE_REALTIME_AUDIO_BYTE_ORDER,
    LIVE_REALTIME_AUDIO_CHANNEL_COUNT,
    LIVE_REALTIME_AUDIO_ENCODING,
    LIVE_REALTIME_AUDIO_FRAME_MAX_MS,
    LIVE_REALTIME_AUDIO_FRAME_MIN_MS,
    LIVE_REALTIME_AUDIO_SAMPLE_RATE,
    LiveRealtimeErrorCode,
)
from nola.application.live.types import LiveTrackSource

LiveRealtimeEventId: TypeAlias = Annotated[str, Field(min_length=1, max_length=120)]
LiveRealtimeSessionId: TypeAlias = Annotated[str, Field(min_length=1, max_length=120)]
LiveRealtimeTrackId: TypeAlias = Annotated[str, Field(min_length=1, max_length=120)]
LiveRealtimeSentAt: TypeAlias = Annotated[str, Field(min_length=1, max_length=80)]
LiveRealtimeDiagnosticsOutputTarget: TypeAlias = Literal["default"]

LiveRealtimeClientEventType: TypeAlias = Literal[
    "client.hello",
    "track.start",
    "track.stop",
    "audio.frame",
    "diagnostics.wav.start",
    "diagnostics.wav.stop",
    "session.finish",
    "client.ping",
]
LiveRealtimeServerEventType: TypeAlias = Literal[
    "server.ready",
    "track.ready",
    "diagnostics.wav.started",
    "diagnostics.wav.stopped",
    "transcript.partial",
    "transcript.final",
    "session.finished",
    "server.error",
    "server.pong",
]


class LiveRealtimeEventEnvelope(BaseModel):
    """Accept a minimal event envelope for dispatch."""

    model_config = ConfigDict(extra="ignore")

    type: LiveRealtimeClientEventType
    protocol_version: int
    session_id: LiveRealtimeSessionId
    event_id: LiveRealtimeEventId
    sent_at: LiveRealtimeSentAt


class LiveRealtimeClientBaseEvent(BaseModel):
    """Accept one client WebSocket JSON event envelope."""

    model_config = ConfigDict(extra="forbid")

    type: LiveRealtimeClientEventType
    protocol_version: int
    session_id: LiveRealtimeSessionId
    event_id: LiveRealtimeEventId
    sent_at: LiveRealtimeSentAt


class LiveRealtimeServerBaseEvent(BaseModel):
    """Expose one server WebSocket JSON event envelope."""

    model_config = ConfigDict(extra="forbid")

    type: LiveRealtimeServerEventType
    protocol_version: int
    session_id: LiveRealtimeSessionId
    event_id: LiveRealtimeEventId
    sent_at: LiveRealtimeSentAt


class LiveRealtimeClientCapabilities(BaseModel):
    """Accept explicit client realtime capabilities."""

    model_config = ConfigDict(extra="forbid")

    supports_binary_audio: bool = True
    supports_diagnostics_wav: bool = False
    supports_system_audio: bool = False


class LiveRealtimeClientHelloEvent(LiveRealtimeClientBaseEvent):
    """Accept the initial realtime protocol handshake."""

    type: Literal["client.hello"]
    client_capabilities: LiveRealtimeClientCapabilities = Field(
        default_factory=LiveRealtimeClientCapabilities
    )


class LiveRealtimeTrackStartEvent(LiveRealtimeClientBaseEvent):
    """Accept one live track start request."""

    type: Literal["track.start"]
    source: LiveTrackSource
    sequence: int = Field(ge=0)
    label: str | None = Field(None, max_length=120)
    device_label: str | None = Field(None, max_length=200)
    sample_rate: int | None = Field(None, ge=1)
    channel_count: int | None = Field(None, ge=1)


class LiveRealtimeTrackStopEvent(LiveRealtimeClientBaseEvent):
    """Accept one live track stop request."""

    type: Literal["track.stop"]
    track_id: LiveRealtimeTrackId
    source: LiveTrackSource
    sequence: int = Field(ge=0)


class LiveRealtimeAudioFrameMetadataEvent(LiveRealtimeClientBaseEvent):
    """Accept metadata for the next binary audio frame."""

    type: Literal["audio.frame"]
    track_id: LiveRealtimeTrackId
    source: LiveTrackSource
    sequence: int = Field(ge=0)
    captured_at_ms: int = Field(ge=0)
    duration_ms: int = Field(ge=1)
    byte_length: int = Field(ge=1)
    encoding: Literal["pcm_s16le"] = LIVE_REALTIME_AUDIO_ENCODING
    sample_rate: Literal[16000] = LIVE_REALTIME_AUDIO_SAMPLE_RATE
    channel_count: Literal[1] = LIVE_REALTIME_AUDIO_CHANNEL_COUNT


class LiveRealtimeDiagnosticsWavStartEvent(LiveRealtimeClientBaseEvent):
    """Accept an explicit WAV diagnostic capture start request."""

    type: Literal["diagnostics.wav.start"]
    output_target: LiveRealtimeDiagnosticsOutputTarget | None = None
    max_duration_ms: int | None = Field(None, ge=1)
    max_bytes: int | None = Field(None, ge=1)
    tracks: list[LiveRealtimeTrackId] | None = None


class LiveRealtimeDiagnosticsWavStopEvent(LiveRealtimeClientBaseEvent):
    """Accept an explicit WAV diagnostic capture stop request."""

    type: Literal["diagnostics.wav.stop"]


class LiveRealtimeSessionFinishEvent(LiveRealtimeClientBaseEvent):
    """Accept a realtime session finish request."""

    type: Literal["session.finish"]


class LiveRealtimeClientPingEvent(LiveRealtimeClientBaseEvent):
    """Accept a realtime ping request."""

    type: Literal["client.ping"]


class LiveRealtimeAudioContract(BaseModel):
    """Expose the server audio frame contract."""

    encoding: Literal["pcm_s16le"] = LIVE_REALTIME_AUDIO_ENCODING
    byte_order: Literal["little_endian"] = LIVE_REALTIME_AUDIO_BYTE_ORDER
    sample_rate: Literal[16000] = LIVE_REALTIME_AUDIO_SAMPLE_RATE
    channel_count: Literal[1] = LIVE_REALTIME_AUDIO_CHANNEL_COUNT
    frame_duration_ms_min: int = LIVE_REALTIME_AUDIO_FRAME_MIN_MS
    frame_duration_ms_max: int = LIVE_REALTIME_AUDIO_FRAME_MAX_MS


class LiveRealtimeErrorPayload(BaseModel):
    """Expose one realtime protocol error."""

    code: LiveRealtimeErrorCode
    message: str


class LiveRealtimeServerReadyEvent(LiveRealtimeServerBaseEvent):
    """Expose the successful realtime handshake response."""

    type: Literal["server.ready"] = "server.ready"
    audio_contract: LiveRealtimeAudioContract
    session: LiveSessionDetailResponse


class LiveRealtimeTrackReadyEvent(LiveRealtimeServerBaseEvent):
    """Expose one created live track."""

    type: Literal["track.ready"] = "track.ready"
    track: LiveTrackResponse


class LiveRealtimeSessionFinishedEvent(LiveRealtimeServerBaseEvent):
    """Expose a realtime session finish response."""

    type: Literal["session.finished"] = "session.finished"
    session: LiveSessionDetailResponse


class LiveRealtimeServerErrorEvent(LiveRealtimeServerBaseEvent):
    """Expose a realtime protocol error event."""

    type: Literal["server.error"] = "server.error"
    error: LiveRealtimeErrorPayload


class LiveRealtimeServerPongEvent(LiveRealtimeServerBaseEvent):
    """Expose a realtime pong response."""

    type: Literal["server.pong"] = "server.pong"
