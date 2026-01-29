"""Pytest tests for worker module."""

from nola.engines.base import TranscribeOptions
from nola.services.worker import build_transcribe_options


class TestBuildTranscribeOptions:
    """Test options building with invalid key filtering."""

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
