"""SRT (SubRip Text) subtitle formatter."""

from collections.abc import Sequence

from nola.services.formatters.base import (
    OutputFormatter,
    SegmentData,
    format_timestamp_srt,
)


class SRTFormatter(OutputFormatter):
    """SRT subtitle formatter.

    Output format:
        1
        00:00:00,000 --> 00:00:02,500
        Hello world
    """

    @property
    def name(self) -> str:
        """
        Formatter name used to identify the SRT output format.
        
        Returns:
            `"srt"` — the formatter name for the SubRip (SRT) format.
        """
        return "srt"

    @property
    def file_extension(self) -> str:
        """
        File extension for SRT output.
        
        Returns:
            file_extension (str): The file extension without a leading dot (`"srt"`).
        """
        return "srt"

    @property
    def content_type(self) -> str:
        """
        Provide the MIME content type for SubRip (SRT) subtitle files.
        
        Returns:
            The MIME type "application/x-subrip".
        """
        return "application/x-subrip"

    def format(self, segments: Sequence[SegmentData]) -> str:
        """
        Format a sequence of subtitle segments into SubRip (SRT) file content.
        
        Parameters:
        	segments (Sequence[SegmentData]): Ordered sequence of subtitle segments; each segment must provide `start`, `end`, and `text` attributes.
        
        Returns:
        	srt (str): A single string containing SRT-formatted subtitles where each block has a 1-based index line, a `start --> end` timestamp line, the segment text, and a blank line separator.
        """
        lines: list[str] = []

        for index, segment in enumerate(segments, start=1):
            start = format_timestamp_srt(segment.start)
            end = format_timestamp_srt(segment.end)
            lines.append(str(index))
            lines.append(f"{start} --> {end}")
            lines.append(segment.text.strip())
            lines.append("")

        return "\n".join(lines)