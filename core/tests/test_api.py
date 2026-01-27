"""Pytest tests for API endpoints."""

import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from nola.main import app
from nola.models import init_db


@pytest.fixture
def client():
    """Create test client with isolated database."""
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmpdir:
        db_path = Path(tmpdir) / "test.db"

        # Mock database path in deps module
        with patch("nola.api.deps.DB_PATH", db_path):
            # Initialize schema
            init_db(db_path)

            yield TestClient(app)


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
