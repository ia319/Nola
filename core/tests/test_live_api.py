"""Tests for live transcription API endpoints."""

import io
import tempfile
import zipfile
from collections.abc import Callable
from pathlib import Path
from unittest.mock import PropertyMock, patch

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from starlette.websockets import WebSocketDisconnect

from nola.api.deps import (
    get_app_config_db,
    get_file_db,
    get_live_db,
    get_live_diagnostics_output_dir,
    get_live_realtime_adapter,
    get_live_realtime_transcriber_factory,
    get_live_stream_connection_registry,
    get_model_storage_provider,
    get_task_db,
)
from nola.api.schemas import CreateLiveSessionRequest
from nola.application.live import (
    DEFAULT_LIVE_SESSION_LIMIT,
    LiveSessionRecord,
    LiveSessionStatus,
)
from nola.application.live.realtime import (
    LIVE_REALTIME_PROTOCOL_VERSION,
    LiveRealtimeTranscriberFrame,
    LiveRealtimeTranscriberResult,
    LiveRealtimeTranscriptFinalCandidate,
    LiveRealtimeTranscriptPreview,
    MockLiveRealtimeTranscriber,
)
from nola.application.live.types import LiveRuntimeConfig, LiveTrackSource
from nola.config.settings import Settings
from nola.main import app
from nola.model_hub.contracts import ModelCacheState
from nola.models import init_db


@pytest.fixture
def client() -> TestClient:
    """Create a test client backed by an isolated live database."""
    app.openapi_schema = None
    get_app_config_db.cache_clear()
    get_file_db.cache_clear()
    get_live_db.cache_clear()
    get_live_stream_connection_registry.cache_clear()
    get_task_db.cache_clear()
    app.dependency_overrides[get_live_realtime_transcriber_factory] = (
        lambda: lambda _snapshot: MockLiveRealtimeTranscriber()
    )

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)
        db_path = tmp_path / "nola.db"
        upload_dir = tmp_path / "uploads"

        init_db(db_path)
        upload_dir.mkdir(parents=True, exist_ok=True)

        with (
            patch.object(
                Settings, "db_path", new_callable=PropertyMock, return_value=db_path
            ),
            patch.object(
                Settings,
                "upload_dir",
                new_callable=PropertyMock,
                return_value=upload_dir,
            ),
            patch("nola.main.init_db", lambda: None),
        ):
            with TestClient(app) as test_client:
                yield test_client

    app.openapi_schema = None
    get_app_config_db.cache_clear()
    get_file_db.cache_clear()
    get_live_db.cache_clear()
    get_live_stream_connection_registry.cache_clear()
    get_task_db.cache_clear()
    app.dependency_overrides.pop(get_live_realtime_adapter, None)
    app.dependency_overrides.pop(get_live_realtime_transcriber_factory, None)
    app.dependency_overrides.pop(get_model_storage_provider, None)


def _create_live_session(client: TestClient) -> dict[str, object]:
    app.dependency_overrides[get_model_storage_provider] = (
        lambda: _model_storage_provider()
    )
    try:
        response = client.post(
            "/api/live/sessions",
            json={
                "title": "Daily standup",
                "mode": "streaming",
                "language_hint": "en",
                "model_id": "small",
            },
        )
    finally:
        app.dependency_overrides.pop(get_model_storage_provider, None)

    assert response.status_code == 200
    return response.json()


def _create_stored_live_session(
    *,
    session_id: str,
    title: str | None = "Export Session",
    status: LiveSessionStatus = "finished",
    final_text: str | None = "final text",
    preview_text: str | None = None,
    started_at: str = "2026-01-01T00:00:00+00:00",
) -> str:
    live_db = get_live_db()
    live_db.create_session(
        session_id=session_id,
        title=title,
        mode="streaming",
        status="active",
        language_hint="en",
        model_id="small",
        runtime="mock",
        audio_format="pcm_s16le_16khz_mono",
        runtime_config={"schema_version": 1, "runtime": "mock"},
        started_at=started_at,
        created_at=started_at,
        updated_at=started_at,
    )
    if preview_text is not None:
        live_db.create_segment(
            segment_id=f"{session_id}-preview",
            session_id=session_id,
            track_id=None,
            sequence=1,
            start_ms=0,
            end_ms=500,
            text=preview_text,
            language="en",
            confidence=None,
            is_final=False,
            created_at="2026-01-01T00:00:01+00:00",
        )
    if final_text is not None:
        live_db.create_segment(
            segment_id=f"{session_id}-final",
            session_id=session_id,
            track_id=None,
            sequence=2,
            start_ms=500,
            end_ms=1500,
            text=final_text,
            language="en",
            confidence=0.95,
            is_final=True,
            created_at="2026-01-01T00:00:02+00:00",
        )
    if status == "finished":
        live_db.finish_session(
            session_id,
            ended_at="2026-01-01T00:02:00+00:00",
            updated_at="2026-01-01T00:02:00+00:00",
        )
    elif status == "failed":
        live_db.fail_session(
            session_id,
            error="connection_closed",
            ended_at="2026-01-01T00:02:00+00:00",
            updated_at="2026-01-01T00:02:00+00:00",
        )
    return session_id


class _DownloadedModelStorage:
    """Pretend every registered test model is already cached."""

    cache_dir = Path("D:/fake-model-cache")

    def __init__(self, state: ModelCacheState = "downloaded") -> None:
        self.state = state

    def get_cache_state(self, repo_id: str) -> ModelCacheState:
        assert repo_id
        return self.state


def _model_storage_provider(
    state: ModelCacheState = "downloaded",
) -> Callable[[], _DownloadedModelStorage]:
    def _provider() -> _DownloadedModelStorage:
        return _DownloadedModelStorage(state)

    return _provider


def _realtime_event(
    event_type: str,
    session_id: str,
    *,
    protocol_version: int = LIVE_REALTIME_PROTOCOL_VERSION,
) -> dict[str, object]:
    """Build one realtime client event envelope."""
    return {
        "type": event_type,
        "protocol_version": protocol_version,
        "session_id": session_id,
        "event_id": f"{event_type}-event",
        "sent_at": "2026-01-01T00:00:00+00:00",
    }


def _track_start_event(
    session_id: str,
    *,
    source: str,
    sequence: int = 0,
) -> dict[str, object]:
    """Build one realtime track start event."""
    return {
        **_realtime_event("track.start", session_id),
        "source": source,
        "sequence": sequence,
        "label": source,
        "device_label": None,
        "sample_rate": 16000,
        "channel_count": 1,
    }


def _audio_frame_event(
    session_id: str,
    *,
    track_id: str,
    source: str,
    sequence: int,
) -> dict[str, object]:
    """Build one realtime audio frame metadata event."""
    return {
        **_realtime_event("audio.frame", session_id),
        "track_id": track_id,
        "source": source,
        "sequence": sequence,
        "captured_at_ms": sequence * 20,
        "duration_ms": 20,
        "byte_length": 640,
        "encoding": "pcm_s16le",
        "sample_rate": 16000,
        "channel_count": 1,
    }


def _track_stop_event(
    session_id: str,
    *,
    track_id: str,
    source: str,
    sequence: int,
) -> dict[str, object]:
    """Build one realtime track stop event."""
    return {
        **_realtime_event("track.stop", session_id),
        "track_id": track_id,
        "source": source,
        "sequence": sequence,
    }


