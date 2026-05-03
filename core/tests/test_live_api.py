"""Tests for live transcription API endpoints."""

import tempfile
from pathlib import Path
from unittest.mock import PropertyMock, patch

import pytest
from fastapi.testclient import TestClient

from nola.api.deps import get_app_config_db, get_file_db, get_live_db, get_task_db
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
