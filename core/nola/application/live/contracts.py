"""Declare live transcription contracts used by the application layer."""

from typing import Protocol

from nola.application.live.types import (
    DEFAULT_LIVE_SEGMENT_LIMIT,
    DEFAULT_LIVE_SESSION_LIMIT,
    LiveRequestOverrides,
    LiveRuntimeConfig,
    LiveSegmentRecord,
    LiveSessionMode,
    LiveSessionRecord,
    LiveSessionStatus,
    LiveTrackRecord,
    LiveTrackSource,
)


class SupportsLiveSessionQueries(Protocol):
    """Expose live session reads required by live use-cases."""

    def get_session(self, session_id: str) -> LiveSessionRecord | None:
        """Return one live session by id."""
        ...

    def list_sessions(
        self, limit: int = DEFAULT_LIVE_SESSION_LIMIT, offset: int = 0
    ) -> list[LiveSessionRecord]:
        """Return paged live session records."""
        ...

    def count_sessions(self) -> int:
        """Return the total live session count."""
        ...


class SupportsLiveSessionMutations(Protocol):
    """Expose live session writes required by live use-cases."""

    def create_session(
        self,
        *,
        session_id: str,
        title: str | None,
        mode: LiveSessionMode,
        status: LiveSessionStatus,
        language_hint: str | None,
        model_id: str | None,
        runtime: str | None,
        audio_format: str | None,
        runtime_config: LiveRuntimeConfig | None = None,
        request_overrides: LiveRequestOverrides | None = None,
        started_at: str,
        created_at: str,
        updated_at: str,
    ) -> LiveSessionRecord:
        """Create one live session and return its stored snapshot."""
        ...

    def finish_session(
        self,
        session_id: str,
        *,
        ended_at: str,
        updated_at: str,
    ) -> LiveSessionRecord | None:
        """Mark an active live session finished and return the updated snapshot."""
        ...

    def fail_session(
        self,
        session_id: str,
        *,
        error: str,
        ended_at: str,
        updated_at: str,
    ) -> LiveSessionRecord | None:
        """Mark an active live session failed and return the updated snapshot."""
        ...


class SupportsLiveTrackQueries(Protocol):
    """Expose live track reads required by live use-cases."""

    def list_tracks(self, session_id: str) -> list[LiveTrackRecord]:
        """Return tracks attached to one live session."""
        ...


class SupportsLiveTrackMutations(Protocol):
    """Expose live track writes required by live use-cases."""

    def create_track(
        self,
        *,
        track_id: str,
        session_id: str,
        source: LiveTrackSource,
        label: str | None,
        device_label: str | None,
        sample_rate: int | None,
        channel_count: int | None,
        started_at: str | None,
        ended_at: str | None,
        created_at: str,
    ) -> LiveTrackRecord:
        """Create one live audio track and return its stored snapshot."""
        ...

    def finish_track(
        self,
        track_id: str,
        session_id: str,
        *,
        ended_at: str,
    ) -> LiveTrackRecord | None:
        """Mark one active live track finished and return the updated snapshot."""
        ...


class SupportsLiveSegmentQueries(Protocol):
    """Expose live segment reads required by live use-cases."""

    def list_segments(
        self,
        session_id: str,
        limit: int = DEFAULT_LIVE_SEGMENT_LIMIT,
        offset: int = 0,
    ) -> list[LiveSegmentRecord]:
        """Return paged transcript segments attached to one live session."""
        ...

    def count_segments(self, session_id: str) -> int:
        """Return total transcript segment count for one live session."""
        ...


class SupportsLiveSegmentMutations(Protocol):
    """Expose live segment writes required by live use-cases."""

    def create_segment(
        self,
        *,
        segment_id: str,
        session_id: str,
        track_id: str | None,
        sequence: int,
        start_ms: int,
        end_ms: int,
        text: str,
        language: str | None,
        confidence: float | None,
        is_final: bool,
        created_at: str,
    ) -> LiveSegmentRecord:
        """Create one live transcript segment and return its stored snapshot."""
        ...


class SupportsLiveSessionStore(
    SupportsLiveSessionQueries,
    SupportsLiveSessionMutations,
    Protocol,
):
    """Aggregate live session query and mutation contracts."""


class SupportsLiveTrackStore(
    SupportsLiveTrackQueries,
    SupportsLiveTrackMutations,
    Protocol,
):
    """Aggregate live track query and mutation contracts."""


class SupportsLiveSegmentStore(
    SupportsLiveSegmentQueries,
    SupportsLiveSegmentMutations,
    Protocol,
):
    """Aggregate live segment query and mutation contracts."""


class SupportsLiveRepository(
    SupportsLiveSessionStore,
    SupportsLiveTrackStore,
    SupportsLiveSegmentStore,
    Protocol,
):
    """Aggregate the full live repository contract."""
