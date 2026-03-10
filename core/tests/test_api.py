"""Pytest tests for API endpoints."""

import tempfile
from pathlib import Path
from unittest.mock import PropertyMock, patch

import pytest
from fastapi.testclient import TestClient

from nola.api.deps import get_app_config_db, get_file_db, get_task_db
from nola.config.constants import MAX_BATCH_EXPORT_TASKS
from nola.config.settings import Settings
from nola.main import app
from nola.models import init_db


def _claim_pending_task(task_db, expected_task_id: str) -> None:
    """Claim a queued task through the public queue API."""
    task = task_db.dequeue(worker_id="test-worker")
    assert task is not None
    assert task["id"] == expected_task_id


@pytest.fixture
def client():
    """Create test client with isolated database."""
    get_app_config_db.cache_clear()
    get_file_db.cache_clear()
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

        get_app_config_db.cache_clear()
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


class TestInputValidation:
    """Test API input validation behavior."""

    def test_language_uppercase_code_is_normalized(self, client: TestClient):
        """Test uppercase language code is accepted and normalized."""
        file_db = get_file_db()
        file_db.create_file(
            file_id="uppercase-lang-file",
            filename="audio.mp3",
            path="/tmp/audio.mp3",
            size=1000,
        )

        response = client.post(
            "/api/transcriptions",
            json={"file_id": "uppercase-lang-file", "language": "EN"},
        )

        assert response.status_code == 200
        assert response.json()["options"]["language"] == "en"

    def test_language_invalid_code_returns_422(self, client: TestClient):
        """Test unsupported language code returns 422."""
        response = client.post(
            "/api/transcriptions",
            json={"file_id": "nonexistent-file", "language": "chinese"},
        )

        assert response.status_code == 422
        details = response.json()["detail"]
        assert any(item["loc"][-1] == "language" for item in details)
        assert "Unsupported language" in str(details)

    def test_language_locale_style_returns_422(self, client: TestClient):
        """Test locale-style language code returns 422."""
        response = client.post(
            "/api/transcriptions",
            json={"file_id": "nonexistent-file", "language": "zh-CN"},
        )

        assert response.status_code == 422
        details = response.json()["detail"]
        assert any(item["loc"][-1] == "language" for item in details)
        assert "Unsupported language" in str(details)

    def test_language_valid_code_passes_schema_validation(self, client: TestClient):
        """Test valid ISO 639-1 code reaches business logic layer."""
        response = client.post(
            "/api/transcriptions",
            json={"file_id": "nonexistent-file", "language": "zh"},
        )

        assert response.status_code == 404
        assert "File not found" in response.json()["detail"]

    def test_language_none_passes_schema_validation(self, client: TestClient):
        """Test null language reaches business logic layer."""
        response = client.post(
            "/api/transcriptions",
            json={"file_id": "nonexistent-file", "language": None},
        )

        assert response.status_code == 404
        assert "File not found" in response.json()["detail"]

    def test_temperature_negative_returns_422(self, client: TestClient):
        """Test negative temperature is rejected."""
        response = client.post(
            "/api/transcriptions",
            json={"file_id": "nonexistent-file", "temperature": -0.1},
        )

        assert response.status_code == 422
        details = response.json()["detail"]
        assert any(item["loc"][-1] == "temperature" for item in details)
        assert "non-negative" in str(details)

    def test_temperature_list_with_negative_returns_422(self, client: TestClient):
        """Test negative element in temperature list is rejected."""
        response = client.post(
            "/api/transcriptions",
            json={"file_id": "nonexistent-file", "temperature": [0.0, -0.2]},
        )

        assert response.status_code == 422
        details = response.json()["detail"]
        assert any(item["loc"][-1] == "temperature" for item in details)
        assert "non-negative" in str(details)

    def test_batch_export_empty_task_ids_returns_422(self, client: TestClient):
        """Test batch export rejects empty task_ids."""
        response = client.post(
            "/api/transcriptions/export/batch",
            json={"task_ids": [], "format": "srt"},
        )

        assert response.status_code == 422
        details = response.json()["detail"]
        assert any(item["loc"][-1] == "task_ids" for item in details)

    def test_batch_export_task_ids_exceed_max_returns_422(self, client: TestClient):
        """Test batch export rejects task_ids longer than max length."""
        task_ids = [f"task-{i}" for i in range(MAX_BATCH_EXPORT_TASKS + 1)]
        response = client.post(
            "/api/transcriptions/export/batch",
            json={"task_ids": task_ids, "format": "srt"},
        )

        assert response.status_code == 422
        details = response.json()["detail"]
        assert any(item["loc"][-1] == "task_ids" for item in details)


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