def test_list_live_sessions_empty(client: TestClient) -> None:
    """Live session list should return an empty page before any session exists."""
    response = client.get("/api/live/sessions")

    assert response.status_code == 200
    assert response.json() == {
        "sessions": [],
        "total": 0,
        "limit": DEFAULT_LIVE_SESSION_LIMIT,
        "offset": 0,
    }


def test_list_live_sessions_uses_dependency_override(client: TestClient) -> None:
    """Live session list should accept a FastAPI store dependency override."""

    class OverrideLiveStore:
        def list_sessions(
            self,
            limit: int = DEFAULT_LIVE_SESSION_LIMIT,
            offset: int = 0,
            *,
            q: str | None = None,
            status: str | None = None,
            sort_by: str = "started_at",
            order: str = "desc",
        ) -> list[LiveSessionRecord]:
            del q, status, sort_by, order
            session: LiveSessionRecord = {
                "id": "override-session",
                "title": "Override",
                "mode": "streaming",
                "status": "active",
                "language_hint": None,
                "model_id": None,
                "runtime": None,
                "audio_format": None,
                "runtime_config": None,
                "request_overrides": None,
                "started_at": "2026-01-01T00:00:00+00:00",
                "ended_at": None,
                "error": None,
                "created_at": "2026-01-01T00:00:00+00:00",
                "updated_at": "2026-01-01T00:00:00+00:00",
            }
            return [session][offset : offset + limit]

        def count_sessions(
            self,
            *,
            q: str | None = None,
            status: str | None = None,
        ) -> int:
            del q, status
            return 1

    app.dependency_overrides[get_live_db] = OverrideLiveStore
    try:
        response = client.get("/api/live/sessions")
    finally:
        app.dependency_overrides.pop(get_live_db, None)

    assert response.status_code == 200
    assert response.json()["sessions"][0]["session_id"] == "override-session"


def test_list_live_sessions_applies_history_query_params(client: TestClient) -> None:
    """Live session list should expose search, status, sorting, and total filters."""
    _create_stored_live_session(
        session_id="live-planning",
        title="Planning",
        status="finished",
        started_at="2026-01-01T00:00:00+00:00",
    )
    _create_stored_live_session(
        session_id="live-review-old",
        title="Review",
        status="finished",
        started_at="2026-01-02T00:00:00+00:00",
    )
    _create_stored_live_session(
        session_id="live-review-failed",
        title="Review",
        status="failed",
        started_at="2026-01-03T00:00:00+00:00",
    )

    response = client.get(
        "/api/live/sessions",
        params={
            "q": "review",
            "status": "finished",
            "sort_by": "started_at",
            "order": "asc",
            "limit": 10,
            "offset": 0,
        },
    )

    assert response.status_code == 200
    assert response.json()["total"] == 1
    assert [item["session_id"] for item in response.json()["sessions"]] == [
        "live-review-old"
    ]


def test_list_live_sessions_rejects_invalid_history_query_params(
    client: TestClient,
) -> None:
    """Live session list should reject unsupported filters before SQL."""
    invalid_status = client.get("/api/live/sessions", params={"status": "paused"})
    invalid_sort = client.get("/api/live/sessions", params={"sort_by": "runtime"})
    invalid_order = client.get("/api/live/sessions", params={"order": "sideways"})

    assert invalid_status.status_code == 422
    assert invalid_sort.status_code == 422
    assert invalid_order.status_code == 422


def test_create_list_get_and_finish_live_session(client: TestClient) -> None:
    """Live session endpoints should expose the stage-one lifecycle."""
    created = _create_live_session(client)
    session_id = str(created["session_id"])

    list_response = client.get("/api/live/sessions")
    detail_response = client.get(f"/api/live/sessions/{session_id}")
    finish_response = client.post(f"/api/live/sessions/{session_id}/finish")
    repeated_finish_response = client.post(f"/api/live/sessions/{session_id}/finish")

    assert created["status"] == "active"
    assert created["request_overrides"] == {
        "schema_version": 1,
        "model_id": "small",
        "language_hint": "en",
    }
    assert created["tracks"] == []
    assert created["segments"] == []
    assert created["segment_total"] == 0
    assert list_response.status_code == 200
    assert list_response.json()["total"] == 1
    assert list_response.json()["sessions"][0]["session_id"] == session_id
    assert detail_response.status_code == 200
    assert detail_response.json()["session_id"] == session_id
    assert detail_response.json()["request_overrides"] == created["request_overrides"]
    assert finish_response.status_code == 200
    assert finish_response.json()["status"] == "finished"
    assert finish_response.json()["ended_at"] is not None
    assert repeated_finish_response.status_code == 200
    assert repeated_finish_response.json()["status"] == "finished"


def test_create_live_session_mock_runtime_does_not_resolve_model_storage(
    client: TestClient,
) -> None:
    """Mock session creation should not touch model storage."""

    def _fail_provider() -> _DownloadedModelStorage:
        raise AssertionError("model storage provider should not be called")

    app.dependency_overrides[get_live_realtime_adapter] = lambda: "mock"
    app.dependency_overrides[get_model_storage_provider] = lambda: _fail_provider
    try:
        response = client.post(
            "/api/live/sessions",
            json={
                "title": "Mock runtime",
                "mode": "streaming",
                "model_id": "small",
            },
        )
    finally:
        app.dependency_overrides.pop(get_live_realtime_adapter, None)
        app.dependency_overrides.pop(get_model_storage_provider, None)

    assert response.status_code == 200
    assert response.json()["runtime"] == "mock"
    assert response.json()["runtime_config"]["runtime"] == "mock"


def test_create_live_session_without_overrides_returns_null_request_overrides(
    client: TestClient,
) -> None:
    """Live session creation should not invent request override snapshots."""
    app.dependency_overrides[get_live_realtime_adapter] = lambda: "mock"
    try:
        response = client.post(
            "/api/live/sessions",
            json={"title": "No overrides", "mode": "streaming"},
        )
    finally:
        app.dependency_overrides.pop(get_live_realtime_adapter, None)

    assert response.status_code == 200
    assert response.json()["request_overrides"] is None


