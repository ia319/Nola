"""Pytest tests for API endpoints."""

import tempfile
from pathlib import Path
from unittest.mock import PropertyMock, patch

import pytest
from fastapi.testclient import TestClient

from nola.api.deps import get_file_db, get_task_db
from nola.config.settings import Settings
from nola.main import app
from nola.models import init_db


@pytest.fixture
def client():
    """Create test client with isolated database."""
    get_file_db.cache_clear()
    get_task_db.cache_clear()

    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmpdir:
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
            yield TestClient(app)

        get_file_db.cache_clear()
        get_task_db.cache_clear()


class TestHealthEndpoints:
    """Test health and info endpoints."""

    def test_health_check(self, client):
        """Test health endpoint returns ok status."""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert "version" in data

    def test_root(self, client):
        """Test root endpoint returns API info."""
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Nola Core"
        assert "version" in data


class TestFilesAPI:
    """Test file management endpoints."""

    def test_get_nonexistent_file(self, client):
        """Test getting a file that doesn't exist."""
        response = client.get("/api/files/nonexistent-id")
        assert response.status_code == 404

    def test_delete_nonexistent_file(self, client):
        """Test deleting a file that doesn't exist."""
        response = client.delete("/api/files/nonexistent-id")
        assert response.status_code == 404


class TestTranscriptionsAPI:
    """Test transcription endpoints."""

    def test_list_transcriptions_empty(self, client):
        """Test listing transcriptions when none exist."""
        response = client.get("/api/transcriptions")
        assert response.status_code == 200
        data = response.json()
        assert data["tasks"] == []
        assert data["total"] == 0

    def test_get_nonexistent_task(self, client):
        """Test getting a task that doesn't exist."""
        response = client.get("/api/transcriptions/nonexistent-id")
        assert response.status_code == 404

    def test_cancel_nonexistent_task(self, client):
        """Test cancelling a task that doesn't exist."""
        response = client.delete("/api/transcriptions/nonexistent-id")
        assert response.status_code == 404

    def test_create_task_with_invalid_file_id(self, client):
        """Test creating task with non-existent file_id."""
        response = client.post(
            "/api/transcriptions",
            json={"file_id": "nonexistent-file"},
        )
        assert response.status_code == 404

    def test_create_task_from_nonexistent_path(self, client):
        """Test creating task from non-existent path."""
        response = client.post(
            "/api/transcriptions/from-path",
            json={"file_path": "/nonexistent/path/audio.mp3"},
        )
        assert response.status_code == 404

    def test_get_default_options(self, client):
        """Test getting default transcription options."""
        response = client.get("/api/transcriptions/options/defaults")
        assert response.status_code == 200
        data = response.json()
        # Verify key default options exist
        assert "language" in data
        assert "beam_size" in data
        assert data["beam_size"] == 5  # Default value
        assert "vad_filter" in data
        assert data["vad_filter"] is False

    def test_create_task_with_options(self, client):
        """Test creating task with custom transcription options."""
        response = client.post(
            "/api/transcriptions",
            json={
                "file_id": "nonexistent-file",
                "language": "zh",
                "vad_filter": True,
                "beam_size": 3,
            },
        )
        # Should fail because file doesn't exist, not because of options
        assert response.status_code == 404


class TestFilesAPIExtended:
    """Test new file management endpoints."""

    def test_list_files_empty(self, client):
        """Test listing files when none exist."""
        response = client.get("/api/files/")
        assert response.status_code == 200
        data = response.json()
        assert data["files"] == []
        assert data["total"] == 0
        assert data["limit"] == 50
        assert data["offset"] == 0

    def test_list_files_with_pagination(self, client):
        """Test listing files with pagination parameters."""
        response = client.get("/api/files/?limit=10&offset=5")
        assert response.status_code == 200
        data = response.json()
        assert data["limit"] == 10
        assert data["offset"] == 5

    def test_check_integrity_empty(self, client):
        """Test integrity check when no files exist."""
        response = client.get("/api/files/check-integrity")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["missing_files"] == []
        assert data["missing_count"] == 0

    def test_cleanup_empty(self, client):
        """Test cleanup when no orphan records exist."""
        response = client.post("/api/files/cleanup")
        assert response.status_code == 200
        data = response.json()
        assert data["deleted_count"] == 0

