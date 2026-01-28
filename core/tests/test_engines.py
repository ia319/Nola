"""Test transcription engine base interface."""

from unittest.mock import MagicMock, patch

import pytest

from nola.engines import EngineConfig, FasterWhisperEngine, Segment, TranscriptionEngine


class TestSegment:
    """Test Segment dataclass."""

    def test_segment_creation(self) -> None:
        """Create segment with start, end, and text."""
        segment = Segment(start=0.0, end=1.5, text="Hello world")

        assert segment.start == 0.0
        assert segment.end == 1.5
        assert segment.text == "Hello world"

    def test_segment_equality(self) -> None:
        """Compare two segments with same values."""
        seg1 = Segment(start=0.0, end=1.0, text="test")
        seg2 = Segment(start=0.0, end=1.0, text="test")

        assert seg1 == seg2


class TestEngineConfig:
    """Test EngineConfig dataclass."""

    def test_config_defaults(self) -> None:
        """Verify default configuration values."""
        config = EngineConfig()

        assert config.model_size == "small"
        assert config.device == "cpu"
        assert config.compute_type == "default"

    def test_config_custom_values(self) -> None:
        """Create config with custom values."""
        config = EngineConfig(
            model_size="large-v3", device="cuda", compute_type="float16"
        )

        assert config.model_size == "large-v3"
        assert config.device == "cuda"
        assert config.compute_type == "float16"


class TestTranscriptionEngine:
    """Test TranscriptionEngine abstract interface."""

    def test_engine_is_abstract(self) -> None:
        """Verify TranscriptionEngine cannot be instantiated."""
        with pytest.raises(TypeError):
            TranscriptionEngine()  # type: ignore[abstract]


class TestFasterWhisperEngine:
    """Test FasterWhisperEngine implementation."""

    @patch("nola.engines.faster_whisper.WhisperModel")
    def test_engine_creation_default_config(self, mock_model: MagicMock) -> None:
        """Create engine with default configuration."""
        engine = FasterWhisperEngine()

        mock_model.assert_called_once_with(
            "small", device="cpu", compute_type="default"
        )
        assert engine._config.model_size == "small"

    @patch("nola.engines.faster_whisper.WhisperModel")
    def test_engine_creation_custom_config(self, mock_model: MagicMock) -> None:
        """Create engine with custom configuration."""
        config = EngineConfig(model_size="small", device="cpu", compute_type="int8")
        engine = FasterWhisperEngine(config)

        mock_model.assert_called_once_with("small", device="cpu", compute_type="int8")
        assert engine._config.model_size == "small"

    @patch("nola.engines.faster_whisper.WhisperModel")
    def test_transcribe_yields_segments(self, mock_model: MagicMock) -> None:
        """Verify transcribe method yields Segment objects."""
        # Mock segment objects from faster-whisper
        mock_seg1 = MagicMock(start=0.0, end=1.5, text=" Hello ")
        mock_seg2 = MagicMock(start=1.5, end=3.0, text=" World ")
        mock_model.return_value.transcribe.return_value = ([mock_seg1, mock_seg2], None)

        engine = FasterWhisperEngine()
        segments = list(engine.transcribe("test.mp3"))

        assert len(segments) == 2
        assert segments[0] == Segment(start=0.0, end=1.5, text="Hello")
        assert segments[1] == Segment(start=1.5, end=3.0, text="World")

    @patch("nola.engines.faster_whisper.WhisperModel")
    def test_transcribe_stream_not_implemented(self, mock_model: MagicMock) -> None:
        """Verify transcribe_stream raises NotImplementedError."""
        engine = FasterWhisperEngine()

        with pytest.raises(NotImplementedError, match="Streaming"):
            engine.transcribe_stream(b"audio_data")

    @patch("nola.engines.faster_whisper.WhisperModel")
    def test_transcribe_with_options(self, mock_model: MagicMock) -> None:
        """Verify transcribe passes options to model."""
        from nola.engines import TranscribeOptions

        mock_seg = MagicMock(start=0.0, end=1.0, text="Test")
        mock_model.return_value.transcribe.return_value = ([mock_seg], None)

        engine = FasterWhisperEngine()
        options = TranscribeOptions(language="zh", beam_size=10, vad_filter=True)
        list(engine.transcribe("test.mp3", options))

        # Verify options were passed to model.transcribe
        call_kwargs = mock_model.return_value.transcribe.call_args[1]
        assert call_kwargs["language"] == "zh"
        assert call_kwargs["beam_size"] == 10
        assert call_kwargs["vad_filter"] is True


class TestTranscribeOptions:
    """Test TranscribeOptions dataclass."""

    def test_options_defaults(self) -> None:
        """Verify default option values."""
        from nola.engines import TranscribeOptions

        opts = TranscribeOptions()

        assert opts.language is None
        assert opts.task == "transcribe"
        assert opts.beam_size == 5
        assert opts.vad_filter is False
        assert opts.word_timestamps is False

    def test_options_custom_values(self) -> None:
        """Create options with custom values."""
        from nola.engines import TranscribeOptions

        opts = TranscribeOptions(
            language="en",
            task="translate",
            beam_size=10,
            vad_filter=True,
            word_timestamps=True,
            initial_prompt="This is a test.",
        )

        assert opts.language == "en"
        assert opts.task == "translate"
        assert opts.beam_size == 10
        assert opts.vad_filter is True
        assert opts.word_timestamps is True
        assert opts.initial_prompt == "This is a test."
