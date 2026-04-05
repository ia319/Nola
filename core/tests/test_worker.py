"""Pytest tests for worker module."""

from pathlib import Path
from unittest.mock import Mock, PropertyMock, patch

from nola.config import settings as app_settings
from nola.config.settings import Settings
from nola.engines.base import TranscribeOptions
from nola.model_hub.contracts import ModelInfo
from nola.model_hub.errors import UnknownModelError
from nola.services import worker as worker_module
from nola.services.worker import build_transcribe_options


class StubConfigStore:
    """Provide the minimal config-store contract used by worker tests."""

    def __init__(self, values: dict[str, object]) -> None:
        """Initialize the stubbed defaults payload."""
        self.values = values

    def get_all(self, prefix: str) -> dict[str, object]:
        """Return persisted defaults for the requested prefix."""
        assert prefix == "transcription."
        return self.values


class TestBuildTranscribeOptions:
    """Test worker-side option merging and invalid key filtering."""

    def test_empty_options(self):
        """Empty dict should return default options."""
        options = build_transcribe_options({})
        assert options == TranscribeOptions()

    def test_none_options(self):
        """None should return default options."""
        options = build_transcribe_options(None)
        assert options == TranscribeOptions()

    def test_valid_options(self):
        """Valid options should be applied."""
        options = build_transcribe_options({"language": "en", "beam_size": 3})

        assert options.language == "en"
        assert options.beam_size == 3
        # Other fields should use defaults
        assert options.task == "transcribe"

    def test_invalid_keys_filtered(self):
        """Invalid keys should be silently filtered out."""
        options = build_transcribe_options(
            {
                "language": "zh",
                "invalid_key": "should_be_ignored",
                "another_invalid": 123,
            }
        )

        assert options.language == "zh"
        # Should not raise TypeError for invalid keys
        assert not hasattr(options, "invalid_key")

    def test_mixed_valid_invalid_keys(self):
        """Mixed valid and invalid keys should work."""
        options = build_transcribe_options(
            {
                "task": "translate",
                "beam_size": 7,
                "foo": "bar",
                "baz": 999,
            }
        )

        assert options.task == "translate"
        assert options.beam_size == 7

    def test_app_defaults_apply_when_task_omits_field(self):
        """Persisted defaults should fill in fields omitted by the task."""
        options = build_transcribe_options(
            {"language": "en"},
            StubConfigStore({"beam_size": 3, "vad_filter": True}),
        )

        assert options.language == "en"
        assert options.beam_size == 3
        assert options.vad_filter is True

    def test_task_options_override_app_defaults(self):
        """Per-task options should override persisted application defaults."""
        options = build_transcribe_options(
            {"beam_size": 7},
            StubConfigStore({"beam_size": 3, "task": "translate"}),
        )

        assert options.beam_size == 7
        assert options.task == "translate"

    def test_nested_vad_parameters_deep_merge_across_layers(self):
        """Nested VAD overrides should merge instead of replacing whole objects."""
        options = build_transcribe_options(
            {"vad_parameters": {"threshold": 0.7}},
            StubConfigStore({"vad_parameters": {"speech_pad_ms": 500}}),
        )

        assert options.vad_parameters == {
            "speech_pad_ms": 500,
            "threshold": 0.7,
        }

    def test_empty_app_config_matches_previous_default_behavior(self):
        """An empty config table should behave exactly like the old worker path."""
        options = build_transcribe_options(None, StubConfigStore({}))

        assert options == TranscribeOptions()

    def test_engine_config_keys_stay_out_of_transcribe_options(self):
        """Engine startup config should not become task-level transcription options."""
        options = build_transcribe_options(
            {
                "device": "cuda",
                "compute_type": "float16",
                "model_size": "small.en",
                "beam_size": 3,
            },
            StubConfigStore({"device": "cpu"}),
        )

        assert options.beam_size == 3
        assert not hasattr(options, "device")
        assert not hasattr(options, "compute_type")
        assert not hasattr(options, "model_size")

    def test_inf_sentinel_deserializes_for_vad_max_speech_duration(self):
        """Known numeric sentinel values should be restored before engine call."""
        options = build_transcribe_options(
            {
                "vad_parameters": {
                    "max_speech_duration_s": "inf",
                }
            }
        )

        assert options.vad_parameters == {"max_speech_duration_s": float("inf")}

    def test_inf_sentinel_deserializes_inside_nested_lists(self):
        """Deserializer should recurse into lists to keep serializer symmetry."""
        options = build_transcribe_options(
            {
                "vad_parameters": {
                    "history": [{"max_speech_duration_s": "inf"}],
                }
            }
        )

        assert options.vad_parameters == {
            "history": [{"max_speech_duration_s": float("inf")}]
        }

    def test_plain_inf_string_is_preserved_for_text_fields(self):
        """Text payloads equal to 'inf' should remain text values."""
        options = build_transcribe_options({"hotwords": "inf"})

        assert options.hotwords == "inf"


