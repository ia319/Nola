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
        """
        Initialize the TXTFormatter and configure whether formatted lines include timestamps.
        
        Parameters:
            include_timestamps (bool): When True, prefix each formatted segment line with a timestamp in the form `[HH:MM:SS]`; when False, output lines without timestamps.
        """
        self._include_timestamps = include_timestamps

    @property
    def name(self) -> str:
        """
        Canonical name of this formatter.
        
        Returns:
            name (str): The string "txt" identifying the formatter.
        """
        return "txt"

    @property
    def file_extension(self) -> str:
        """
        The file extension used for formatted TXT outputs.
        
        Returns:
            str: The file extension `"txt"`.
        """
        return "txt"

    @property
    def content_type(self) -> str:
        """
        MIME content type used for plain text output.
        
        Returns:
            The MIME type string "text/plain; charset=utf-8".
        """
        return "text/plain; charset=utf-8"

    def format(self, segments: Sequence[SegmentData]) -> str:
        """
        Format a sequence of transcript segments into plain-text lines, optionally prefixed with simple HH:MM:SS timestamps.
        
        Parameters:
            segments (Sequence[SegmentData]): Sequence of segments whose `text` (trimmed) becomes one line each; when timestamps are enabled, each line is prefixed with `"[HH:MM:SS] "` using the segment's `start` time.
        
        Returns:
            str: The resulting plain-text content with one segment per line, joined by newline characters.
        """
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
        """
        Format a time given in seconds as an HH:MM:SS timestamp.
        
        Negative input values are treated as 0.0 before formatting.
        
        Parameters:
            seconds (float): Time in seconds to format. Negative values are clamped to 0.0.
        
        Returns:
            str: Timestamp string in the form "HH:MM:SS" with zero-padded two-digit fields.
        """
        if seconds < 0:
            seconds = 0.0
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"