class TestExportAPI:
    """Test transcription export endpoints."""

    def test_export_nonexistent_task(self, client):
        """Test exporting a task that doesn't exist."""
        response = client.get("/api/transcriptions/nonexistent-id/export")
        assert response.status_code == 404

    def test_export_uncompleted_task(self, client):
        """Test exporting a task that is not completed."""
        file_db = get_file_db()
        task_db = get_task_db()
        file_db.create_file(
            file_id="test-file",
            filename="test.mp3",
            path="/tmp/test.mp3",
            size=1000,
        )
        task_db.enqueue(task_id="test-task", file_id="test-file", options=None)

        response = client.get("/api/transcriptions/test-task/export")
        assert response.status_code == 400
        assert "not completed" in response.json()["detail"]

    def test_export_srt_format(self, client):
        """Test exporting as SRT format."""
        file_db = get_file_db()
        task_db = get_task_db()
        file_db.create_file(
            file_id="test-file-srt",
            filename="audio.mp3",
            path="/tmp/audio.mp3",
            size=1000,
        )
        task_db.enqueue(task_id="test-task-srt", file_id="test-file-srt", options=None)
        _claim_pending_task(task_db, "test-task-srt")
        task_db.complete(
            task_id="test-task-srt",
            segments=[
                {"start": 0.0, "end": 2.5, "text": "Hello world"},
                {"start": 2.5, "end": 5.0, "text": "Test subtitle"},
            ],
            duration=5.0,
        )

        response = client.get("/api/transcriptions/test-task-srt/export?format=srt")
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("application/x-subrip")
        content = response.text
        assert "00:00:00,000 --> 00:00:02,500" in content
        assert "Hello world" in content

    def test_export_vtt_format(self, client):
        """Test exporting as VTT format."""
        file_db = get_file_db()
        task_db = get_task_db()
        file_db.create_file(
            file_id="test-file-vtt",
            filename="audio.mp3",
            path="/tmp/audio.mp3",
            size=1000,
        )
        task_db.enqueue(task_id="test-vtt", file_id="test-file-vtt", options=None)
        _claim_pending_task(task_db, "test-vtt")
        task_db.complete(
            task_id="test-vtt",
            segments=[{"start": 0.0, "end": 1.0, "text": "VTT test"}],
            duration=1.0,
        )

        response = client.get("/api/transcriptions/test-vtt/export?format=vtt")
        assert response.status_code == 200
        assert "text/vtt" in response.headers["content-type"]
        assert response.text.startswith("WEBVTT")

    def test_export_txt_without_timestamps(self, client):
        """Test exporting as TXT without timestamps."""
        file_db = get_file_db()
        task_db = get_task_db()
        file_db.create_file(
            file_id="test-file-txt",
            filename="audio.mp3",
            path="/tmp/audio.mp3",
            size=1000,
        )
        task_db.enqueue(task_id="test-txt", file_id="test-file-txt", options=None)
        _claim_pending_task(task_db, "test-txt")
        task_db.complete(
            task_id="test-txt",
            segments=[{"start": 0.0, "end": 1.0, "text": "Plain text"}],
            duration=1.0,
        )

        response = client.get(
            "/api/transcriptions/test-txt/export?format=txt&include_timestamps=false"
        )
        assert response.status_code == 200
        assert response.text == "Plain text"
        assert "[" not in response.text

    def test_export_ass_format(self, client):
        """Test exporting as ASS format."""
        file_db = get_file_db()
        task_db = get_task_db()
        file_db.create_file(
            file_id="test-file-ass",
            filename="audio.mp3",
            path="/tmp/audio.mp3",
            size=1000,
        )
        task_db.enqueue(task_id="test-ass", file_id="test-file-ass", options=None)
        _claim_pending_task(task_db, "test-ass")
        task_db.complete(
            task_id="test-ass",
            segments=[{"start": 0.0, "end": 1.0, "text": "ASS test"}],
            duration=1.0,
        )

        response = client.get("/api/transcriptions/test-ass/export?format=ass")
        assert response.status_code == 200
        assert "[Script Info]" in response.text
        assert "Dialogue:" in response.text

    def test_export_save_to_disk(self, client):
        """Test exporting with save=true returns JSON with file path."""
        file_db = get_file_db()
        task_db = get_task_db()
        file_db.create_file(
            file_id="test-file-save",
            filename="audio.mp3",
            path="/tmp/audio.mp3",
            size=1000,
        )
        task_db.enqueue(task_id="test-save", file_id="test-file-save", options=None)
        _claim_pending_task(task_db, "test-save")
        task_db.complete(
            task_id="test-save",
            segments=[{"start": 0.0, "end": 1.0, "text": "Save test"}],
            duration=1.0,
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
                    "/api/transcriptions/test-save/export?format=srt&save=true"
                )
                assert response.status_code == 200
                data = response.json()
                assert "saved_path" in data
                assert data["saved_path"].endswith(".srt")