def test_create_live_session_accepts_runtime_overrides_without_persisting_defaults(
    client: TestClient,
) -> None:
    """Live session overrides should stay scoped to the create request."""
    app.dependency_overrides[get_live_realtime_adapter] = lambda: "whisper_streaming"
    app.dependency_overrides[get_model_storage_provider] = (
        lambda: _model_storage_provider()
    )
    before_defaults = client.get("/api/config/live-realtime/defaults")
    try:
        response = client.post(
            "/api/live/sessions",
            json={
                "title": "Runtime overrides",
                "mode": "streaming",
                "language_hint": "zh",
                "model_id": "small",
                "runtime_overrides": {
                    "language": "en",
                    "device": "cuda",
                    "compute_type": "float16",
                    "context_prompt": None,
                    "beam_size": 3,
                    "vad_parameters": {"threshold": 0.6},
                },
            },
        )
        after_defaults = client.get("/api/config/live-realtime/defaults")
        config_db = get_app_config_db()
    finally:
        app.dependency_overrides.pop(get_live_realtime_adapter, None)
        app.dependency_overrides.pop(get_model_storage_provider, None)

    assert before_defaults.status_code == 200
    assert response.status_code == 200
    assert response.json()["language_hint"] == "zh"
    assert response.json()["request_overrides"] == {
        "schema_version": 1,
        "model_id": "small",
        "language_hint": "zh",
        "runtime_overrides": {
            "language": "en",
            "device": "cuda",
            "compute_type": "float16",
            "context_prompt": None,
            "beam_size": 3,
            "vad_parameters": {"threshold": 0.6},
        },
    }
    assert response.json()["runtime"] == "whisper_streaming"
    assert response.json()["runtime_config"]["execution"] == {
        "device": "cuda",
        "compute_type": "float16",
    }
    assert response.json()["runtime_config"]["language"] == "en"
    assert response.json()["runtime_config"]["context_prompt"] is None
    assert response.json()["runtime_config"]["faster_whisper"]["beam_size"] == 3
    assert (
        response.json()["runtime_config"]["vad"]["vad_parameters"]["threshold"] == 0.6
    )
    assert after_defaults.status_code == 200
    assert after_defaults.json() == before_defaults.json()
    assert config_db.get_all("live_realtime.") == {}
    assert config_db.get_all("transcription.") == {}


def test_create_live_session_runtime_config_uses_creation_time_defaults(
    client: TestClient,
) -> None:
    """Live session snapshots should not drift with later defaults changes."""
    app.dependency_overrides[get_live_realtime_adapter] = lambda: "whisper_streaming"
    app.dependency_overrides[get_model_storage_provider] = (
        lambda: _model_storage_provider()
    )
    config_db = get_app_config_db()
    config_db.set_many("live_realtime.", {"beam_size": 3})
    try:
        response = client.post(
            "/api/live/sessions",
            json={
                "title": "Runtime snapshot",
                "mode": "streaming",
                "model_id": "small",
            },
        )
        session_id = response.json()["session_id"]

        config_db.set_many("live_realtime.", {"beam_size": 1})
        detail_response = client.get(f"/api/live/sessions/{session_id}")
    finally:
        app.dependency_overrides.pop(get_live_realtime_adapter, None)
        app.dependency_overrides.pop(get_model_storage_provider, None)

    assert response.status_code == 200
    assert response.json()["runtime_config"]["faster_whisper"]["beam_size"] == 3
    assert detail_response.status_code == 200
    assert detail_response.json()["request_overrides"] == {
        "schema_version": 1,
        "model_id": "small",
    }
    assert detail_response.json()["runtime_config"]["faster_whisper"]["beam_size"] == 3


def test_create_live_session_rejects_undownloaded_runtime_model(
    client: TestClient,
) -> None:
    """Live session creation should not start missing model downloads."""
    app.dependency_overrides[get_live_realtime_adapter] = lambda: "whisper_streaming"
    app.dependency_overrides[get_model_storage_provider] = (
        lambda: _model_storage_provider("not_downloaded")
    )
    try:
        response = client.post(
            "/api/live/sessions",
            json={
                "title": "Missing model",
                "mode": "streaming",
                "model_id": "small",
            },
        )
        sessions = get_live_db().list_sessions()
    finally:
        app.dependency_overrides.pop(get_live_realtime_adapter, None)
        app.dependency_overrides.pop(get_model_storage_provider, None)

    assert response.status_code == 409
    assert response.json()["detail"] == {
        "code": "runtime_model_not_downloaded",
        "message": "Live realtime model is not downloaded",
    }
    assert sessions == []


def test_create_live_session_rejects_unknown_runtime_override(
    client: TestClient,
) -> None:
    """Live session overrides should reject unknown top-level keys."""
    response = client.post(
        "/api/live/sessions",
        json={
            "mode": "streaming",
            "runtime_overrides": {"unknown": True},
        },
    )

    assert response.status_code == 422


def test_create_live_session_rejects_unknown_vad_runtime_override(
    client: TestClient,
) -> None:
    """Live session overrides should reject unknown nested VAD keys."""
    response = client.post(
        "/api/live/sessions",
        json={
            "mode": "streaming",
            "runtime_overrides": {"vad_parameters": {"unknown": 0.1}},
        },
    )

    assert response.status_code == 422


def test_create_live_session_runtime_overrides_preserve_null_context_prompt() -> None:
    """Per-session null prompt should remain visible to the runtime resolver."""
    request = CreateLiveSessionRequest.model_validate(
        {
            "mode": "streaming",
            "runtime_overrides": {"context_prompt": None},
        }
    )

    assert request.runtime_overrides is not None
    assert request.runtime_overrides.get_options_dict() == {"context_prompt": None}


def test_create_live_session_runtime_overrides_reject_unsupported_nulls() -> None:
    """Per-session null should stay limited to context prompt semantics."""
    with pytest.raises(ValidationError):
        CreateLiveSessionRequest.model_validate(
            {
                "mode": "streaming",
                "runtime_overrides": {
                    "beam_size": None,
                    "vad_parameters": {"threshold": None},
                },
            }
        )


def test_create_live_session_runtime_overrides_reject_fuzzy_value_types() -> None:
    """Runtime override values should not coerce bools or numeric strings."""
    with pytest.raises(ValidationError):
        CreateLiveSessionRequest.model_validate(
            {
                "mode": "streaming",
                "runtime_overrides": {
                    "device": True,
                    "beam_size": True,
                    "vad_filter": 1,
                    "vad_parameters": {"threshold": "0.6"},
                },
            }
        )


def test_live_realtime_stream_returns_server_ready(client: TestClient) -> None:
    """Live realtime stream should expose protocol and session metadata."""
    created = _create_live_session(client)
    session_id = str(created["session_id"])

    with client.websocket_connect(
        f"/api/live/sessions/{session_id}/stream"
    ) as websocket:
        websocket.send_json(_realtime_event("client.hello", session_id))
        ready = websocket.receive_json()
        websocket.send_json(_realtime_event("session.finish", session_id))
        finished = websocket.receive_json()

        assert ready["type"] == "server.ready"
        assert ready["protocol_version"] == LIVE_REALTIME_PROTOCOL_VERSION
        assert ready["session_id"] == session_id
        assert ready["audio_contract"] == {
            "encoding": "pcm_s16le",
            "byte_order": "little_endian",
            "sample_rate": 16000,
            "channel_count": 1,
            "frame_duration_ms_min": 20,
            "frame_duration_ms_max": 100,
            "frame_payload_bytes_max": 3200,
        }
        assert ready["session"]["session_id"] == session_id
        assert finished["type"] == "session.finished"
        assert finished["session"]["status"] == "finished"

        with pytest.raises(WebSocketDisconnect) as close_error:
            websocket.receive_json()
        assert close_error.value.code == 1000


