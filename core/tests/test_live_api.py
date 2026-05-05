"""Tests for live transcription API endpoints."""

import tempfile
from pathlib import Path
from unittest.mock import PropertyMock, patch

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from nola.api.deps import (
    get_app_config_db,
    get_file_db,
    get_live_db,
    get_live_stream_connection_registry,
    get_task_db,
)
from nola.application.live import DEFAULT_LIVE_SESSION_LIMIT, LiveSessionRecord
from nola.application.live.realtime import LIVE_REALTIME_PROTOCOL_VERSION
from nola.config.settings import Settings
from nola.main import app
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


def _create_live_session(client: TestClient) -> dict[str, object]:
    response = client.post(
        "/api/live/sessions",
        json={
            "title": "Daily standup",
            "mode": "streaming",
            "language_hint": "en",
            "model_id": "small",
        },
    )
    assert response.status_code == 200
    return response.json()


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
        ) -> list[LiveSessionRecord]:
            session: LiveSessionRecord = {
                "id": "override-session",
                "title": "Override",
                "mode": "streaming",
                "status": "active",
                "language_hint": None,
                "model_id": None,
                "runtime": None,
                "audio_format": None,
                "started_at": "2026-01-01T00:00:00+00:00",
                "ended_at": None,
                "error": None,
                "created_at": "2026-01-01T00:00:00+00:00",
                "updated_at": "2026-01-01T00:00:00+00:00",
            }
            return [session][offset : offset + limit]

        def count_sessions(self) -> int:
            return 1

    app.dependency_overrides[get_live_db] = OverrideLiveStore
    try:
        response = client.get("/api/live/sessions")
    finally:
        app.dependency_overrides.pop(get_live_db, None)

    assert response.status_code == 200
    assert response.json()["sessions"][0]["session_id"] == "override-session"


def test_create_list_get_and_finish_live_session(client: TestClient) -> None:
    """Live session endpoints should expose the stage-one lifecycle."""
    created = _create_live_session(client)
    session_id = str(created["session_id"])

    list_response = client.get("/api/live/sessions")
    detail_response = client.get(f"/api/live/sessions/{session_id}")
    finish_response = client.post(f"/api/live/sessions/{session_id}/finish")
    repeated_finish_response = client.post(f"/api/live/sessions/{session_id}/finish")

    assert created["status"] == "active"
    assert created["tracks"] == []
    assert created["segments"] == []
    assert created["segment_total"] == 0
    assert list_response.status_code == 200
    assert list_response.json()["total"] == 1
    assert list_response.json()["sessions"][0]["session_id"] == session_id
    assert detail_response.status_code == 200
    assert detail_response.json()["session_id"] == session_id
    assert finish_response.status_code == 200
    assert finish_response.json()["status"] == "finished"
    assert finish_response.json()["ended_at"] is not None
    assert repeated_finish_response.status_code == 200
    assert repeated_finish_response.json()["status"] == "finished"


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
        }
        assert ready["session"]["session_id"] == session_id
        assert finished["type"] == "session.finished"
        assert finished["session"]["status"] == "finished"

        with pytest.raises(WebSocketDisconnect) as close_error:
            websocket.receive_json()
        assert close_error.value.code == 1000


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
    assert "/api/live/sessions/{session_id}" in paths
    assert "/api/live/sessions/{session_id}/finish" in paths
