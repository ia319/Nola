"""Create-live-session use-case."""

import uuid
from collections.abc import Callable

from nola.application.live._clock import now_iso
from nola.application.live.contracts import SupportsLiveSessionMutations
from nola.application.live.payloads import build_live_session_payload
from nola.application.live.runtime_config import (
    SupportsLiveRuntimeConfigRead,
    SupportsLiveRuntimeModelStorage,
    build_live_runtime_config,
)
from nola.application.live.types import (
    DEFAULT_LIVE_SEGMENT_LIMIT,
    LiveRealtimeRuntimeOverrides,
    LiveRuntimeConfig,
    LiveSessionMode,
    LiveSessionPayload,
)
from nola.application.live.values import ensure_live_session_mode
from nola.config.live_realtime import LiveRealtimeAdapter


def _ensure_runtime_resolution_inputs(
    *,
    runtime_config: LiveRuntimeConfig | None,
    runtime_adapter: LiveRealtimeAdapter,
    runtime_overrides: LiveRealtimeRuntimeOverrides | None,
    config_store: SupportsLiveRuntimeConfigRead | None,
) -> None:
    if runtime_config is not None or config_store is not None:
        return
    if runtime_adapter != "mock":
        raise ValueError("config_store is required when runtime_adapter is configured")
    if runtime_overrides is not None:
        raise ValueError("config_store is required when runtime_overrides are provided")


def create_live_session(
    *,
    live_store: SupportsLiveSessionMutations,
    title: str | None,
    mode: LiveSessionMode,
    language_hint: str | None,
    model_id: str | None,
    runtime_overrides: LiveRealtimeRuntimeOverrides | None = None,
    runtime_config: LiveRuntimeConfig | None = None,
    runtime_adapter: LiveRealtimeAdapter = "mock",
    config_store: SupportsLiveRuntimeConfigRead | None = None,
    model_storage: SupportsLiveRuntimeModelStorage | None = None,
    session_id_factory: Callable[[], str] | None = None,
    timestamp_factory: Callable[[], str] | None = None,
) -> LiveSessionPayload:
    """Create an active live transcription session."""
    resolved_mode = ensure_live_session_mode(mode)
    _ensure_runtime_resolution_inputs(
        runtime_config=runtime_config,
        runtime_adapter=runtime_adapter,
        runtime_overrides=runtime_overrides,
        config_store=config_store,
    )

    resolved_runtime = None
    if runtime_config is None and config_store is not None:
        resolved_runtime = build_live_runtime_config(
            runtime_adapter=runtime_adapter,
            request_model_id=model_id,
            language_hint=language_hint,
            runtime_overrides=runtime_overrides,
            config_store=config_store,
            model_storage=model_storage,
        )
        runtime_config = resolved_runtime.snapshot

    session_id = session_id_factory() if session_id_factory else str(uuid.uuid4())
    now = timestamp_factory() if timestamp_factory else now_iso()
    session = live_store.create_session(
        session_id=session_id,
        title=title,
        mode=resolved_mode,
        status="active",
        language_hint=language_hint,
        model_id=resolved_runtime.model_id if resolved_runtime else model_id,
        runtime=resolved_runtime.runtime if resolved_runtime else None,
        audio_format=resolved_runtime.audio_format if resolved_runtime else None,
        runtime_config=runtime_config,
        started_at=now,
        created_at=now,
        updated_at=now,
    )

    return build_live_session_payload(
        session=session,
        tracks=[],
        segments=[],
        segment_total=0,
        segment_limit=DEFAULT_LIVE_SEGMENT_LIMIT,
        segment_offset=0,
    )
