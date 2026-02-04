"""Pytest tests for output formatters."""

import pytest

from nola.services.formatters import (
    ASSFormatter,
    OutputFormatter,
    SegmentData,
    SRTFormatter,
    TXTFormatter,
    VTTFormatter,
    get_formatter,
    list_formats,
)
from nola.services.formatters.base import (
    format_timestamp_ass,
    format_timestamp_srt,
    format_timestamp_vtt,
)


class TestSegmentData:
    """Test SegmentData dataclass."""

    def test_create_segment(self):
        """Test creating a segment with basic attributes."""
        seg = SegmentData(start=0.0, end=2.5, text="Hello world")
        assert seg.start == 0.0
        assert seg.end == 2.5
        assert seg.text == "Hello world"


class TestTimestampFormatters:
    """Test timestamp formatting utilities."""

    def test_srt_timestamp_basic(self):
        """Test SRT format: HH:MM:SS,mmm."""
        assert format_timestamp_srt(0.0) == "00:00:00,000"
        assert format_timestamp_srt(1.5) == "00:00:01,500"
        assert format_timestamp_srt(61.0) == "00:01:01,000"
        assert format_timestamp_srt(3661.5) == "01:01:01,500"

    def test_vtt_timestamp_basic(self):
        """Test VTT format: HH:MM:SS.mmm."""
        assert format_timestamp_vtt(0.0) == "00:00:00.000"
        assert format_timestamp_vtt(1.5) == "00:00:01.500"
        assert format_timestamp_vtt(61.25) == "00:01:01.250"

    def test_ass_timestamp_basic(self):
        """Test ASS format: H:MM:SS.cc."""
        assert format_timestamp_ass(0.0) == "0:00:00.00"
        assert format_timestamp_ass(1.5) == "0:00:01.50"
        assert format_timestamp_ass(61.25) == "0:01:01.25"
        assert format_timestamp_ass(3661.5) == "1:01:01.50"

    def test_negative_seconds_clamped_to_zero(self):
        """Negative values should clamp to zero for safety."""
        assert format_timestamp_srt(-1.0) == "00:00:00,000"
        assert format_timestamp_vtt(-100.0) == "00:00:00.000"
        assert format_timestamp_ass(-0.5) == "0:00:00.00"


class TestSRTFormatter:
    """Test SRT subtitle formatter."""

    @pytest.fixture
    def formatter(self):
        return SRTFormatter()

    @pytest.fixture
    def segments(self):
        return [
            SegmentData(start=0.0, end=2.5, text="First line"),
            SegmentData(start=2.5, end=5.0, text="Second line"),
        ]

    def test_properties(self, formatter):
        """Test formatter properties."""
        assert formatter.name == "srt"
        assert formatter.file_extension == "srt"
        assert formatter.content_type == "application/x-subrip"

    def test_format_output(self, formatter, segments):
        """Test SRT output format."""
        result = formatter.format(segments)
        lines = result.split("\n")

        assert lines[0] == "1"
        assert lines[1] == "00:00:00,000 --> 00:00:02,500"
        assert lines[2] == "First line"
        assert lines[3] == ""
        assert lines[4] == "2"

    def test_empty_segments(self, formatter):
        """Test formatting empty segment list."""
        result = formatter.format([])
        assert result == ""


class TestVTTFormatter:
    """Test VTT subtitle formatter."""

    @pytest.fixture
    def formatter(self):
        return VTTFormatter()

    @pytest.fixture
    def segments(self):
        return [SegmentData(start=0.0, end=2.5, text="Hello")]

    def test_properties(self, formatter):
        """Test formatter properties."""
        assert formatter.name == "vtt"
        assert formatter.file_extension == "vtt"
        assert formatter.content_type == "text/vtt"

    def test_format_has_webvtt_header(self, formatter, segments):
        """Test VTT output starts with WEBVTT header."""
        result = formatter.format(segments)
        assert result.startswith("WEBVTT\n")

    def test_format_output(self, formatter, segments):
        """Test VTT output format."""
        result = formatter.format(segments)
        lines = result.split("\n")

        assert lines[0] == "WEBVTT"
        assert lines[1] == ""
        assert lines[2] == "00:00:00.000 --> 00:00:02.500"
        assert lines[3] == "Hello"


