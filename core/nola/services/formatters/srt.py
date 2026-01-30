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
        return "srt"

    @property
    def file_extension(self) -> str:
        return "srt"

    @property
    def content_type(self) -> str:
        return "application/x-subrip"

    def format(self, segments: Sequence[SegmentData]) -> str:
        lines: list[str] = []

        for index, segment in enumerate(segments, start=1):
            start = format_timestamp_srt(segment.start)
            end = format_timestamp_srt(segment.end)
            lines.append(str(index))
            lines.append(f"{start} --> {end}")
            lines.append(segment.text.strip())
            lines.append("")

        return "\n".join(lines)