def test_live_realtime_stream_uses_session_runtime_snapshot(
    client: TestClient,
) -> None:
    """Live realtime stream should pass the saved snapshot to the factory."""
    created = _create_live_session(client)
    session_id = str(created["session_id"])
    snapshots: list[LiveRuntimeConfig] = []

    def _factory(snapshot: LiveRuntimeConfig) -> _PreviewRouteTranscriber:
        snapshots.append(snapshot.copy())
        return _PreviewRouteTranscriber()

    app.dependency_overrides[get_live_realtime_transcriber_factory] = lambda: _factory
    try:
        with client.websocket_connect(
            f"/api/live/sessions/{session_id}/stream"
        ) as websocket:
            websocket.send_json(_realtime_event("client.hello", session_id))
            assert websocket.receive_json()["type"] == "server.ready"
            websocket.send_json(_realtime_event("session.finish", session_id))
            assert websocket.receive_json()["type"] == "session.finished"
    finally:
        app.dependency_overrides.pop(get_live_realtime_transcriber_factory, None)

    assert snapshots == [created["runtime_config"]]


def test_live_realtime_stream_rejects_missing_runtime_config(
    client: TestClient,
) -> None:
    """Legacy active sessions without snapshots should fail explicitly."""
    session_id = "legacy-live-session"
    get_live_db().create_session(
        session_id=session_id,
        title="Legacy",
        mode="streaming",
        status="active",
        language_hint=None,
        model_id=None,
        runtime=None,
        audio_format=None,
        runtime_config=None,
        started_at="2026-01-01T00:00:00+00:00",
        created_at="2026-01-01T00:00:00+00:00",
        updated_at="2026-01-01T00:00:00+00:00",
    )

    with client.websocket_connect(
        f"/api/live/sessions/{session_id}/stream"
    ) as websocket:
        error = websocket.receive_json()

        assert error["type"] == "server.error"
        assert error["error"]["code"] == "runtime_config_invalid"
        with pytest.raises(WebSocketDisconnect) as close_error:
            websocket.receive_json()
        assert close_error.value.code == 1008


def test_live_realtime_stream_rejects_malformed_hello_json(
    client: TestClient,
) -> None:
    """Live realtime stream should reject malformed hello JSON predictably."""
    created = _create_live_session(client)
    session_id = str(created["session_id"])

    with client.websocket_connect(
        f"/api/live/sessions/{session_id}/stream"
    ) as websocket:
        websocket.send_text("{")
        error = websocket.receive_json()

        assert error["type"] == "server.error"
        assert error["error"]["code"] == "invalid_event"
        assert error["error"]["message"] == "Realtime event payload is invalid JSON"
        with pytest.raises(WebSocketDisconnect) as close_error:
            websocket.receive_json()
        assert close_error.value.code == 1008


def test_live_realtime_stream_rejects_malformed_event_json(
    client: TestClient,
) -> None:
    """Live realtime stream should reject malformed event JSON predictably."""
    created = _create_live_session(client)
    session_id = str(created["session_id"])

    with client.websocket_connect(
        f"/api/live/sessions/{session_id}/stream"
    ) as websocket:
        websocket.send_json(_realtime_event("client.hello", session_id))
        assert websocket.receive_json()["type"] == "server.ready"

        websocket.send_text("{")
        error = websocket.receive_json()

        assert error["type"] == "server.error"
        assert error["error"]["code"] == "invalid_event"
        assert error["error"]["message"] == "Realtime event payload is invalid JSON"
        with pytest.raises(WebSocketDisconnect) as close_error:
            websocket.receive_json()
        assert close_error.value.code == 1008


def test_live_realtime_stream_rejects_binary_hello_event(
    client: TestClient,
) -> None:
    """Live realtime stream should reject non-text hello events predictably."""
    created = _create_live_session(client)
    session_id = str(created["session_id"])

    with client.websocket_connect(
        f"/api/live/sessions/{session_id}/stream"
    ) as websocket:
        websocket.send_bytes(b"{}")
        error = websocket.receive_json()

        assert error["type"] == "server.error"
        assert error["error"]["code"] == "invalid_event"
        assert (
            error["error"]["message"]
            == "Realtime event must be sent as a JSON text frame"
        )
        with pytest.raises(WebSocketDisconnect) as close_error:
            websocket.receive_json()
        assert close_error.value.code == 1008


def test_live_realtime_stream_rejects_binary_runtime_event(
    client: TestClient,
) -> None:
    """Live realtime stream should reject non-text runtime events predictably."""
    created = _create_live_session(client)
    session_id = str(created["session_id"])

    with client.websocket_connect(
        f"/api/live/sessions/{session_id}/stream"
    ) as websocket:
        websocket.send_json(_realtime_event("client.hello", session_id))
        assert websocket.receive_json()["type"] == "server.ready"

        websocket.send_bytes(b"{}")
        error = websocket.receive_json()

        assert error["type"] == "server.error"
        assert error["error"]["code"] == "invalid_event"
        assert (
            error["error"]["message"]
            == "Realtime event must be sent as a JSON text frame"
        )
        with pytest.raises(WebSocketDisconnect) as close_error:
            websocket.receive_json()
        assert close_error.value.code == 1008


def test_live_realtime_stream_handles_track_lifecycle(client: TestClient) -> None:
    """Live realtime stream should create and stop source tracks."""
    created = _create_live_session(client)
    session_id = str(created["session_id"])

    with client.websocket_connect(
        f"/api/live/sessions/{session_id}/stream"
    ) as websocket:
        websocket.send_json(_realtime_event("client.hello", session_id))
        assert websocket.receive_json()["type"] == "server.ready"

        websocket.send_json(_track_start_event(session_id, source="microphone"))
        microphone_ready = websocket.receive_json()
        microphone_track_id = str(microphone_ready["track"]["track_id"])

        websocket.send_json(_track_start_event(session_id, source="system"))
        system_ready = websocket.receive_json()
        system_track_id = str(system_ready["track"]["track_id"])

        websocket.send_json(
            _audio_frame_event(
                session_id,
                track_id=microphone_track_id,
                source="microphone",
                sequence=0,
            )
        )
        websocket.send_bytes(b"\x00" * 640)
        websocket.send_json(
            _track_stop_event(
                session_id,
                track_id=microphone_track_id,
                source="microphone",
                sequence=1,
            )
        )
        websocket.send_json(
            _track_stop_event(
                session_id,
                track_id=system_track_id,
                source="system",
                sequence=0,
            )
        )
        websocket.send_json(_realtime_event("session.finish", session_id))
        finished = websocket.receive_json()

        tracks = sorted(
            finished["session"]["tracks"],
            key=lambda track: track["source"],
        )
        assert microphone_ready["type"] == "track.ready"
        assert microphone_ready["track"]["source"] == "microphone"
        assert system_ready["track"]["source"] == "system"
        assert finished["type"] == "session.finished"
        assert [track["source"] for track in tracks] == ["microphone", "system"]
        assert all(track["ended_at"] is not None for track in tracks)