class TestTXTFormatter:
    """Test TXT plain text formatter."""

    @pytest.fixture
    def segments(self):
        return [
            SegmentData(start=0.0, end=2.0, text="First"),
            SegmentData(start=2.0, end=4.0, text="Second"),
        ]

    def test_properties(self):
        """Test formatter properties."""
        formatter = TXTFormatter()
        assert formatter.name == "txt"
        assert formatter.file_extension == "txt"
        assert formatter.content_type == "text/plain; charset=utf-8"

    def test_with_timestamps(self, segments):
        """Test TXT output with timestamps."""
        formatter = TXTFormatter(include_timestamps=True)
        result = formatter.format(segments)

        assert "[00:00:00] First" in result
        assert "[00:00:02] Second" in result

    def test_without_timestamps(self, segments):
        """Test TXT output without timestamps."""
        formatter = TXTFormatter(include_timestamps=False)
        result = formatter.format(segments)

        assert result == "First\nSecond"
        assert "[" not in result


class TestASSFormatter:
    """Test ASS subtitle formatter."""

    @pytest.fixture
    def formatter(self):
        return ASSFormatter()

    @pytest.fixture
    def segments(self):
        return [SegmentData(start=0.0, end=2.5, text="Hello ASS")]

    def test_properties(self, formatter):
        """Test formatter properties."""
        assert formatter.name == "ass"
        assert formatter.file_extension == "ass"
        assert formatter.content_type == "text/x-ssa"

    def test_format_has_script_info(self, formatter, segments):
        """Test ASS output has Script Info section."""
        result = formatter.format(segments)
        assert "[Script Info]" in result
        assert "ScriptType: v4.00+" in result

    def test_format_has_styles(self, formatter, segments):
        """Test ASS output has Styles section."""
        result = formatter.format(segments)
        assert "[V4+ Styles]" in result
        assert "Style: Default" in result

    def test_format_has_events(self, formatter, segments):
        """Test ASS output has Events section."""
        result = formatter.format(segments)
        assert "[Events]" in result
        assert "Dialogue:" in result
        assert "Hello ASS" in result


class TestFormatterRegistry:
    """Test formatter registry and factory function."""

    def test_list_formats(self):
        """Test listing available formats."""
        formats = list_formats()
        assert "srt" in formats
        assert "vtt" in formats
        assert "txt" in formats
        assert "ass" in formats

    def test_get_formatter_srt(self):
        """Test getting SRT formatter."""
        formatter = get_formatter("srt")
        assert isinstance(formatter, SRTFormatter)

    def test_get_formatter_case_insensitive(self):
        """Test formatter lookup is case-insensitive."""
        formatter = get_formatter("SRT")
        assert isinstance(formatter, SRTFormatter)

    def test_get_formatter_txt_with_timestamps(self):
        """Test TXT formatter with include_timestamps parameter."""
        formatter = get_formatter("txt", include_timestamps=True)
        assert isinstance(formatter, TXTFormatter)

    def test_get_formatter_invalid_raises(self):
        """Test invalid format raises ValueError."""
        with pytest.raises(ValueError, match="Unsupported format"):
            get_formatter("invalid")

    def test_all_formatters_implement_interface(self):
        """Test all registered formatters implement OutputFormatter."""
        for fmt in list_formats():
            formatter = get_formatter(fmt)
            assert isinstance(formatter, OutputFormatter)
            assert hasattr(formatter, "name")
            assert hasattr(formatter, "file_extension")
            assert hasattr(formatter, "content_type")
            assert hasattr(formatter, "format")
