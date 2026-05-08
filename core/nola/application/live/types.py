"""Shared payload and value types for live transcription use-cases."""

from typing import Literal, TypeAlias, TypedDict

from nola.common.types import JsonDict
from nola.config.common import ConfigMap

LiveSessionStatus = Literal["active", "finished", "failed"]
LiveSessionMode = Literal["streaming", "background"]
LiveTrackSource = Literal["microphone", "system"]
LiveRealtimeRuntimeOverrides: TypeAlias = ConfigMap
LiveRuntimeConfig: TypeAlias = JsonDict

LIVE_SESSION_STATUSES: tuple[LiveSessionStatus, ...] = (
    "active",
    "finished",
    "failed",
)
LIVE_SESSION_MODES: tuple[LiveSessionMode, ...] = ("streaming", "background")
LIVE_TRACK_SOURCES: tuple[LiveTrackSource, ...] = ("microphone", "system")
DEFAULT_LIVE_SEGMENT_LIMIT = 100
MAX_LIVE_SEGMENT_LIMIT = 500
DEFAULT_LIVE_SESSION_LIMIT = 50
MAX_LIVE_SESSION_LIMIT = 100


class LiveSessionRecord(TypedDict):
    """Stored live session record used by application use-cases."""

    id: str
    title: str | None
    mode: LiveSessionMode
    status: LiveSessionStatus
    language_hint: str | None
    model_id: str | None
    runtime: str | None
    audio_format: str | None
    runtime_config: LiveRuntimeConfig | None
    started_at: str
    ended_at: str | None
    error: str | None
    created_at: str
    updated_at: str


class LiveTrackRecord(TypedDict):
    """Stored live audio track record used by application use-cases."""

    id: str
    session_id: str
    source: LiveTrackSource
    label: str | None
    device_label: str | None
    sample_rate: int | None
    channel_count: int | None
    started_at: str | None
    ended_at: str | None
    created_at: str


class LiveSegmentRecord(TypedDict):
    """Stored live transcript segment record used by application use-cases."""

    id: str
    session_id: str
    track_id: str | None
    sequence: int
    start_ms: int
    end_ms: int
    text: str
    language: str | None
    confidence: float | None
    is_final: bool
    created_at: str


class LiveSessionSummaryPayload(TypedDict):
    """Live session summary payload used in list responses."""

    session_id: str
    title: str | None
    mode: LiveSessionMode
    status: LiveSessionStatus
    language_hint: str | None
    model_id: str | None
    runtime: str | None
    audio_format: str | None
    started_at: str
    ended_at: str | None
    error: str | None
    created_at: str
    updated_at: str


class LiveTrackPayload(TypedDict):
    """Live track payload used in session detail responses."""

    track_id: str
    session_id: str
    source: LiveTrackSource
    label: str | None
    device_label: str | None
    sample_rate: int | None
    channel_count: int | None
    started_at: str | None
    ended_at: str | None
    created_at: str


class LiveSegmentPayload(TypedDict):
    """Live segment payload used in session detail responses."""

    segment_id: str
    session_id: str
    track_id: str | None
    sequence: int
    start_ms: int
    end_ms: int
    text: str
    language: str | None
    confidence: float | None
    is_final: bool
    created_at: str


class LiveSessionPayload(LiveSessionSummaryPayload):
    """Live session detail payload with tracks and segments."""

    runtime_config: LiveRuntimeConfig | None
    tracks: list[LiveTrackPayload]
    segments: list[LiveSegmentPayload]
    segment_total: int
    segment_limit: int
    segment_offset: int


class LiveSessionListPayload(TypedDict):
    """Paged live session list payload."""

    sessions: list[LiveSessionSummaryPayload]
    total: int
    limit: int
    offset: int
