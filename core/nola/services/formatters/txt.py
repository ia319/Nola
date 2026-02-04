"""TXT (Plain Text) formatter."""

from collections.abc import Sequence

from nola.services.formatters.base import OutputFormatter, SegmentData


class TXTFormatter(OutputFormatter):
    """Plain text formatter with optional timestamp prefix.

    Output format:
        With timestamps:    [00:00:00] Hello world
        Without timestamps: Hello world
    """

    def __init__(self, include_timestamps: bool = True) -> None:
        self._include_timestamps = include_timestamps

    @property
    def name(self) -> str:
        return "txt"

    @property
    def file_extension(self) -> str:
        return "txt"

    @property
    def content_type(self) -> str:
        return "text/plain; charset=utf-8"

    def format(self, segments: Sequence[SegmentData]) -> str:
        lines: list[str] = []

        for segment in segments:
            text = segment.text.strip()
            if self._include_timestamps:
                timestamp = self._format_simple_timestamp(segment.start)
                lines.append(f"[{timestamp}] {text}")
            else:
                lines.append(text)

        return "\n".join(lines)

    @staticmethod
    def _format_simple_timestamp(seconds: float) -> str:
        """HH:MM:SS format without milliseconds for readability."""
        if seconds < 0:
            seconds = 0.0
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"
