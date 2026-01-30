"""Abstract base class and utilities for output formatters."""

from abc import ABC, abstractmethod
from collections.abc import Sequence
from dataclasses import dataclass


@dataclass
class SegmentData:
    """Format-agnostic transcription segment, decoupled from engine internals."""

    start: float
    end: float
    text: str


class OutputFormatter(ABC):
    """Abstract base class for output formatters.

    Subclass this to add new export formats.
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """Format identifier used in API requests."""
        ...

    @property
    @abstractmethod
    def file_extension(self) -> str:
        """File extension without leading dot."""
        ...

    @property
    @abstractmethod
    def content_type(self) -> str:
        """MIME type for HTTP Content-Type header."""
        ...

    @abstractmethod
    def format(self, segments: Sequence[SegmentData]) -> str:
        """Convert segments to formatted output string."""
        ...


def format_timestamp_srt(seconds: float) -> str:
    """Convert seconds to SRT format: HH:MM:SS,mmm (comma before milliseconds)."""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds % 1) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


def format_timestamp_vtt(seconds: float) -> str:
    """Convert seconds to VTT format: HH:MM:SS.mmm (dot before milliseconds)."""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds % 1) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d}.{millis:03d}"


def format_timestamp_ass(seconds: float) -> str:
    """Convert seconds to ASS format: H:MM:SS.cc (single-digit hour, centiseconds)."""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    centis = int((seconds % 1) * 100)
    return f"{hours}:{minutes:02d}:{secs:02d}.{centis:02d}"
