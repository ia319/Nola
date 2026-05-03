"""Create-live-session use-case."""

import uuid
from collections.abc import Callable
from datetime import datetime

from nola.application.live.contracts import SupportsLiveSessionMutations
from nola.application.live.payloads import build_live_session_payload
from nola.application.live.types import (
    DEFAULT_LIVE_SEGMENT_LIMIT,
    LiveSessionMode,
    LiveSessionPayload,
)
from nola.application.live.values import ensure_live_session_mode


def _now_iso() -> str:
    """Return the current local timestamp."""
    return datetime.now().isoformat()


def create_live_session(
    *,
    live_store: SupportsLiveSessionMutations,
    title: str | None,
    mode: LiveSessionMode,
    language_hint: str | None,
    model_id: str | None,
    session_id_factory: Callable[[], str] | None = None,
    timestamp_factory: Callable[[], str] | None = None,
) -> LiveSessionPayload:
    """Create an active live transcription session."""
    resolved_mode = ensure_live_session_mode(mode)
    session_id = session_id_factory() if session_id_factory else str(uuid.uuid4())
    now = timestamp_factory() if timestamp_factory else _now_iso()
    session = live_store.create_session(
        session_id=session_id,
        title=title,
        mode=resolved_mode,
        status="active",
        language_hint=language_hint,
        model_id=model_id,
        runtime=None,
        audio_format=None,
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