class _WorkerModelConfigStore:
    """Provide the minimal model config contract used during worker startup."""

    def __init__(self, values: dict[str, object] | None = None) -> None:
        """Store model config reads and later worker state writes."""
        self.values = values or {}
        self.writes: list[tuple[str, dict[str, object]]] = []

    def get_all(self, prefix: str) -> dict[str, object]:
        """Return model settings for the requested prefix."""
        assert prefix == "model."
        return self.values

    def set_many(self, prefix: str, values: dict[str, object]) -> None:
        """Record worker state writes for later assertions."""
        self.writes.append((prefix, values))


class TestWorkerStartup:
    """Test worker startup guards around configured models."""

    def test_worker_loop_logs_unknown_model_and_exits(self, tmp_path: Path) -> None:
        """Exit cleanly when the configured model is not in the registry."""
        model_dir = tmp_path / "models"
        model_dir.mkdir()
        db_path = tmp_path / "nola.db"
        config_store = _WorkerModelConfigStore({"configured_model_id": "missing-model"})

        with (
            patch.object(
                Settings, "db_path", new_callable=PropertyMock, return_value=db_path
            ),
            patch.object(app_settings, "model_size", "small"),
            patch.object(app_settings, "model_dir", model_dir),
            patch.object(
                Settings,
                "default_model_dir",
                new_callable=PropertyMock,
                return_value=model_dir,
            ),
            patch("nola.services.worker.FileDatabase"),
            patch("nola.services.worker.TaskDatabase"),
            patch(
                "nola.services.worker.AppConfigDatabase",
                return_value=config_store,
            ),
            patch(
                "nola.services.worker.resolve_model_dir",
                return_value=(model_dir, "settings"),
            ),
            patch(
                "nola.model_hub.require_model",
                side_effect=UnknownModelError("missing-model"),
            ),
            patch.object(worker_module.logger, "error") as logger_error,
        ):
            worker_module.worker_loop(db_path)

        logger_error.assert_any_call(
            "Configured model '%s' is not part of the supported registry. "
            "Update the model setting before starting the Worker.",
            "missing-model",
        )
        assert config_store.writes == []

    def test_worker_loop_persists_canonical_loaded_model_id(
        self, tmp_path: Path
    ) -> None:
        """Persist the canonical model id after startup resolves aliases."""
        model_dir = tmp_path / "models"
        model_dir.mkdir()
        db_path = tmp_path / "nola.db"
        config_store = _WorkerModelConfigStore({"configured_model_id": "large"})
        task_db = Mock()
        task_db.dequeue.side_effect = KeyboardInterrupt
        storage = Mock()
        storage.is_downloaded.return_value = True
        model_info = ModelInfo(
            model_id="large-v3",
            name="Large V3",
            repo_id="repo/large-v3",
            runtime="faster-whisper",
            languages="multilingual",
            size_bytes=1,
            speed_rank=1,
            accuracy_rank=1,
            description="test model",
        )

        with (
            patch.object(
                Settings, "db_path", new_callable=PropertyMock, return_value=db_path
            ),
            patch.object(app_settings, "model_size", "small"),
            patch.object(app_settings, "model_dir", model_dir),
            patch.object(
                Settings,
                "default_model_dir",
                new_callable=PropertyMock,
                return_value=model_dir,
            ),
            patch.object(worker_module, "_running", True),
            patch("nola.services.worker.FileDatabase"),
            patch("nola.services.worker.TaskDatabase", return_value=task_db),
            patch(
                "nola.services.worker.AppConfigDatabase",
                return_value=config_store,
            ),
            patch(
                "nola.services.worker.resolve_model_dir",
                return_value=(model_dir, "settings"),
            ),
            patch("nola.model_hub.require_model", return_value=model_info),
            patch("nola.model_hub.ModelStorage", return_value=storage),
            patch("nola.services.worker.FasterWhisperEngine") as engine_cls,
        ):
            worker_module.worker_loop(db_path)

        engine_config = engine_cls.call_args.kwargs["config"]
        assert engine_config.model_size == "large-v3"
        assert engine_config.download_root == model_dir
        assert config_store.writes == [
            (
                "worker.",
                {
                    "last_loaded_model_id": "large-v3",
                    "last_loaded_model_dir": str(model_dir),
                },
            )
        ]