class TestBatchExportAPI:
    """Tests for batch export endpoint."""

    def test_batch_export_success(self, client: TestClient):
        """Test batch export with valid completed tasks."""
        import io
        import zipfile

        file_db = get_file_db()
        task_db = get_task_db()

        # Create two completed tasks
        for i in range(2):
            file_db.create_file(
                file_id=f"batch-file-{i}",
                filename=f"audio_{i}.mp3",
                path=f"/tmp/audio_{i}.mp3",
                size=1000,
            )
            task_db.enqueue(
                task_id=f"batch-task-{i}", file_id=f"batch-file-{i}", options=None
            )
            _claim_pending_task(task_db, f"batch-task-{i}")
            task_db.complete(
                task_id=f"batch-task-{i}",
                segments=[{"start": 0.0, "end": 1.0, "text": f"Test {i}"}],
                duration=1.0,
            )

        response = client.post(
            "/api/transcriptions/export/batch",
            json={"task_ids": ["batch-task-0", "batch-task-1"], "format": "srt"},
        )

        assert response.status_code == 200
        assert response.headers["content-type"].startswith("application/zip")

        # Verify ZIP contents
        zip_buffer = io.BytesIO(response.content)
        with zipfile.ZipFile(zip_buffer, "r") as zf:
            names = zf.namelist()
            assert len(names) == 2
            assert "audio_0.srt" in names
            assert "audio_1.srt" in names

    def test_batch_export_partial_failure(self, client: TestClient):
        """Test batch export with mix of valid and invalid tasks."""
        import io
        import zipfile

        file_db = get_file_db()
        task_db = get_task_db()

        # Create one completed task
        file_db.create_file(
            file_id="partial-file",
            filename="partial.mp3",
            path="/tmp/partial.mp3",
            size=1000,
        )
        task_db.enqueue(task_id="partial-task", file_id="partial-file", options=None)
        _claim_pending_task(task_db, "partial-task")
        task_db.complete(
            task_id="partial-task",
            segments=[{"start": 0.0, "end": 1.0, "text": "Partial test"}],
            duration=1.0,
        )

        response = client.post(
            "/api/transcriptions/export/batch",
            json={
                "task_ids": ["partial-task", "nonexistent-task"],
                "format": "srt",
            },
        )

        assert response.status_code == 200

        zip_buffer = io.BytesIO(response.content)
        with zipfile.ZipFile(zip_buffer, "r") as zf:
            names = zf.namelist()
            assert "partial.srt" in names
            assert "_errors.txt" in names
            errors = zf.read("_errors.txt").decode()
            assert "nonexistent-task" in errors

    def test_batch_export_all_failed(self, client: TestClient):
        """Test batch export when all tasks fail."""
        response = client.post(
            "/api/transcriptions/export/batch",
            json={"task_ids": ["fake-1", "fake-2"], "format": "srt"},
        )

        assert response.status_code == 400
        assert "All" in response.json()["detail"]

    def test_batch_export_custom_zip_name(self, client: TestClient):
        """Test batch export with custom ZIP filename."""
        file_db = get_file_db()
        task_db = get_task_db()

        file_db.create_file(
            file_id="zip-name-file",
            filename="custom.mp3",
            path="/tmp/custom.mp3",
            size=1000,
        )
        task_db.enqueue(task_id="zip-name-task", file_id="zip-name-file", options=None)
        _claim_pending_task(task_db, "zip-name-task")
        task_db.complete(
            task_id="zip-name-task",
            segments=[{"start": 0.0, "end": 1.0, "text": "Custom name"}],
            duration=1.0,
        )

        response = client.post(
            "/api/transcriptions/export/batch",
            json={
                "task_ids": ["zip-name-task"],
                "format": "srt",
                "zip_name": "my_subtitles",
            },
        )

        assert response.status_code == 200
        content_disp = response.headers["content-disposition"]
        assert "my_subtitles.zip" in content_disp

    def test_batch_export_zip_name_injection(self, client: TestClient):
        """Test that CR/LF in zip_name is sanitized."""
        file_db = get_file_db()
        task_db = get_task_db()

        file_db.create_file(
            file_id="inject-file",
            filename="inject.mp3",
            path="/tmp/inject.mp3",
            size=1000,
        )
        task_db.enqueue(task_id="inject-task", file_id="inject-file", options=None)
        _claim_pending_task(task_db, "inject-task")
        task_db.complete(
            task_id="inject-task",
            segments=[{"start": 0.0, "end": 1.0, "text": "Inject test"}],
            duration=1.0,
        )

        response = client.post(
            "/api/transcriptions/export/batch",
            json={
                "task_ids": ["inject-task"],
                "format": "srt",
                "zip_name": '  bad\r\n/\\header"  ',
            },
        )

        assert response.status_code == 200
        content_disp = response.headers["content-disposition"]
        # Verify dangerous chars are removed and whitespace is trimmed
        assert "\r" not in content_disp
        assert "\n" not in content_disp
        assert "/" not in content_disp
        assert "\\" not in content_disp
        assert '"badheader.zip"' in content_disp
