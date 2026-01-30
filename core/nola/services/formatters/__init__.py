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
    """Create formatter instance by format name.

    Args:
        format_name: Format identifier (srt, vtt, txt, ass).
        include_timestamps: TXT-only option for timestamp prefix.

    Raises:
        ValueError: If format is not supported.
    """
    formatter_class = FORMATTERS.get(format_name.lower())
    if formatter_class is None:
        supported = ", ".join(FORMATTERS.keys())
        raise ValueError(f"Unsupported format: {format_name}. Supported: {supported}")

    if format_name.lower() == "txt":
        return TXTFormatter(include_timestamps=include_timestamps)

    return formatter_class()


def list_formats() -> list[str]:
    """Return list of supported format names."""
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
