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
            with TestClient(app) as test_client:
                yield test_client

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


class TestTranscriptionRequestSchema:
    """Test TranscriptionRequest schema validation."""

    def test_file_id_required(self):
        """Test that file_id is required."""
        from nola.api.schemas.transcriptions import TranscriptionRequest
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            TranscriptionRequest()

    def test_minimal_request(self):
        """Test creating request with only file_id."""
        from nola.api.schemas.transcriptions import TranscriptionRequest

        request = TranscriptionRequest(file_id="test-file-id")
        assert request.file_id == "test-file-id"
        assert request.language is None
        assert request.task is None

    def test_get_options_dict_excludes_file_id(self):
        """Test get_options_dict excludes file_id."""
        from nola.api.schemas.transcriptions import TranscriptionRequest

        request = TranscriptionRequest(
            file_id="test-file-id", language="en", beam_size=3
        )
        options = request.get_options_dict()
        assert "file_id" not in options
        assert options["language"] == "en"
        assert options["beam_size"] == 3

    def test_get_options_dict_excludes_none_values(self):
        """Test get_options_dict excludes None values."""
        from nola.api.schemas.transcriptions import TranscriptionRequest

        request = TranscriptionRequest(file_id="test-file-id", language="en")
        options = request.get_options_dict()
        assert "language" in options
        assert "beam_size" not in options
        assert "vad_filter" not in options

    def test_task_literal_validation(self):
        """Test task field accepts only valid literals."""
        from nola.api.schemas.transcriptions import TranscriptionRequest
        from pydantic import ValidationError

        # Valid values
        TranscriptionRequest(file_id="test", task="transcribe")
        TranscriptionRequest(file_id="test", task="translate")

        # Invalid value
        with pytest.raises(ValidationError):
            TranscriptionRequest(file_id="test", task="invalid")

    def test_beam_size_validation(self):
        """Test beam_size field validation."""
        from nola.api.schemas.transcriptions import TranscriptionRequest
        from pydantic import ValidationError

        # Valid values
        TranscriptionRequest(file_id="test", beam_size=1)
        TranscriptionRequest(file_id="test", beam_size=5)
        TranscriptionRequest(file_id="test", beam_size=10)

        # Invalid values
        with pytest.raises(ValidationError):
            TranscriptionRequest(file_id="test", beam_size=0)
        with pytest.raises(ValidationError):
            TranscriptionRequest(file_id="test", beam_size=11)

    def test_temperature_accepts_float_or_list(self):
        """Test temperature accepts both float and list of floats."""
        from nola.api.schemas.transcriptions import TranscriptionRequest

        # Single float
        request1 = TranscriptionRequest(file_id="test", temperature=0.5)
        assert request1.temperature == 0.5

        # List of floats
        request2 = TranscriptionRequest(file_id="test", temperature=[0.0, 0.2, 0.4])
        assert request2.temperature == [0.0, 0.2, 0.4]


