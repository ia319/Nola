"""Output formatters for exporting transcription results."""

from nola.services.formatters.ass import ASSFormatter
from nola.services.formatters.base import OutputFormatter, SegmentData
from nola.services.formatters.srt import SRTFormatter
from nola.services.formatters.txt import TXTFormatter
from nola.services.formatters.vtt import VTTFormatter

# Static registry - extend by adding new formatter classes here
FORMATTERS: dict[str, type[OutputFormatter]] = {
    "srt": SRTFormatter,
    "vtt": VTTFormatter,
    "txt": TXTFormatter,
    "ass": ASSFormatter,
}


def get_formatter(
    format_name: str,
    *,
    include_timestamps: bool = True,
) -> OutputFormatter:
    """
    Return an OutputFormatter instance for the given format name.
    
    Parameters:
        format_name (str): Format identifier; supported values include "srt", "vtt", "txt", and "ass".
        include_timestamps (bool): When `format_name` is "txt", whether each text segment should be prefixed with timestamps.
    
    Returns:
        OutputFormatter: An instance of the formatter corresponding to `format_name`.
    
    Raises:
        ValueError: If `format_name` is not one of the supported formats.
    """
    formatter_class = FORMATTERS.get(format_name.lower())
    if formatter_class is None:
        supported = ", ".join(FORMATTERS.keys())
        raise ValueError(f"Unsupported format: {format_name}. Supported: {supported}")

    if format_name.lower() == "txt":
        return TXTFormatter(include_timestamps=include_timestamps)

    return formatter_class()


def list_formats() -> list[str]:
    """
    List available output formatter names.
    
    Returns:
        list[str]: Supported format identifiers (for example: "srt", "vtt", "txt", "ass").
    """
    return list(FORMATTERS.keys())


__all__ = [
    "OutputFormatter",
    "SegmentData",
    "SRTFormatter",
    "VTTFormatter",
    "TXTFormatter",
    "ASSFormatter",
    "FORMATTERS",
    "get_formatter",
    "list_formats",
]