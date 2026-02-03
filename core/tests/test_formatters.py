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

    def test_large_hour_values(self):
        """Test timestamps with large hour values."""
        # 10 hours
        assert format_timestamp_srt(36000.0) == "10:00:00,000"
        assert format_timestamp_vtt(36000.0) == "10:00:00.000"
        assert format_timestamp_ass(36000.0) == "10:00:00.00"

        # 100 hours
        assert format_timestamp_srt(360000.0) == "100:00:00,000"
        assert format_timestamp_vtt(360000.0) == "100:00:00.000"
        assert format_timestamp_ass(360000.0) == "100:00:00.00"

    def test_fractional_precision(self):
        """Test fractional second precision."""
        # SRT: milliseconds - using values that work with float precision
        assert format_timestamp_srt(1.1) == "00:00:01,100"
        assert format_timestamp_srt(1.5) == "00:00:01,500"
        assert format_timestamp_srt(1.999).startswith("00:00:01,99")

        # VTT: milliseconds
        assert format_timestamp_vtt(1.1) == "00:00:01.100"
        assert format_timestamp_vtt(1.5) == "00:00:01.500"
        assert format_timestamp_vtt(1.999).startswith("00:00:01.99")

        # ASS: centiseconds
        assert format_timestamp_ass(1.1) == "0:00:01.10"
        assert format_timestamp_ass(1.5) == "0:00:01.50"
        assert format_timestamp_ass(1.99) == "0:00:01.99"

    def test_boundary_values(self):
        """Test boundary values for time components."""
        # 59 seconds, 59 minutes
        assert format_timestamp_srt(3599.5) == "00:59:59,500"
        assert format_timestamp_vtt(3599.5) == "00:59:59.500"
        assert format_timestamp_ass(3599.5) == "0:59:59.50"


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

    def test_text_with_leading_trailing_whitespace(self, formatter):
        """Test that text whitespace is stripped."""
        segments = [SegmentData(start=0.0, end=1.0, text="  Hello  ")]
        result = formatter.format(segments)
        assert "Hello" in result
        assert "  Hello  " not in result

    def test_text_with_newlines(self, formatter):
        """Test text containing newlines."""
        segments = [SegmentData(start=0.0, end=1.0, text="Line one\nLine two")]
        result = formatter.format(segments)
        # SRT should preserve newlines in text
        assert "Line one" in result
        assert "Line two" in result

    def test_special_characters_in_text(self, formatter):
        """Test text with special characters."""
        segments = [
            SegmentData(start=0.0, end=1.0, text="Special chars: <>&\"'"),
            SegmentData(start=1.0, end=2.0, text="Unicode: 你好 🎉"),
        ]
        result = formatter.format(segments)
        assert "Special chars: <>&\"'" in result
        assert "Unicode: 你好 🎉" in result

    def test_single_segment(self, formatter):
        """Test formatting with single segment."""
        segments = [SegmentData(start=0.0, end=1.0, text="Only one")]
        result = formatter.format(segments)
        assert "1\n" in result
        assert "Only one" in result

    def test_many_segments(self, formatter):
        """Test formatting with many segments."""
        segments = [
            SegmentData(start=i, end=i + 1, text=f"Segment {i}") for i in range(100)
        ]
        result = formatter.format(segments)
        # Check first and last
        assert "1\n" in result
        assert "100\n" in result
        assert "Segment 0" in result
        assert "Segment 99" in result


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

    def test_empty_segments(self, formatter):
        """Test VTT with empty segments still has header."""
        result = formatter.format([])
        assert result.startswith("WEBVTT\n")

    def test_vtt_special_characters(self, formatter):
        """Test VTT with special characters."""
        segments = [SegmentData(start=0.0, end=1.0, text="Test <b>bold</b>")]
        result = formatter.format(segments)
        # VTT should preserve HTML-like tags
        assert "Test <b>bold</b>" in result


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

    def test_empty_segments(self):
        """Test TXT with empty segments."""
        formatter = TXTFormatter()
        result = formatter.format([])
        assert result == ""

    def test_txt_with_multiline_text(self):
        """Test TXT preserves newlines in text."""
        formatter = TXTFormatter(include_timestamps=False)
        segments = [SegmentData(start=0.0, end=1.0, text="Line 1\nLine 2")]
        result = formatter.format(segments)
        assert "Line 1\nLine 2" in result

    def test_txt_timestamp_format(self):
        """Test TXT uses simplified timestamp format."""
        formatter = TXTFormatter(include_timestamps=True)
        segments = [SegmentData(start=3661.5, end=3662.5, text="Test")]
        result = formatter.format(segments)
        # Should use HH:MM:SS without milliseconds
        assert "[01:01:01] Test" in result

    def test_txt_negative_timestamp(self):
        """Test TXT handles negative timestamps."""
        formatter = TXTFormatter(include_timestamps=True)
        segments = [SegmentData(start=-1.0, end=1.0, text="Test")]
        result = formatter.format(segments)
        # Should clamp to zero
        assert "[00:00:00] Test" in result


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

    def test_ass_newline_conversion(self, formatter):
        """Test ASS converts newlines to \\N."""
        segments = [SegmentData(start=0.0, end=1.0, text="Line 1\nLine 2")]
        result = formatter.format(segments)
        # ASS uses \N for line breaks
        assert "Line 1\\NLine 2" in result
        assert "Line 1\nLine 2" not in result

    def test_ass_empty_segments(self, formatter):
        """Test ASS with empty segments still has structure."""
        result = formatter.format([])
        assert "[Script Info]" in result
        assert "[V4+ Styles]" in result
        assert "[Events]" in result

    def test_ass_resolution(self, formatter, segments):
        """Test ASS specifies resolution."""
        result = formatter.format(segments)
        assert "PlayResX: 1920" in result
        assert "PlayResY: 1080" in result

    def test_ass_dialogue_format(self, formatter):
        """Test ASS dialogue line format."""
        segments = [SegmentData(start=1.5, end=3.25, text="Test")]
        result = formatter.format(segments)
        # Check proper ASS timestamp format (H:MM:SS.cc)
        assert "Dialogue: 0,0:00:01.50,0:00:03.25,Default,,0,0,0,,Test" in result


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