class TestBatchExportRequestSchema:
    """Test BatchExportRequest schema validation."""

    def test_task_ids_required(self):
        """Test that task_ids is required."""
        from nola.api.schemas.transcriptions import BatchExportRequest
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            BatchExportRequest()

    def test_minimal_batch_request(self):
        """Test creating batch request with only task_ids."""
        from nola.api.schemas.transcriptions import BatchExportRequest

        request = BatchExportRequest(task_ids=["task1", "task2"])
        assert request.task_ids == ["task1", "task2"]
        assert request.format == "srt"
        assert request.include_timestamps is True
        assert request.zip_name is None

    def test_format_validation(self):
        """Test format field accepts only valid literals."""
        from nola.api.schemas.transcriptions import BatchExportRequest
        from pydantic import ValidationError

        # Valid values
        BatchExportRequest(task_ids=["task1"], format="srt")
        BatchExportRequest(task_ids=["task1"], format="vtt")
        BatchExportRequest(task_ids=["task1"], format="txt")
        BatchExportRequest(task_ids=["task1"], format="ass")

        # Invalid value
        with pytest.raises(ValidationError):
            BatchExportRequest(task_ids=["task1"], format="invalid")

    def test_custom_zip_name(self):
        """Test setting custom zip_name."""
        from nola.api.schemas.transcriptions import BatchExportRequest

        request = BatchExportRequest(task_ids=["task1"], zip_name="my-export")
        assert request.zip_name == "my-export"


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
        with task_db._connect() as conn:
            conn.execute(
                "UPDATE transcription_tasks SET status = 'processing' WHERE id = ?",
                ("test-task-srt",),
            )
            conn.commit()
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
        assert response.headers["content-type"] == "application/x-subrip"
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
        with task_db._connect() as conn:
            conn.execute(
                "UPDATE transcription_tasks SET status = 'processing' WHERE id = ?",
                ("test-vtt",),
            )
            conn.commit()
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
        with task_db._connect() as conn:
            conn.execute(
                "UPDATE transcription_tasks SET status = 'processing' WHERE id = ?",
                ("test-txt",),
            )
            conn.commit()
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
        with task_db._connect() as conn:
            conn.execute(
                "UPDATE transcription_tasks SET status = 'processing' WHERE id = ?",
                ("test-ass",),
            )
            conn.commit()
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
        from unittest.mock import PropertyMock, patch

        from nola.config.settings import Settings

        file_db = get_file_db()
        task_db = get_task_db()
        file_db.create_file(
            file_id="test-file-save",
            filename="audio.mp3",
            path="/tmp/audio.mp3",
            size=1000,
        )
        task_db.enqueue(task_id="test-save", file_id="test-file-save", options=None)
        with task_db._connect() as conn:
            conn.execute(
                "UPDATE transcription_tasks SET status = 'processing' WHERE id = ?",
                ("test-save",),
            )
            conn.commit()
        task_db.complete(
            task_id="test-save",
            segments=[{"start": 0.0, "end": 1.0, "text": "Save test"}],
            duration=1.0,
        )

        import tempfile
        from pathlib import Path

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

    def test_export_task_with_no_segments(self, client):
        """Test exporting a completed task with no segments."""
        file_db = get_file_db()
        task_db = get_task_db()
        file_db.create_file(
            file_id="test-file-empty",
            filename="audio.mp3",
            path="/tmp/audio.mp3",
            size=1000,
        )
        task_db.enqueue(task_id="test-empty", file_id="test-file-empty", options=None)
        with task_db._connect() as conn:
            conn.execute(
                "UPDATE transcription_tasks SET status = 'processing' WHERE id = ?",
                ("test-empty",),
            )
            conn.commit()
        task_db.complete(task_id="test-empty", segments=[], duration=1.0)

        response = client.get("/api/transcriptions/test-empty/export?format=srt")
        assert response.status_code == 400
        assert "No segments available" in response.json()["detail"]

    def test_export_invalid_segment_data(self, client):
        """Test exporting with invalid segment data structure."""
        file_db = get_file_db()
        task_db = get_task_db()
        file_db.create_file(
            file_id="test-file-invalid",
            filename="audio.mp3",
            path="/tmp/audio.mp3",
            size=1000,
        )
        task_db.enqueue(
            task_id="test-invalid", file_id="test-file-invalid", options=None
        )
        with task_db._connect() as conn:
            conn.execute(
                "UPDATE transcription_tasks SET status = 'processing' WHERE id = ?",
                ("test-invalid",),
            )
            conn.commit()
        task_db.complete(
            task_id="test-invalid",
            segments=[{"start": 0.0, "text": "Missing end"}],
            duration=1.0,
        )

        response = client.get("/api/transcriptions/test-invalid/export?format=srt")
        assert response.status_code == 500
        assert "Invalid segment" in response.json()["detail"]

    def test_export_non_ascii_filename(self, client):
        """Test exporting with non-ASCII filename uses UTF-8 encoding."""
        file_db = get_file_db()
        task_db = get_task_db()
        file_db.create_file(
            file_id="test-file-unicode",
            filename="音频文件.mp3",
            path="/tmp/unicode.mp3",
            size=1000,
        )
        task_db.enqueue(
            task_id="test-unicode", file_id="test-file-unicode", options=None
        )
        with task_db._connect() as conn:
            conn.execute(
                "UPDATE transcription_tasks SET status = 'processing' WHERE id = ?",
                ("test-unicode",),
            )
            conn.commit()
        task_db.complete(
            task_id="test-unicode",
            segments=[{"start": 0.0, "end": 1.0, "text": "Test"}],
            duration=1.0,
        )

        response = client.get("/api/transcriptions/test-unicode/export?format=srt")
        assert response.status_code == 200
        assert "Content-Disposition" in response.headers
        # Check UTF-8 filename is present
        assert "filename*=UTF-8''" in response.headers["Content-Disposition"]

    def test_export_txt_with_timestamps(self, client):
        """Test exporting as TXT with timestamps."""
        file_db = get_file_db()
        task_db = get_task_db()
        file_db.create_file(
            file_id="test-file-txt-ts",
            filename="audio.mp3",
            path="/tmp/audio.mp3",
            size=1000,
        )
        task_db.enqueue(task_id="test-txt-ts", file_id="test-file-txt-ts", options=None)
        with task_db._connect() as conn:
            conn.execute(
                "UPDATE transcription_tasks SET status = 'processing' WHERE id = ?",
                ("test-txt-ts",),
            )
            conn.commit()
        task_db.complete(
            task_id="test-txt-ts",
            segments=[{"start": 0.0, "end": 1.0, "text": "With timestamp"}],
            duration=1.0,
        )

        response = client.get(
            "/api/transcriptions/test-txt-ts/export?format=txt&include_timestamps=true"
        )
        assert response.status_code == 200
        assert "[00:00:00]" in response.text
        assert "With timestamp" in response.text

    def test_export_format_query_param(self, client):
        """Test different format query parameters."""
        file_db = get_file_db()
        task_db = get_task_db()
        file_db.create_file(
            file_id="test-file-formats",
            filename="audio.mp3",
            path="/tmp/audio.mp3",
            size=1000,
        )
        task_db.enqueue(
            task_id="test-formats", file_id="test-file-formats", options=None
        )
        with task_db._connect() as conn:
            conn.execute(
                "UPDATE transcription_tasks SET status = 'processing' WHERE id = ?",
                ("test-formats",),
            )
            conn.commit()
        task_db.complete(
            task_id="test-formats",
            segments=[{"start": 0.0, "end": 1.0, "text": "Test"}],
            duration=1.0,
        )

        # Test default format (srt)
        response = client.get("/api/transcriptions/test-formats/export")
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/x-subrip"


