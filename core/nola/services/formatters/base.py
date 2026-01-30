"""Define abstract base class for output formatters."""

from abc import ABC, abstractmethod
from collections.abc import Sequence
from dataclasses import dataclass


@dataclass
class SegmentData:
    """Represent a transcription segment for formatting.

    This is a format-agnostic data structure decoupled from engine internals.
    """

    start: float
    end: float
    text: str


class OutputFormatter(ABC):
    """Abstract base class for output formatters.

    Implement this interface to add new export formats.
    Each formatter handles one specific output format (SRT, VTT, etc.).
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """Return format name (e.g., 'srt', 'vtt')."""
        ...

    @property
    @abstractmethod
    def file_extension(self) -> str:
        """Return file extension without dot (e.g., 'srt')."""
        ...

    @property
    @abstractmethod
    def content_type(self) -> str:
        """Return MIME content type for HTTP response."""
        ...

    @abstractmethod
    def format(self, segments: Sequence[SegmentData]) -> str:
        """Format segments into output string.

        Args:
            segments: Sequence of transcription segments.

        Returns:
            Formatted string ready for file output.
        """
        ...


def format_timestamp_srt(seconds: float) -> str:
    """Format seconds to SRT timestamp (HH:MM:SS,mmm).

    Args:
        seconds: Time in seconds.

    Returns:
        Formatted timestamp string.
    """
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds % 1) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


def format_timestamp_vtt(seconds: float) -> str:
    """Format seconds to VTT timestamp (HH:MM:SS.mmm).

    Args:
        seconds: Time in seconds.

    Returns:
        Formatted timestamp string.
    """
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds % 1) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d}.{millis:03d}"


def format_timestamp_ass(seconds: float) -> str:
    """Format seconds to ASS timestamp (H:MM:SS.cc).

    Args:
        seconds: Time in seconds.

    Returns:
        Formatted timestamp string with centiseconds.
    """
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    centis = int((seconds % 1) * 100)
    return f"{hours}:{minutes:02d}:{secs:02d}.{centis:02d}"
