"""Test transcription engine base interface."""

from nola.engines import Segment, TranscriptionEngine


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


class TestTranscriptionEngine:
    """Test TranscriptionEngine abstract interface."""

    def test_engine_is_abstract(self) -> None:
        """Verify TranscriptionEngine cannot be instantiated."""
        import pytest

        with pytest.raises(TypeError):
            TranscriptionEngine()  # type: ignore[abstract]