def test_live_realtime_stream_emits_mock_transcripts(
    client: TestClient,
) -> None:
    """Live realtime stream should emit partials and persist final segments."""
    created = _create_live_session(client)
    session_id = str(created["session_id"])

    with client.websocket_connect(
        f"/api/live/sessions/{session_id}/stream"
    ) as websocket:
        websocket.send_json(_realtime_event("client.hello", session_id))
        assert websocket.receive_json()["type"] == "server.ready"
        websocket.send_json(_track_start_event(session_id, source="microphone"))
        track_ready = websocket.receive_json()
        track_id = str(track_ready["track"]["track_id"])

        for sequence in range(25):
            websocket.send_json(
                _audio_frame_event(
                    session_id,
                    track_id=track_id,
                    source="microphone",
                    sequence=sequence,
                )
            )
            websocket.send_bytes(b"\x00" * 640)

        partial = websocket.receive_json()
        interim_detail = client.get(f"/api/live/sessions/{session_id}").json()

        for sequence in range(25, 50):
            websocket.send_json(
                _audio_frame_event(
                    session_id,
                    track_id=track_id,
                    source="microphone",
                    sequence=sequence,
                )
            )
            websocket.send_bytes(b"\x00" * 640)

        final = websocket.receive_json()
        websocket.send_json(_realtime_event("session.finish", session_id))
        finished = websocket.receive_json()

    assert partial["type"] == "transcript.committed_partial"
    assert partial["transcript"]["result_kind"] == "committed_partial"
    assert partial["transcript"]["session_id"] == session_id
    assert partial["transcript"]["track_id"] == track_id
    assert partial["transcript"]["source"] == "microphone"
    assert partial["transcript"]["committed_index"] == 1
    assert partial["transcript"]["start_ms"] == 0
    assert partial["transcript"]["end_ms"] == 500
    assert partial["transcript"]["text"] == "Mock microphone partial 1"
    assert partial["transcript"]["is_final"] is False
    assert interim_detail["segment_total"] == 0
    assert interim_detail["segments"] == []

    assert final["type"] == "transcript.final"
    assert final["transcript"]["result_kind"] == "final"
    assert final["transcript"]["track_id"] == track_id
    assert final["transcript"]["source"] == "microphone"
    assert final["transcript"]["sequence"] == 1
    assert final["transcript"]["start_ms"] == 0
    assert final["transcript"]["end_ms"] == 1000
    assert final["transcript"]["text"] == "Mock microphone segment 1"
    assert final["transcript"]["is_final"] is True
    assert finished["type"] == "session.finished"
    assert finished["session"]["segment_total"] == 1
    assert finished["session"]["segments"][0]["text"] == "Mock microphone segment 1"


def test_live_realtime_stream_emits_flush_final_on_track_stop(
    client: TestClient,
) -> None:
    """Live realtime stream should send flush finals from track.stop."""
    created = _create_live_session(client)
    session_id = str(created["session_id"])

    app.dependency_overrides[get_live_realtime_transcriber_factory] = (
        lambda: lambda _snapshot: _FlushTrackRouteTranscriber()
    )
    try:
        with client.websocket_connect(
            f"/api/live/sessions/{session_id}/stream"
        ) as websocket:
            websocket.send_json(_realtime_event("client.hello", session_id))
            assert websocket.receive_json()["type"] == "server.ready"
            websocket.send_json(_track_start_event(session_id, source="microphone"))
            track_ready = websocket.receive_json()
            track_id = str(track_ready["track"]["track_id"])

            websocket.send_json(
                _track_stop_event(
                    session_id,
                    track_id=track_id,
                    source="microphone",
                    sequence=0,
                )
            )
            final = websocket.receive_json()
            websocket.send_json(_realtime_event("session.finish", session_id))
            finished = websocket.receive_json()
    finally:
        app.dependency_overrides.pop(get_live_realtime_transcriber_factory, None)

    assert final["type"] == "transcript.final"
    assert final["transcript"]["track_id"] == track_id
    assert final["transcript"]["source"] == "microphone"
    assert final["transcript"]["text"] == "flush stop final"
    assert finished["type"] == "session.finished"
    assert finished["session"]["segment_total"] == 1
    assert finished["session"]["segments"][0]["text"] == "flush stop final"


def test_live_realtime_stream_emits_preview_transcript(
    client: TestClient,
) -> None:
    """Live realtime stream should send preview transcript events."""
    created = _create_live_session(client)
    session_id = str(created["session_id"])

    app.dependency_overrides[get_live_realtime_transcriber_factory] = (
        lambda: lambda _snapshot: _PreviewRouteTranscriber()
    )
    try:
        with client.websocket_connect(
            f"/api/live/sessions/{session_id}/stream"
        ) as websocket:
            websocket.send_json(_realtime_event("client.hello", session_id))
            assert websocket.receive_json()["type"] == "server.ready"
            websocket.send_json(_track_start_event(session_id, source="microphone"))
            track_ready = websocket.receive_json()
            track_id = str(track_ready["track"]["track_id"])

            websocket.send_json(
                _audio_frame_event(
                    session_id,
                    track_id=track_id,
                    source="microphone",
                    sequence=0,
                )
            )
            websocket.send_bytes(b"\x00" * 640)
            preview = websocket.receive_json()
            websocket.send_json(_realtime_event("session.finish", session_id))
            finished = websocket.receive_json()
    finally:
        app.dependency_overrides.pop(get_live_realtime_transcriber_factory, None)

    assert preview["type"] == "transcript.preview"
    assert preview["transcript"]["result_kind"] == "preview"
    assert preview["transcript"]["track_id"] == track_id
    assert preview["transcript"]["source"] == "microphone"
    assert preview["transcript"]["preview_index"] == 1
    assert preview["transcript"]["start_ms"] == 0
    assert preview["transcript"]["end_ms"] == 20
    assert preview["transcript"]["text"] == "route preview"
    assert preview["transcript"]["is_final"] is False
    assert finished["type"] == "session.finished"
    assert finished["session"]["segment_total"] == 0


def test_live_realtime_stream_rejects_unknown_track_audio(
    client: TestClient,
) -> None:
    """Live realtime stream should reject audio for unknown tracks."""
    created = _create_live_session(client)
    session_id = str(created["session_id"])

    with client.websocket_connect(
        f"/api/live/sessions/{session_id}/stream"
    ) as websocket:
        websocket.send_json(_realtime_event("client.hello", session_id))
        assert websocket.receive_json()["type"] == "server.ready"
        websocket.send_json(
            _audio_frame_event(
                session_id,
                track_id="missing-track",
                source="microphone",
                sequence=0,
            )
        )
        error = websocket.receive_json()

        assert error["type"] == "server.error"
        assert error["error"]["code"] == "invalid_track"
        with pytest.raises(WebSocketDisconnect) as close_error:
            websocket.receive_json()
        assert close_error.value.code == 1008


def test_live_realtime_stream_rejects_audio_sequence_gap(
    client: TestClient,
) -> None:
    """Live realtime stream should reject skipped track frame sequences."""
    created = _create_live_session(client)
    session_id = str(created["session_id"])

    with client.websocket_connect(
        f"/api/live/sessions/{session_id}/stream"
    ) as websocket:
        websocket.send_json(_realtime_event("client.hello", session_id))
        assert websocket.receive_json()["type"] == "server.ready"
        websocket.send_json(_track_start_event(session_id, source="microphone"))
        track_ready = websocket.receive_json()
        track_id = str(track_ready["track"]["track_id"])
        websocket.send_json(
            _audio_frame_event(
                session_id,
                track_id=track_id,
                source="microphone",
                sequence=1,
            )
        )
        error = websocket.receive_json()

        assert error["type"] == "server.error"
        assert error["error"]["code"] == "audio_sequence_invalid"
        with pytest.raises(WebSocketDisconnect) as close_error:
            websocket.receive_json()
        assert close_error.value.code == 1008