class TestFormatterEdgeCases:
    """Test edge cases across all formatters."""

    def test_all_formatters_handle_empty_text(self):
        """Test all formatters handle empty text in segments."""
        segments = [SegmentData(start=0.0, end=1.0, text="")]
        for fmt in list_formats():
            formatter = get_formatter(fmt)
            result = formatter.format(segments)
            # Should not crash, should produce valid output
            assert isinstance(result, str)

    def test_all_formatters_handle_zero_duration(self):
        """Test all formatters handle zero duration segments."""
        segments = [SegmentData(start=1.0, end=1.0, text="Zero duration")]
        for fmt in list_formats():
            formatter = get_formatter(fmt)
            result = formatter.format(segments)
            assert isinstance(result, str)
            assert "Zero duration" in result

    def test_all_formatters_preserve_unicode(self):
        """Test all formatters preserve unicode characters."""
        segments = [
            SegmentData(start=0.0, end=1.0, text="中文"),
            SegmentData(start=1.0, end=2.0, text="日本語"),
            SegmentData(start=2.0, end=3.0, text="한국어"),
            SegmentData(start=3.0, end=4.0, text="Emoji: 😀🎉🚀"),
        ]
        for fmt in list_formats():
            formatter = get_formatter(fmt)
            result = formatter.format(segments)
            assert "中文" in result
            assert "日本語" in result
            assert "한국어" in result
            assert "😀🎉🚀" in result

    def test_all_formatters_handle_very_long_text(self):
        """Test all formatters handle very long text."""
        long_text = "A" * 10000
        segments = [SegmentData(start=0.0, end=1.0, text=long_text)]
        for fmt in list_formats():
            formatter = get_formatter(fmt)
            result = formatter.format(segments)
            assert long_text in result or long_text.strip() in result

    def test_formatter_consistency(self):
        """Test all formatters produce consistent output for same input."""
        segments = [
            SegmentData(start=0.0, end=2.5, text="First"),
            SegmentData(start=2.5, end=5.0, text="Second"),
        ]
        for fmt in list_formats():
            formatter = get_formatter(fmt)
            result1 = formatter.format(segments)
            result2 = formatter.format(segments)
            assert result1 == result2


class TestGetFormatterOptions:
    """Test get_formatter with various options."""

    def test_txt_formatter_default_includes_timestamps(self):
        """Test TXT formatter defaults to including timestamps."""
        formatter = get_formatter("txt")
        segments = [SegmentData(start=0.0, end=1.0, text="Test")]
        result = formatter.format(segments)
        assert "[" in result

    def test_txt_formatter_exclude_timestamps(self):
        """Test TXT formatter with timestamps disabled."""
        formatter = get_formatter("txt", include_timestamps=False)
        segments = [SegmentData(start=0.0, end=1.0, text="Test")]
        result = formatter.format(segments)
        assert result == "Test"

    def test_include_timestamps_ignored_for_non_txt(self):
        """Test include_timestamps parameter is ignored for non-TXT formats."""
        # Should not raise error even though parameter is ignored
        get_formatter("srt", include_timestamps=False)
        get_formatter("vtt", include_timestamps=False)
        get_formatter("ass", include_timestamps=False)