"""Tests for configuration API endpoints."""

import tempfile
from pathlib import Path
from unittest.mock import PropertyMock, patch

import pytest
from fastapi.testclient import TestClient

from nola.api.deps import get_app_config_db, get_file_db, get_task_db
from nola.config.settings import Settings
from nola.main import app
from nola.models import init_db


@pytest.fixture
def client() -> TestClient:
    """Create a test client backed by an isolated database."""
    app.openapi_schema = None
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

    app.openapi_schema = None
    get_app_config_db.cache_clear()
    get_file_db.cache_clear()
    get_task_db.cache_clear()


class TestConfigAPI:
    """Test aggregated config and defaults-management endpoints."""

    def test_get_config_returns_aggregated_payload(self, client: TestClient):
        """Get /api/config should expose the frontend-facing config contract."""
        response = client.get("/api/config")

        assert response.status_code == 200
        data = response.json()

        assert data["engine"]["model_size"] == "small"
        assert data["engine"]["device"] == "cpu"
        assert data["engine"]["compute_type"] == "default"
        assert data["engine"]["is_multilingual"] is True
        assert data["transcription"]["defaults"]["beam_size"] == 5
        assert data["transcription"]["defaults"]["vad_parameters"]["threshold"] == 0.5
        assert (
            data["transcription"]["defaults"]["vad_parameters"]["max_speech_duration_s"]
            == "inf"
        )
        schema_groups = {group["group"] for group in data["transcription"]["schema"]}
        assert {"general", "decoding", "vad", "vad_advanced"} <= schema_groups

        general_group = next(
            group
            for group in data["transcription"]["schema"]
            if group["group"] == "general"
        )
        general_keys = {field["key"] for field in general_group["fields"]}
        assert {"language", "task", "initial_prompt"} <= general_keys
        assert data["file"]["max_file_size"] == 500 * 1024 * 1024
        assert any(option["code"] == "en" for option in data["effective_languages"])

    def test_get_engine_defaults_returns_expanded_vad_defaults(
        self, client: TestClient
    ):
        """Engine-defaults endpoint should expose the full VAD default set."""
        response = client.get("/api/config/transcription/engine-defaults")

        assert response.status_code == 200
        defaults = response.json()["defaults"]

        assert defaults["beam_size"] == 5
        assert defaults["vad_filter"] is False
        assert defaults["vad_parameters"]["threshold"] == 0.5
        assert defaults["vad_parameters"]["speech_pad_ms"] == 400
        assert defaults["vad_parameters"]["max_speech_duration_s"] == "inf"

    def test_patch_transcription_defaults_applies_deep_merge(self, client: TestClient):
        """Nested defaults updates should preserve untouched VAD override keys."""
        first = client.patch(
            "/api/config/transcription/defaults",
            json={
                "beam_size": 3,
                "vad_parameters": {
                    "threshold": 0.6,
                    "speech_pad_ms": 500,
                },
            },
        )
        second = client.patch(
            "/api/config/transcription/defaults",
            json={
                "vad_parameters": {
                    "min_silence_duration_ms": 1500,
                }
            },
        )

        assert first.status_code == 200
        assert second.status_code == 200

        defaults = second.json()["defaults"]
        assert defaults["beam_size"] == 3
        assert defaults["vad_parameters"]["threshold"] == 0.6
        assert defaults["vad_parameters"]["speech_pad_ms"] == 500
        assert defaults["vad_parameters"]["min_silence_duration_ms"] == 1500

    def test_patch_transcription_defaults_clears_override_with_null(
        self, client: TestClient
    ):
        """Explicit null should remove top-level and nested override keys."""
        client.patch(
            "/api/config/transcription/defaults",
            json={
                "beam_size": 3,
                "vad_parameters": {
                    "threshold": 0.6,
                    "speech_pad_ms": 500,
                },
            },
        )

        response = client.patch(
            "/api/config/transcription/defaults",
            json={
                "beam_size": None,
                "vad_parameters": {
                    "threshold": None,
                },
            },
        )

        assert response.status_code == 200
        defaults = response.json()["defaults"]
        assert defaults["beam_size"] == 5
        assert defaults["vad_parameters"]["threshold"] == 0.5
        assert defaults["vad_parameters"]["speech_pad_ms"] == 500

    def test_patch_transcription_defaults_rejects_unknown_vad_keys(
        self, client: TestClient
    ):
        """Unknown nested VAD keys should fail validation."""
        response = client.patch(
            "/api/config/transcription/defaults",
            json={"vad_parameters": {"unknown_key": 1}},
        )

        assert response.status_code == 422
        detail = response.json()["detail"]
        assert any(item.get("loc") == ["body", "vad_parameters"] for item in detail)
        assert any("unknown_key" in item.get("msg", "") for item in detail)

    def test_patch_transcription_defaults_rejects_out_of_range_values(
        self, client: TestClient
    ):
        """Out-of-range values should fail before persisting defaults."""
        response = client.patch(
            "/api/config/transcription/defaults",
            json={
                "no_speech_threshold": 1.2,
                "vad_parameters": {"speech_pad_ms": -1},
            },
        )

        assert response.status_code == 422
        detail = response.json()["detail"]
        assert any(
            item.get("loc", [None])[-1] == "no_speech_threshold" for item in detail
        )
        assert any(item.get("loc", [None])[-1] == "speech_pad_ms" for item in detail)

    def test_delete_transcription_defaults_resets_override_layer(
        self, client: TestClient
    ):
        """Delete should remove persisted overrides and restore engine defaults."""
        patch_response = client.patch(
            "/api/config/transcription/defaults",
            json={"beam_size": 3, "vad_filter": True},
        )

        patched = patch_response.json()["defaults"]
        assert patched["beam_size"] == 3
        assert patched["vad_filter"] is True

        delete_response = client.delete("/api/config/transcription/defaults")
        config_response = client.get("/api/config")

        assert delete_response.status_code == 204
        defaults = config_response.json()["transcription"]["defaults"]
        assert defaults["beam_size"] == 5
        assert defaults["vad_filter"] is False

    def test_get_export_config_returns_effective_defaults(self, client: TestClient):
        """Get /api/config/export should expose export defaults for the UI."""
        response = client.get("/api/config/export")

        assert response.status_code == 200
        defaults = response.json()["defaults"]
        assert defaults["format"] == "srt"
        assert defaults["include_timestamps"] is True

    def test_patch_export_defaults_updates_persisted_values(self, client: TestClient):
        """PATCH export defaults should persist selected override values."""
        response = client.patch(
            "/api/config/export/defaults",
            json={"format": "vtt", "include_timestamps": False},
        )

        assert response.status_code == 200
        patched = response.json()["defaults"]
        assert patched["format"] == "vtt"
        assert patched["include_timestamps"] is False

        get_response = client.get("/api/config/export")
        assert get_response.status_code == 200
        stored = get_response.json()["defaults"]
        assert stored["format"] == "vtt"
        assert stored["include_timestamps"] is False

    def test_patch_export_defaults_clears_override_with_null(self, client: TestClient):
        """Explicit null should remove one export override key."""
        client.patch(
            "/api/config/export/defaults",
            json={"format": "ass", "include_timestamps": False},
        )

        response = client.patch(
            "/api/config/export/defaults",
            json={"format": None},
        )

        assert response.status_code == 200
        defaults = response.json()["defaults"]
        assert defaults["format"] == "srt"
        assert defaults["include_timestamps"] is False

    def test_delete_export_defaults_resets_override_layer(self, client: TestClient):
        """Delete should clear export overrides and restore built-in defaults."""
        client.patch(
            "/api/config/export/defaults",
            json={"format": "txt", "include_timestamps": False},
        )

        delete_response = client.delete("/api/config/export/defaults")
        get_response = client.get("/api/config/export")

        assert delete_response.status_code == 204
        defaults = get_response.json()["defaults"]
        assert defaults["format"] == "srt"
        assert defaults["include_timestamps"] is True

    def test_patch_export_defaults_rejects_unknown_key(self, client: TestClient):
        """Unknown export defaults keys should fail validation."""
        response = client.patch(
            "/api/config/export/defaults",
            json={"zip_name": "custom"},
        )

        assert response.status_code == 422
        detail = response.json()["detail"]
        assert any(item.get("loc", [None])[-1] == "zip_name" for item in detail)

    def test_patch_export_defaults_rejects_invalid_format(self, client: TestClient):
        """Unsupported export format should fail before persisting defaults."""
        response = client.patch(
            "/api/config/export/defaults",
            json={"format": "docx"},
        )

        assert response.status_code == 422
        detail = response.json()["detail"]
        assert any(item.get("loc", [None])[-1] == "format" for item in detail)