def test_live_realtime_stream_rejects_pcm_payload_length_mismatch(
    client: TestClient,
) -> None:
    """Live realtime stream should reject PCM frames that do not match metadata."""
    created = _create_live_session(client)
    session_id = str(created["session_id"])

    with client.websocket_connect(
        f"/api/live/sessions/{session_id}/stream"
    ) as websocket:
        websocket.send_json(_realtime_event("client.hello", session_id))
        assert websocket.receive_json()["type"] == "server.ready"
        websocket.send_json(_track_start_event(session_id, source="microphone"))
        track_ready = websocket.receive_json()
        track_id = str(track_ready["track"]["track_id"])
        websocket.send_json(
            _audio_frame_event(
                session_id,
                track_id=track_id,
                source="microphone",
                sequence=0,
            )
        )
        websocket.send_bytes(b"\x00" * 638)
        error = websocket.receive_json()

        assert error["type"] == "server.error"
        assert error["error"]["code"] == "audio_frame_invalid"
        with pytest.raises(WebSocketDisconnect) as close_error:
            websocket.receive_json()
        assert close_error.value.code == 1008


def test_live_realtime_stream_handles_explicit_wav_diagnostics(
    client: TestClient,
    tmp_path: Path,
) -> None:
    """Live realtime stream should emit explicit WAV diagnostics events."""
    created = _create_live_session(client)
    session_id = str(created["session_id"])

    app.dependency_overrides[get_live_diagnostics_output_dir] = (
        lambda: tmp_path / "diagnostics"
    )
    try:
        with client.websocket_connect(
            f"/api/live/sessions/{session_id}/stream"
        ) as websocket:
            websocket.send_json(_realtime_event("client.hello", session_id))
            assert websocket.receive_json()["type"] == "server.ready"
            websocket.send_json(_track_start_event(session_id, source="microphone"))
            track_ready = websocket.receive_json()
            track_id = str(track_ready["track"]["track_id"])

            websocket.send_json(
                {
                    **_realtime_event("diagnostics.wav.start", session_id),
                    "max_duration_ms": 1000,
                    "max_bytes": 4096,
                    "tracks": [track_id],
                }
            )
            started = websocket.receive_json()
            websocket.send_json(
                _audio_frame_event(
                    session_id,
                    track_id=track_id,
                    source="microphone",
                    sequence=0,
                )
            )
            websocket.send_bytes(b"\x00" * 640)
            websocket.send_json(_realtime_event("diagnostics.wav.stop", session_id))
            stopped = websocket.receive_json()
            websocket.send_json(_realtime_event("session.finish", session_id))
            finished = websocket.receive_json()
    finally:
        app.dependency_overrides.pop(get_live_diagnostics_output_dir, None)

    assert started["type"] == "diagnostics.wav.started"
    assert "output_dir" not in started
    assert "manifest_path" not in started
    assert started["capture_id"].startswith(f"{session_id}-")
    assert started["manifest_name"] == "manifest.json"
    assert started["max_duration_ms"] == 1000
    assert started["max_bytes"] == 4096
    assert started["tracks"] == [track_id]
    assert stopped["type"] == "diagnostics.wav.stopped"
    assert "output_dir" not in stopped
    assert "manifest_path" not in stopped
    assert stopped["capture_id"] == started["capture_id"]
    assert stopped["manifest_name"] == "manifest.json"
    assert stopped["reason"] == "client_stop"
    assert stopped["files"][0]["track_id"] == track_id
    assert "path" not in stopped["files"][0]
    assert stopped["files"][0]["file_name"] == f"{track_id}-microphone.wav"
    assert stopped["files"][0]["duration_ms"] == 20
    assert finished["type"] == "session.finished"


def test_live_realtime_stream_stops_wav_diagnostics_on_limit(
    client: TestClient,
    tmp_path: Path,
) -> None:
    """Live realtime stream should keep running after diagnostics limits stop."""
    created = _create_live_session(client)
    session_id = str(created["session_id"])

    app.dependency_overrides[get_live_diagnostics_output_dir] = (
        lambda: tmp_path / "diagnostics"
    )
    try:
        with client.websocket_connect(
            f"/api/live/sessions/{session_id}/stream"
        ) as websocket:
            websocket.send_json(_realtime_event("client.hello", session_id))
            assert websocket.receive_json()["type"] == "server.ready"
            websocket.send_json(_track_start_event(session_id, source="microphone"))
            track_ready = websocket.receive_json()
            track_id = str(track_ready["track"]["track_id"])

            websocket.send_json(
                {
                    **_realtime_event("diagnostics.wav.start", session_id),
                    "max_duration_ms": 20,
                    "max_bytes": 4096,
                    "tracks": [track_id],
                }
            )
            started = websocket.receive_json()
            websocket.send_json(
                _audio_frame_event(
                    session_id,
                    track_id=track_id,
                    source="microphone",
                    sequence=0,
                )
            )
            websocket.send_bytes(b"\x00" * 640)
            websocket.send_json(
                _audio_frame_event(
                    session_id,
                    track_id=track_id,
                    source="microphone",
                    sequence=1,
                )
            )
            websocket.send_bytes(b"\x00" * 640)
            stopped = websocket.receive_json()
            websocket.send_json(_realtime_event("session.finish", session_id))
            finished = websocket.receive_json()
    finally:
        app.dependency_overrides.pop(get_live_diagnostics_output_dir, None)

    assert started["type"] == "diagnostics.wav.started"
    assert stopped["type"] == "diagnostics.wav.stopped"
    assert stopped["reason"] == "limit_exceeded"
    assert stopped["capture_id"] == started["capture_id"]
    assert finished["type"] == "session.finished"


def test_live_realtime_stream_rejects_missing_session(client: TestClient) -> None:
    """Live realtime stream should reject unknown sessions."""
    with client.websocket_connect(
        "/api/live/sessions/missing-session/stream"
    ) as websocket:
        error = websocket.receive_json()

        assert error["type"] == "server.error"
        assert error["error"]["code"] == "session_not_found"
        with pytest.raises(WebSocketDisconnect) as close_error:
            websocket.receive_json()
        assert close_error.value.code == 4404


def test_live_realtime_stream_rejects_non_active_session(client: TestClient) -> None:
    """Live realtime stream should reject terminal sessions."""
    created = _create_live_session(client)
    session_id = str(created["session_id"])
    finish_response = client.post(f"/api/live/sessions/{session_id}/finish")
    assert finish_response.status_code == 200

    with client.websocket_connect(
        f"/api/live/sessions/{session_id}/stream"
    ) as websocket:
        error = websocket.receive_json()

        assert error["type"] == "server.error"
        assert error["error"]["code"] == "session_not_active"
        with pytest.raises(WebSocketDisconnect) as close_error:
            websocket.receive_json()
        assert close_error.value.code == 4409


def test_live_realtime_stream_rejects_second_writer(client: TestClient) -> None:
    """Live realtime stream should reject a second writer for one session."""
    created = _create_live_session(client)
    session_id = str(created["session_id"])

    with client.websocket_connect(f"/api/live/sessions/{session_id}/stream") as first:
        first.send_json(_realtime_event("client.hello", session_id))
        assert first.receive_json()["type"] == "server.ready"

        with client.websocket_connect(
            f"/api/live/sessions/{session_id}/stream"
        ) as second:
            error = second.receive_json()
            assert error["type"] == "server.error"
            assert error["error"]["code"] == "session_already_streaming"
            with pytest.raises(WebSocketDisconnect) as close_error:
                second.receive_json()
            assert close_error.value.code == 4409

        first.send_json(_realtime_event("session.finish", session_id))
        assert first.receive_json()["type"] == "session.finished"


