"""Live transcription request and response schemas."""

from typing import TypeAlias

from pydantic import BaseModel, ConfigDict, Field, JsonValue

from nola.api.schemas.live_realtime_config import LiveRealtimeRuntimeOverridesRequest
from nola.application.live.types import (
    MAX_BATCH_LIVE_SESSION_IDS,
    BatchLiveSessionActionErrorCode,
    BatchLiveSessionActionName,
    LiveSessionMode,
    LiveSessionStatus,
    LiveTrackSource,
)
from nola.config.export import ExportFormat

LiveSessionModeLiteral: TypeAlias = LiveSessionMode
LiveSessionStatusLiteral: TypeAlias = LiveSessionStatus
LiveTrackSourceLiteral: TypeAlias = LiveTrackSource


class CreateLiveSessionRequest(BaseModel):
    """Accept live session creation metadata."""

    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(None, max_length=200)
    mode: LiveSessionModeLiteral
    language_hint: str | None = Field(None, max_length=32)
    model_id: str | None = Field(None, max_length=200)
    runtime_overrides: LiveRealtimeRuntimeOverridesRequest | None = None


class LiveTrackResponse(BaseModel):
    """Expose one live audio track."""

    track_id: str
    session_id: str
    source: LiveTrackSourceLiteral
    label: str | None = None
    device_label: str | None = None
    sample_rate: int | None = None
    channel_count: int | None = None
    started_at: str | None = None
    ended_at: str | None = None
    created_at: str


class LiveSegmentResponse(BaseModel):
    """Expose one live transcript segment."""

    segment_id: str
    session_id: str
    track_id: str | None = None
    sequence: int
    start_ms: int
    end_ms: int
    text: str
    language: str | None = None
    confidence: float | None = None
    is_final: bool
    created_at: str


class LiveSessionSummaryResponse(BaseModel):
    """Expose one live session summary."""

    session_id: str
    title: str | None = None
    mode: LiveSessionModeLiteral
    status: LiveSessionStatusLiteral
    language_hint: str | None = None
    model_id: str | None = None
    runtime: str | None = None
    audio_format: str | None = None
    started_at: str
    ended_at: str | None = None
    error: str | None = None
    created_at: str
    updated_at: str


class LiveSessionDetailResponse(LiveSessionSummaryResponse):
    """Expose one live session with tracks and a paged segment window."""

    request_overrides: dict[str, JsonValue] | None = Field(
        default=None,
        description="User-provided live override parameters accepted at creation time.",
    )
    runtime_config: dict[str, JsonValue] | None = Field(
        default=None,
        description=(
            "Resolved runtime snapshot for diagnostics and future comparison UI."
        ),
    )
    tracks: list[LiveTrackResponse]
    segments: list[LiveSegmentResponse]
    segment_total: int
    segment_limit: int
    segment_offset: int


class LiveSessionListResponse(BaseModel):
    """Expose paged live session summaries."""

    sessions: list[LiveSessionSummaryResponse]
    total: int
    limit: int
    offset: int


class LiveSessionBatchExportRequest(BaseModel):
    """Accept batch export options for multiple live sessions."""

    session_ids: list[str] = Field(
        ...,
        min_length=1,
        max_length=MAX_BATCH_LIVE_SESSION_IDS,
        description="List of live session IDs to export",
    )
    format: ExportFormat | None = Field(
        None,
        description=(
            "Output format for all files. "
            "If omitted, resolve from persisted export defaults."
        ),
    )
    include_timestamps: bool | None = Field(
        None,
        description=(
            "Include timestamps in TXT format. "
            "If omitted, resolve from persisted export defaults."
        ),
    )
    zip_name: str | None = Field(
        None,
        description="Custom ZIP filename (without extension)",
    )


class BatchLiveSessionActionRequest(BaseModel):
    """Batch action request for live session record operations."""

    session_ids: list[str] = Field(
        ...,
        min_length=1,
        max_length=MAX_BATCH_LIVE_SESSION_IDS,
        description="List of live session IDs to process",
    )


class DeleteLiveSessionRecordResponse(BaseModel):
    """Live session record deletion response."""

    session_id: str
    message: str


class BatchLiveSessionActionResultResponse(BaseModel):
    """Per-session result for batch live actions."""

    session_id: str
    ok: bool
    message: str
    error_code: BatchLiveSessionActionErrorCode | None = None
    status: LiveSessionStatusLiteral | None = None


class BatchLiveSessionActionSummaryResponse(BaseModel):
    """Batch live action summary counts."""

    requested: int
    succeeded: int
    failed: int


class BatchLiveSessionActionResponse(BaseModel):
    """Response for batch live actions."""

    action: BatchLiveSessionActionName
    summary: BatchLiveSessionActionSummaryResponse
    results: list[BatchLiveSessionActionResultResponse]
