"""Live transcription request and response schemas."""

from typing import TypeAlias

from pydantic import BaseModel, ConfigDict, Field

from nola.api.schemas.live_realtime_config import LiveRealtimeRuntimeOverridesRequest
from nola.application.live.types import (
    LiveSessionMode,
    LiveSessionStatus,
    LiveTrackSource,
)

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
