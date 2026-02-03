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
        """
        Human-readable identifier for this formatter.
        
        Returns:
            str: The short name "vtt" identifying the WebVTT formatter.
        """
        return "vtt"

    @property
    def file_extension(self) -> str:
        """
        File extension for WebVTT output.
        
        Returns:
            "vtt" — the file extension used for WebVTT files (without a leading period).
        """
        return "vtt"

    @property
    def content_type(self) -> str:
        """
        MIME type for WebVTT subtitle files.
        
        Returns:
            str: The MIME type "text/vtt".
        """
        return "text/vtt"

    def format(self, segments: Sequence[SegmentData]) -> str:
        """
        Format a sequence of SegmentData objects into a WebVTT document.
        
        Parameters:
            segments (Sequence[SegmentData]): Ordered segments to convert into WebVTT cue blocks. Each segment's start and end timestamps are formatted with `format_timestamp_vtt` and its text becomes the cue payload.
        
        Returns:
            vtt_text (str): A WebVTT-formatted string beginning with the "WEBVTT" header and containing one cue per segment.
        """
        lines: list[str] = ["WEBVTT", ""]

        for segment in segments:
            start = format_timestamp_vtt(segment.start)
            end = format_timestamp_vtt(segment.end)
            lines.append(f"{start} --> {end}")
            lines.append(segment.text.strip())
            lines.append("")

        return "\n".join(lines)