class TestTranscriptionListFiltering:
    """Test listing transcriptions with various filters."""

    def test_list_with_status_filter(self, client):
        """Test listing transcriptions filtered by status."""
        file_db = get_file_db()
        task_db = get_task_db()

        # Create a file and multiple tasks with different statuses
        file_db.create_file(
            file_id="test-file-list",
            filename="audio.mp3",
            path="/tmp/audio.mp3",
            size=1000,
        )

        task_db.enqueue(task_id="task-pending", file_id="test-file-list", options=None)
        task_db.enqueue(
            task_id="task-processing", file_id="test-file-list", options=None
        )
        task_db.enqueue(
            task_id="task-completed", file_id="test-file-list", options=None
        )

        # Update statuses
        with task_db._connect() as conn:
            conn.execute(
                "UPDATE transcription_tasks SET status = 'processing' WHERE id = ?",
                ("task-processing",),
            )
            conn.execute(
                "UPDATE transcription_tasks SET status = 'processing' WHERE id = ?",
                ("task-completed",),
            )
            conn.commit()

        task_db.complete(task_id="task-completed", segments=[], duration=1.0)

        # Test filtering by pending
        response = client.get("/api/transcriptions?status=pending")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["tasks"][0]["task_id"] == "task-pending"

        # Test filtering by completed
        response = client.get("/api/transcriptions?status=completed")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["tasks"][0]["task_id"] == "task-completed"

    def test_list_with_pagination(self, client):
        """Test listing transcriptions with pagination."""
        file_db = get_file_db()
        task_db = get_task_db()

        file_db.create_file(
            file_id="test-file-page",
            filename="audio.mp3",
            path="/tmp/audio.mp3",
            size=1000,
        )

        # Create multiple tasks
        for i in range(5):
            task_db.enqueue(
                task_id=f"task-page-{i}", file_id="test-file-page", options=None
            )

        # Test limit
        response = client.get("/api/transcriptions?limit=2")
        assert response.status_code == 200
        data = response.json()
        assert len(data["tasks"]) == 2
        assert data["limit"] == 2

        # Test offset
        response = client.get("/api/transcriptions?limit=2&offset=2")
        assert response.status_code == 200
        data = response.json()
        assert len(data["tasks"]) == 2
        assert data["offset"] == 2

    def test_list_limit_bounds(self, client):
        """Test listing transcriptions with limit bounds."""
        # Test minimum limit
        response = client.get("/api/transcriptions?limit=1")
        assert response.status_code == 200

        # Test maximum limit
        response = client.get("/api/transcriptions?limit=100")
        assert response.status_code == 200

        # Test below minimum
        response = client.get("/api/transcriptions?limit=0")
        assert response.status_code == 422

        # Test above maximum
        response = client.get("/api/transcriptions?limit=101")
        assert response.status_code == 422


class TestSettingsConfiguration:
    """Test Settings configuration."""

    def test_exports_dir_property(self):
        """Test exports_dir property returns correct path."""
        from pathlib import Path

        from nola.config.settings import Settings

        settings = Settings(data_dir=Path("/tmp/test_data"))
        assert settings.exports_dir == Path("/tmp/test_data/exports")

    def test_default_settings(self):
        """Test default settings values."""
        from nola.config.settings import Settings

        settings = Settings()
        assert settings.model_size == "small"
        assert settings.device == "cpu"
        assert settings.compute_type == "default"
        assert settings.host == "127.0.0.1"
        assert settings.port == 8000