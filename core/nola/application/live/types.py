"""Shared payload and value types for live transcription use-cases."""

from typing import Literal, TypeAlias, TypedDict

from typing_extensions import NotRequired

from nola.common.types import JsonDict
from nola.config.common import ConfigMap

LiveSessionStatus = Literal["active", "finished", "failed"]
LiveSessionMode = Literal["streaming", "background"]
LiveTrackSource = Literal["microphone", "system"]
LiveSessionSortBy = Literal["started_at", "ended_at", "status", "title"]
LiveSortOrder = Literal["asc", "desc"]
LiveRealtimeRuntimeOverrides: TypeAlias = ConfigMap
LiveRuntimeConfig: TypeAlias = JsonDict
LiveRequestOverrides: TypeAlias = JsonDict

LIVE_SESSION_STATUSES: tuple[LiveSessionStatus, ...] = (
    "active",
    "finished",
    "failed",
)
DELETABLE_LIVE_SESSION_STATUSES: tuple[LiveSessionStatus, ...] = (
    "finished",
    "failed",
)
LIVE_SESSION_MODES: tuple[LiveSessionMode, ...] = ("streaming", "background")
LIVE_TRACK_SOURCES: tuple[LiveTrackSource, ...] = ("microphone", "system")
LIVE_SESSION_SORT_FIELDS: tuple[LiveSessionSortBy, ...] = (
    "started_at",
    "ended_at",
    "status",
    "title",
)
LIVE_SORT_ORDERS: tuple[LiveSortOrder, ...] = ("asc", "desc")
DEFAULT_LIVE_SESSION_SORT_BY: LiveSessionSortBy = "started_at"
DEFAULT_LIVE_SORT_ORDER: LiveSortOrder = "desc"
DEFAULT_LIVE_SEGMENT_LIMIT = 100
MAX_LIVE_SEGMENT_LIMIT = 500
DEFAULT_LIVE_SESSION_LIMIT = 50
MAX_LIVE_SESSION_LIMIT = 100
MAX_BATCH_LIVE_SESSION_IDS = 500
BatchLiveSessionActionErrorCode = Literal[
    "not_found",
    "invalid_status",
    "duplicate_session_id",
]


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
    request_overrides: LiveRequestOverrides | None
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

    request_overrides: LiveRequestOverrides | None
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


class DeleteLiveSessionRecordPayload(TypedDict):
    """Delete-live-session-record payload."""

    session_id: str
    message: str


class BatchLiveSessionActionSummaryPayload(TypedDict):
    """Batch live session action summary counts."""

    requested: int
    succeeded: int
    failed: int


class BatchLiveSessionActionResultPayload(TypedDict):
    """Per-session result for batch live session actions."""

    session_id: str
    ok: bool
    message: str
    error_code: NotRequired[BatchLiveSessionActionErrorCode]
    status: NotRequired[LiveSessionStatus]


BatchLiveSessionActionName = Literal["delete_record"]


class BatchLiveSessionActionPayload(TypedDict):
    """Batch live session action payload."""

    action: BatchLiveSessionActionName
    summary: BatchLiveSessionActionSummaryPayload
    results: list[BatchLiveSessionActionResultPayload]
