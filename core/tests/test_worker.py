"""Pytest tests for worker module."""

from nola.engines.base import TranscribeOptions
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
