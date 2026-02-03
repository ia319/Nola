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
        """
        Unique identifier of the output format used in API requests.
        
        @return:
            The format identifier string (for example, "srt" or "vtt") used by clients to select this formatter.
        """
        ...

    @property
    @abstractmethod
    def file_extension(self) -> str:
        """
        Identifier for the formatter's file extension without a leading dot.
        
        Returns:
            str: The file extension (e.g., "srt", "vtt") without a leading period.
        """
        ...

    @property
    @abstractmethod
    def content_type(self) -> str:
        """
        MIME type used for the formatter's HTTP Content-Type header.
        
        Returns:
            str: The MIME type string for this formatter (for example, "text/vtt" or "application/x-subrip").
        """
        ...

    @abstractmethod
    def format(self, segments: Sequence[SegmentData]) -> str:
        """
        Serialize a sequence of SegmentData into this formatter's output representation.
        
        Parameters:
            segments (Sequence[SegmentData]): Ordered transcription segments to be converted.
        
        Returns:
            formatted (str): The complete formatted output for the provided segments.
        """
        ...


def _decompose_seconds(seconds: float) -> tuple[int, int, int, float]:
    """
    Convert a time value in seconds into hours, minutes, seconds, and the fractional part.
    
    Negative input is treated as 0.0.
    
    Parameters:
        seconds (float): Time in seconds.
    
    Returns:
        tuple[int, int, int, float]: A 4-tuple (hours, minutes, seconds, fraction) where
            - hours: total whole hours,
            - minutes: whole minutes in the current hour (0–59),
            - seconds: whole seconds in the current minute (0–59),
            - fraction: fractional part of the second in [0.0, 1.0).
    """
    if seconds < 0:
        seconds = 0.0
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    frac = seconds % 1
    return hours, minutes, secs, frac


def format_timestamp_srt(seconds: float) -> str:
    """
    Format a time offset in seconds as an SRT timestamp (HH:MM:SS,mmm).
    
    Parameters:
        seconds (float): Time offset in seconds; negative values are treated as 0.0.
    
    Returns:
        str: Timestamp string in SRT format, e.g. "00:01:23,456".
    """
    hours, minutes, secs, frac = _decompose_seconds(seconds)
    millis = int(frac * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


def format_timestamp_vtt(seconds: float) -> str:
    """
    Format a time in seconds as a WebVTT timestamp.
    
    This produces a timestamp in the form HH:MM:SS.mmm where hours, minutes,
    and seconds are zero-padded to two digits and milliseconds are zero-padded
    to three digits. Negative input values are treated as 0.0.
    
    Parameters:
        seconds (float): Time in seconds to format; values less than 0 are clamped to 0.
    
    Returns:
        str: The formatted VTT timestamp (e.g., "00:01:23.045").
    """
    hours, minutes, secs, frac = _decompose_seconds(seconds)
    millis = int(frac * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d}.{millis:03d}"


def format_timestamp_ass(seconds: float) -> str:
    """
    Format a time value in seconds into an ASS timestamp (H:MM:SS.cc).
    
    Negative input is treated as 0. The output uses hours without a leading zero, two-digit minutes and seconds, and two-digit centiseconds.
    
    Parameters:
        seconds (float): Time value in seconds.
    
    Returns:
        str: ASS-formatted timestamp, e.g. "0:01:23.45".
    """
    hours, minutes, secs, frac = _decompose_seconds(seconds)
    centis = int(frac * 100)
    return f"{hours}:{minutes:02d}:{secs:02d}.{centis:02d}"