def test_live_realtime_stream_rechecks_session_after_acquire(
    client: TestClient,
) -> None:
    """Live realtime stream should reject sessions finished during acquire."""
    created = _create_live_session(client)
    session_id = str(created["session_id"])
    live_db = get_live_db()

    class FinishDuringAcquireRegistry:
        def __init__(self) -> None:
            self.released = False

        async def acquire(self, acquired_session_id: str) -> bool:
            assert acquired_session_id == session_id
            live_db.finish_session(
                session_id,
                ended_at="2026-01-01T00:01:00+00:00",
                updated_at="2026-01-01T00:01:00+00:00",
            )
            return True

        async def release(self, released_session_id: str) -> None:
            assert released_session_id == session_id
            self.released = True

    registry = FinishDuringAcquireRegistry()
    app.dependency_overrides[get_live_stream_connection_registry] = lambda: registry
    try:
        with client.websocket_connect(
            f"/api/live/sessions/{session_id}/stream"
        ) as websocket:
            error = websocket.receive_json()

            assert error["type"] == "server.error"
            assert error["error"]["code"] == "session_not_active"
            with pytest.raises(WebSocketDisconnect) as close_error:
                websocket.receive_json()
            assert close_error.value.code == 4409
    finally:
        app.dependency_overrides.pop(get_live_stream_connection_registry, None)

    assert registry.released is True


def test_live_realtime_stream_rejects_unsupported_protocol(
    client: TestClient,
) -> None:
    """Live realtime stream should reject unsupported protocol versions."""
    created = _create_live_session(client)
    session_id = str(created["session_id"])

    with client.websocket_connect(
        f"/api/live/sessions/{session_id}/stream"
    ) as websocket:
        websocket.send_json(
            _realtime_event("client.hello", session_id, protocol_version=999)
        )
        error = websocket.receive_json()

        assert error["type"] == "server.error"
        assert error["error"]["code"] == "protocol_version_unsupported"
        with pytest.raises(WebSocketDisconnect) as close_error:
            websocket.receive_json()
        assert close_error.value.code == 1008

    detail_response = client.get(f"/api/live/sessions/{session_id}")
    assert detail_response.status_code == 200
    assert detail_response.json()["status"] == "active"


def test_live_realtime_stream_marks_session_failed_after_disconnect(
    client: TestClient,
) -> None:
    """Live realtime stream should fail active sessions after unexpected close."""
    created = _create_live_session(client)
    session_id = str(created["session_id"])

    with client.websocket_connect(
        f"/api/live/sessions/{session_id}/stream"
    ) as websocket:
        websocket.send_json(_realtime_event("client.hello", session_id))
        assert websocket.receive_json()["type"] == "server.ready"

    detail_response = client.get(f"/api/live/sessions/{session_id}")

    assert detail_response.status_code == 200
    assert detail_response.json()["status"] == "failed"
    assert detail_response.json()["error"] == "connection_closed"


