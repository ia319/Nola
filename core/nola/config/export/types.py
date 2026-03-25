"""Shared export-domain types."""

from enum import Enum


class ExportFormat(str, Enum):
    """Supported export format identifiers."""

    SRT = "srt"
    VTT = "vtt"
    TXT = "txt"
    ASS = "ass"
