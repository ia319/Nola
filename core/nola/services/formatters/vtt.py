"""VTT (WebVTT) subtitle formatter."""

from collections.abc import Sequence

from nola.services.formatters.base import (
    OutputFormatter,
    SegmentData,
    format_timestamp_vtt,
)


class VTTFormatter(OutputFormatter):
    """WebVTT subtitle formatter.

    Output format:
        WEBVTT

        00:00:00.000 --> 00:00:02.500
        Hello world
    """

    @property
    def name(self) -> str:
        return "vtt"

    @property
    def file_extension(self) -> str:
        return "vtt"

    @property
    def content_type(self) -> str:
        return "text/vtt"

    def format(self, segments: Sequence[SegmentData]) -> str:
        lines: list[str] = ["WEBVTT", ""]

        for segment in segments:
            start = format_timestamp_vtt(segment.start)
            end = format_timestamp_vtt(segment.end)
            lines.append(f"{start} --> {end}")
            lines.append(segment.text.strip())
            lines.append("")

        return "\n".join(lines)