def test_get_live_session_returns_paged_segments(client: TestClient) -> None:
    """Live detail should return a bounded segment window."""
    created = _create_live_session(client)
    session_id = str(created["session_id"])
    live_db = get_live_db()
    for sequence in range(1, 4):
        live_db.create_segment(
            segment_id=f"segment-00{sequence}",
            session_id=session_id,
            track_id=None,
            sequence=sequence,
            start_ms=(sequence - 1) * 1000,
            end_ms=sequence * 1000,
            text=f"text {sequence}",
            language="en",
            confidence=None,
            is_final=True,
            created_at=f"2026-01-01T00:00:0{sequence}",
        )

    response = client.get(
        f"/api/live/sessions/{session_id}",
        params={"segment_limit": 1, "segment_offset": 1},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["segment_total"] == 3
    assert data["segment_limit"] == 1
    assert data["segment_offset"] == 1
    assert [segment["segment_id"] for segment in data["segments"]] == ["segment-002"]


def test_export_live_session_uses_only_final_segments(client: TestClient) -> None:
    """Live single export should download final transcript content only."""
    session_id = _create_stored_live_session(
        session_id="live-export",
        title="Live Export",
        status="finished",
        final_text="final transcript",
        preview_text="preview transcript",
    )

    response = client.get(
        f"/api/live/sessions/{session_id}/export",
        params={"format": "srt"},
    )

    assert response.status_code == 200
    assert "final transcript" in response.text
    assert "preview transcript" not in response.text
    assert (
        "filename*=UTF-8''Live%20Export.srt" in response.headers["content-disposition"]
    )


def test_export_live_session_save_to_disk(client: TestClient) -> None:
    """Live single export should support server-side save mode."""
    session_id = _create_stored_live_session(
        session_id="live-save",
        title="Live Save",
        status="finished",
        final_text="saved transcript",
    )

    with tempfile.TemporaryDirectory() as tmpdir:
        exports_path = Path(tmpdir) / "exports"
        with patch.object(
            Settings,
            "exports_dir",
            new_callable=PropertyMock,
            return_value=exports_path,
        ):
            response = client.get(
                f"/api/live/sessions/{session_id}/export",
                params={
                    "format": "txt",
                    "include_timestamps": "false",
                    "save": "true",
                },
            )
            saved_content = (exports_path / "Live Save.txt").read_text(encoding="utf-8")

    assert response.status_code == 200
    assert response.json() == {"saved_path": "exports/Live Save.txt"}
    assert saved_content.strip() == "saved transcript"


def test_export_live_session_rejects_active_or_empty_session(
    client: TestClient,
) -> None:
    """Live single export should reject non-finished and empty final sessions."""
    active_id = _create_stored_live_session(
        session_id="live-active",
        status="active",
        final_text="active final",
    )
    empty_id = _create_stored_live_session(
        session_id="live-empty",
        status="finished",
        final_text=None,
    )

    active_response = client.get(f"/api/live/sessions/{active_id}/export")
    empty_response = client.get(f"/api/live/sessions/{empty_id}/export")

    assert active_response.status_code == 400
    assert empty_response.status_code == 400
    assert empty_response.json()["detail"] == "No final segments available"


def test_batch_export_live_sessions_returns_zip_with_partial_failures(
    client: TestClient,
) -> None:
    """Live batch export should include successful files and an error report."""
    finished_id = _create_stored_live_session(
        session_id="live-batch-ok",
        title="Batch OK",
        status="finished",
        final_text="batch transcript",
    )
    active_id = _create_stored_live_session(
        session_id="live-batch-active",
        status="active",
        final_text="active transcript",
    )

    response = client.post(
        "/api/live/sessions/export/batch",
        json={
            "session_ids": [finished_id, active_id, "missing-live"],
            "format": "txt",
            "include_timestamps": False,
        },
    )

    assert response.status_code == 200
    with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
        names = set(archive.namelist())
        assert "Batch OK.txt" in names
        assert "_errors.txt" in names
        assert archive.read("Batch OK.txt").decode("utf-8").strip() == (
            "batch transcript"
        )
        errors = archive.read("_errors.txt").decode("utf-8")
        assert "live-batch-active: status_active" in errors
        assert "missing-live: not_found" in errors


def test_batch_export_live_sessions_renames_duplicate_zip_members(
    client: TestClient,
) -> None:
    """Live batch export should avoid duplicate member names when all succeed."""
    first_id = _create_stored_live_session(
        session_id="live-batch-first",
        title="Duplicate",
        status="finished",
        final_text="first transcript",
    )
    second_id = _create_stored_live_session(
        session_id="live-batch-second",
        title="Duplicate",
        status="finished",
        final_text="second transcript",
    )

    response = client.post(
        "/api/live/sessions/export/batch",
        json={
            "session_ids": [first_id, second_id],
            "format": "txt",
            "include_timestamps": False,
        },
    )

    assert response.status_code == 200
    with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
        names = set(archive.namelist())
        assert names == {"Duplicate.txt", "Duplicate_1.txt"}
        assert archive.read("Duplicate.txt").decode("utf-8").strip() == (
            "first transcript"
        )
        assert archive.read("Duplicate_1.txt").decode("utf-8").strip() == (
            "second transcript"
        )


def test_batch_export_live_sessions_supports_non_ascii_zip_name(
    client: TestClient,
) -> None:
    """Live batch export should expose non-ASCII ZIP names through filename*."""
    session_id = _create_stored_live_session(
        session_id="live-batch-non-ascii",
        title="Non ASCII",
        status="finished",
        final_text="zip transcript",
    )

    response = client.post(
        "/api/live/sessions/export/batch",
        json={
            "session_ids": [session_id],
            "format": "txt",
            "include_timestamps": False,
            "zip_name": "\u4e2d\u6587_export",
        },
    )

    assert response.status_code == 200
    content_disp = response.headers["content-disposition"]
    assert 'filename="_export.zip"' in content_disp
    assert "filename*=UTF-8''%E4%B8%AD%E6%96%87_export.zip" in content_disp


def test_batch_export_live_sessions_rejects_all_failed(client: TestClient) -> None:
    """Live batch export should reject requests with no successful files."""
    active_id = _create_stored_live_session(
        session_id="live-batch-all-fail",
        status="active",
        final_text="active transcript",
    )

    response = client.post(
        "/api/live/sessions/export/batch",
        json={"session_ids": [active_id], "format": "txt"},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "All 1 live exports failed"


def test_delete_live_session_record_removes_terminal_session(
    client: TestClient,
) -> None:
    """Live delete should remove finished or failed sessions and child rows."""
    session_id = _create_stored_live_session(
        session_id="live-delete",
        status="finished",
        final_text="delete transcript",
    )

    response = client.delete(f"/api/live/sessions/{session_id}/record")

    assert response.status_code == 200
    assert response.json()["session_id"] == session_id
    assert get_live_db().get_session(session_id) is None
    assert get_live_db().list_segments(session_id) == []


def test_delete_live_session_record_rejects_active_session(
    client: TestClient,
) -> None:
    """Live delete should reject active sessions."""
    session_id = _create_stored_live_session(
        session_id="live-delete-active",
        status="active",
        final_text="active transcript",
    )

    response = client.delete(f"/api/live/sessions/{session_id}/record")

    assert response.status_code == 400
    assert get_live_db().get_session(session_id) is not None


def test_batch_delete_live_sessions_returns_mixed_outcomes(
    client: TestClient,
) -> None:
    """Live batch delete should return per-session outcomes."""
    finished_id = _create_stored_live_session(
        session_id="live-delete-finished",
        status="finished",
    )
    failed_id = _create_stored_live_session(
        session_id="live-delete-failed",
        status="failed",
    )
    active_id = _create_stored_live_session(
        session_id="live-delete-active",
        status="active",
    )

    response = client.post(
        "/api/live/sessions/batch/delete-records",
        json={
            "session_ids": [
                finished_id,
                active_id,
                "missing-live",
                failed_id,
                finished_id,
            ]
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["summary"] == {"requested": 5, "succeeded": 2, "failed": 3}
    assert payload["results"][0]["ok"] is True
    assert payload["results"][1]["error_code"] == "invalid_status"
    assert payload["results"][2]["error_code"] == "not_found"
    assert payload["results"][3]["ok"] is True
    assert payload["results"][4]["error_code"] == "duplicate_session_id"
    assert get_live_db().get_session(finished_id) is None
    assert get_live_db().get_session(failed_id) is None
    assert get_live_db().get_session(active_id) is not None


def test_live_session_errors(client: TestClient) -> None:
    """Live routes should expose stable HTTP error boundaries."""
    invalid_create = client.post(
        "/api/live/sessions",
        json={"title": "Bad", "mode": "offline"},
    )
    missing_detail = client.get("/api/live/sessions/missing-session")
    invalid_segment_page = client.get(
        "/api/live/sessions/missing-session",
        params={"segment_limit": 501},
    )

    assert invalid_create.status_code == 422
    assert missing_detail.status_code == 404
    assert missing_detail.json()["detail"] == "Live session not found"
    assert invalid_segment_page.status_code == 422


def test_openapi_exposes_live_paths(client: TestClient) -> None:
    """OpenAPI should include the live session routes."""
    response = client.get("/openapi.json")

    assert response.status_code == 200
    paths = response.json()["paths"]
    assert "/api/live/sessions" in paths
    assert "/api/live/sessions/export/batch" in paths
    assert "/api/live/sessions/batch/delete-records" in paths
    assert "/api/live/sessions/{session_id}" in paths
    assert "/api/live/sessions/{session_id}/export" in paths
    assert "/api/live/sessions/{session_id}/finish" in paths
    assert "/api/live/sessions/{session_id}/record" in paths


class _FlushTrackRouteTranscriber:
    def accept_frame(
        self,
        _frame: LiveRealtimeTranscriberFrame,
    ) -> tuple[LiveRealtimeTranscriberResult, ...]:
        return ()

    def flush_track(
        self,
        *,
        track_id: str,
        source: LiveTrackSource,
    ) -> tuple[LiveRealtimeTranscriberResult, ...]:
        return (
            LiveRealtimeTranscriptFinalCandidate(
                track_id=track_id,
                source=source,
                start_ms=0,
                end_ms=200,
                text="flush stop final",
                language=None,
                confidence=None,
            ),
        )

    def flush_all(self) -> tuple[LiveRealtimeTranscriberResult, ...]:
        return ()

    def release(self) -> None:
        return None


class _PreviewRouteTranscriber:
    def accept_frame(
        self,
        frame: LiveRealtimeTranscriberFrame,
    ) -> tuple[LiveRealtimeTranscriberResult, ...]:
        return (
            LiveRealtimeTranscriptPreview(
                track_id=frame.track_id,
                source=frame.source,
                preview_index=1,
                start_ms=frame.start_ms,
                end_ms=frame.end_ms,
                text="route preview",
                language=None,
                confidence=None,
            ),
        )

    def flush_track(
        self,
        *,
        track_id: str,
        source: LiveTrackSource,
    ) -> tuple[LiveRealtimeTranscriberResult, ...]:
        del track_id, source
        return ()

    def flush_all(self) -> tuple[LiveRealtimeTranscriberResult, ...]:
        return ()

    def release(self) -> None:
        return None
