"""Tests for configuration API endpoints."""

import tempfile
from pathlib import Path
from unittest.mock import PropertyMock, patch

import pytest
from fastapi.testclient import TestClient

from nola.api.deps import get_app_config_db, get_file_db, get_task_db
from nola.config.settings import Settings, settings
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
        model_dir = tmp_path / "models"

        init_db(db_path)
        upload_dir.mkdir(parents=True, exist_ok=True)
        model_dir.mkdir(parents=True, exist_ok=True)

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
            patch.object(
                Settings,
                "default_model_dir",
                new_callable=PropertyMock,
                return_value=model_dir,
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
        assert data["engine"]["device"] == settings.device
        assert data["engine"]["compute_type"] == "default"
        assert data["engine"]["is_multilingual"] is True
        execution_group = next(
            group for group in data["engine"]["schema"] if group["group"] == "execution"
        )
        execution_fields = {field["key"]: field for field in execution_group["fields"]}
        assert [
            option["value"] for option in execution_fields["device"]["options"]
        ] == [
            "auto",
            "cpu",
            "cuda",
        ]
        assert [
            option["value"] for option in execution_fields["compute_type"]["options"]
        ] == [
            "default",
            "float16",
            "int8",
        ]
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
        assert data["model"] == {
            "configured_model_id": "small",
            "last_loaded_model_id": None,
            "last_loaded_device": None,
            "last_loaded_compute_type": None,
            "restart_required": False,
        }

    def test_get_config_uses_runtime_model_for_engine_and_languages(
        self, client: TestClient
    ) -> None:
        """Runtime config should follow the worker-loaded model."""
        config_db = get_app_config_db()
        config_db.set_many(
            "worker.",
            {
                "last_loaded_model_id": "small.en",
                "last_loaded_model_dir": str(settings.default_model_dir.resolve()),
                "last_loaded_device": "cuda",
                "last_loaded_compute_type": "float16",
            },
        )
        config_db.set_many("model.", {"configured_model_id": "small.en"})

        response = client.get("/api/config")

        assert response.status_code == 200
        data = response.json()
        assert data["engine"]["model_size"] == "small.en"
        assert data["engine"]["device"] == "cuda"
        assert data["engine"]["compute_type"] == "float16"
        assert data["engine"]["is_multilingual"] is False
        assert data["effective_languages"] == [
            {"code": "en", "label_key": "options.language.en"}
        ]
        assert data["model"] == {
            "configured_model_id": "small.en",
            "last_loaded_model_id": "small.en",
            "last_loaded_device": "cuda",
            "last_loaded_compute_type": "float16",
            "restart_required": False,
        }

    def test_get_config_canonicalizes_model_aliases(self, client: TestClient) -> None:
        """Alias inputs should not leak into the aggregated model config response."""
        config_db = get_app_config_db()
        config_db.set_many(
            "worker.",
            {
                "last_loaded_model_id": "turbo",
                "last_loaded_model_dir": str(settings.default_model_dir.resolve()),
            },
        )
        config_db.set_many("model.", {"configured_model_id": "large-v3-turbo"})

        response = client.get("/api/config")

        assert response.status_code == 200
        data = response.json()
        assert data["engine"]["model_size"] == "large-v3-turbo"
        assert data["model"] == {
            "configured_model_id": "large-v3-turbo",
            "last_loaded_model_id": "large-v3-turbo",
            "last_loaded_device": None,
            "last_loaded_compute_type": None,
            "restart_required": False,
        }

    def test_get_config_keeps_restart_required_false_for_model_dir_change(
        self, client: TestClient
    ) -> None:
        """Model-dir drift should not become a user-facing restart requirement."""
        config_db = get_app_config_db()
        next_model_dir = settings.default_model_dir.parent / "alternate-models"
        config_db.set_many(
            "worker.",
            {
                "last_loaded_model_id": "small",
                "last_loaded_model_dir": str(settings.default_model_dir.resolve()),
            },
        )
        config_db.set_many(
            "model.",
            {
                "configured_model_id": "small",
                "configured_model_dir": str(next_model_dir.resolve()),
            },
        )

        response = client.get("/api/config")

        assert response.status_code == 200
        assert response.json()["model"] == {
            "configured_model_id": "small",
            "last_loaded_model_id": "small",
            "last_loaded_device": None,
            "last_loaded_compute_type": None,
            "restart_required": False,
        }

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
        precondition = client.patch(
            "/api/config/transcription/defaults",
            json={
                "beam_size": 3,
                "vad_parameters": {
                    "threshold": 0.6,
                    "speech_pad_ms": 500,
                },
            },
        )
        assert precondition.status_code == 200

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
        assert patch_response.status_code == 200

        patched = patch_response.json()["defaults"]
        assert patched["beam_size"] == 3
        assert patched["vad_filter"] is True

        delete_response = client.delete("/api/config/transcription/defaults")
        config_response = client.get("/api/config")

        assert delete_response.status_code == 204
        defaults = config_response.json()["transcription"]["defaults"]
        assert defaults["beam_size"] == 5
        assert defaults["vad_filter"] is False

    def test_get_session_defaults_returns_settings_fallback(
        self, client: TestClient
    ) -> None:
        """Session defaults should fall back to settings without overrides."""
        response = client.get("/api/config/session-defaults")

        assert response.status_code == 200
        data = response.json()
        assert data["execution"] == {
            "model_id": "small",
            "device": settings.device,
            "compute_type": settings.compute_type,
        }
        assert data["transcription"]["beam_size"] == 5
        assert data["transcription"]["vad_parameters"]["threshold"] == 0.5

    def test_patch_session_defaults_execution_only_preserves_transcription(
        self, client: TestClient
    ) -> None:
        """Execution-only PATCH should not clear transcription defaults."""
        transcription_response = client.patch(
            "/api/config/transcription/defaults",
            json={"beam_size": 3},
        )
        assert transcription_response.status_code == 200

        response = client.patch(
            "/api/config/session-defaults",
            json={
                "execution": {
                    "model_id": "large-v3",
                    "device": "cuda",
                    "compute_type": "float16",
                }
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["execution"] == {
            "model_id": "large-v3",
            "device": "cuda",
            "compute_type": "float16",
        }
        assert data["transcription"]["beam_size"] == 3

    def test_patch_session_defaults_transcription_only_preserves_execution(
        self, client: TestClient
    ) -> None:
        """Transcription-only PATCH should not clear execution defaults."""
        execution_response = client.patch(
            "/api/config/session-defaults",
            json={
                "execution": {
                    "model_id": "medium",
                    "device": "cuda",
                    "compute_type": "float16",
                }
            },
        )
        assert execution_response.status_code == 200

        response = client.patch(
            "/api/config/session-defaults",
            json={"transcription": {"beam_size": 7}},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["execution"] == {
            "model_id": "medium",
            "device": "cuda",
            "compute_type": "float16",
        }
        assert data["transcription"]["beam_size"] == 7

    def test_patch_session_defaults_clears_execution_with_null(
        self, client: TestClient
    ) -> None:
        """Explicit null should clear execution overrides."""
        precondition = client.patch(
            "/api/config/session-defaults",
            json={
                "execution": {
                    "model_id": "medium",
                    "device": "cuda",
                    "compute_type": "float16",
                }
            },
        )
        assert precondition.status_code == 200

        response = client.patch(
            "/api/config/session-defaults",
            json={
                "execution": {
                    "model_id": None,
                    "device": None,
                    "compute_type": None,
                }
            },
        )

        assert response.status_code == 200
        assert response.json()["execution"] == {
            "model_id": "small",
            "device": settings.device,
            "compute_type": settings.compute_type,
        }
        assert get_app_config_db().get_all("model.") == {}
        assert get_app_config_db().get_all("execution.") == {}

    def test_patch_session_defaults_clear_model_id_preserves_model_dir(
        self, client: TestClient
    ) -> None:
        """Clearing execution model defaults should preserve model directory config."""
        config_db = get_app_config_db()
        configured_model_dir = settings.default_model_dir.parent / "alternate-models"
        config_db.set_many(
            "model.",
            {
                "configured_model_id": "medium",
                "configured_model_dir": str(configured_model_dir),
            },
        )

        response = client.patch(
            "/api/config/session-defaults",
            json={"execution": {"model_id": None}},
        )

        assert response.status_code == 200
        assert response.json()["execution"]["model_id"] == "small"
        assert config_db.get_all("model.") == {
            "configured_model_dir": str(configured_model_dir)
        }

    def test_patch_session_defaults_keeps_unset_execution_fields(
        self, client: TestClient
    ) -> None:
        """Missing execution fields should not clear existing overrides."""
        precondition = client.patch(
            "/api/config/session-defaults",
            json={
                "execution": {
                    "model_id": "medium",
                    "device": "cuda",
                    "compute_type": "float16",
                }
            },
        )
        assert precondition.status_code == 200

        response = client.patch(
            "/api/config/session-defaults",
            json={"execution": {"device": "cpu"}},
        )

        assert response.status_code == 200
        assert response.json()["execution"] == {
            "model_id": "medium",
            "device": "cpu",
            "compute_type": "float16",
        }

    def test_patch_session_defaults_rejects_invalid_execution_values(
        self, client: TestClient
    ) -> None:
        """Invalid execution device and compute type should fail validation."""
        device_response = client.patch(
            "/api/config/session-defaults",
            json={"execution": {"device": "metal"}},
        )
        compute_response = client.patch(
            "/api/config/session-defaults",
            json={"execution": {"compute_type": "float32"}},
        )

        assert device_response.status_code == 422
        assert compute_response.status_code == 422
        assert any(
            item.get("loc", [None])[-1] == "device"
            for item in device_response.json()["detail"]
        )
        assert any(
            item.get("loc", [None])[-1] == "compute_type"
            for item in compute_response.json()["detail"]
        )

    def test_patch_session_defaults_canonicalizes_model_alias(
        self, client: TestClient
    ) -> None:
        """Execution model aliases should be stored as canonical ids."""
        response = client.patch(
            "/api/config/session-defaults",
            json={"execution": {"model_id": "large"}},
        )

        assert response.status_code == 200
        assert response.json()["execution"]["model_id"] == "large-v3"
        assert get_app_config_db().get_all("model.") == {
            "configured_model_id": "large-v3"
        }

    def test_get_session_defaults_ignores_invalid_execution_overrides(
        self, client: TestClient
    ) -> None:
        """Invalid persisted execution overrides should not break reads."""
        config_db = get_app_config_db()
        config_db.patch_many(
            "execution.",
            {
                "device": "metal",
                "compute_type": "float32",
            },
        )

        response = client.get("/api/config/session-defaults")

        assert response.status_code == 200
        assert response.json()["execution"] == {
            "model_id": "small",
            "device": settings.device,
            "compute_type": settings.compute_type,
        }

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
        precondition = client.patch(
            "/api/config/export/defaults",
            json={"format": "ass", "include_timestamps": False},
        )
        assert precondition.status_code == 200

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
        precondition = client.patch(
            "/api/config/export/defaults",
            json={"format": "txt", "include_timestamps": False},
        )
        assert precondition.status_code == 200

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
