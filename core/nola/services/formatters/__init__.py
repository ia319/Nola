"""Output formatters for exporting transcription results."""

from nola.config.export.types import ExportFormat
from nola.services.formatters.ass import ASSFormatter
from nola.services.formatters.base import OutputFormatter, SegmentData
from nola.services.formatters.srt import SRTFormatter
from nola.services.formatters.txt import TXTFormatter
from nola.services.formatters.vtt import VTTFormatter

# Static registry - extend by adding new formatter classes here.
FORMATTERS: dict[ExportFormat, type[OutputFormatter]] = {
    ExportFormat.SRT: SRTFormatter,
    ExportFormat.VTT: VTTFormatter,
    ExportFormat.TXT: TXTFormatter,
    ExportFormat.ASS: ASSFormatter,
}


def _coerce_export_format(format_name: str | ExportFormat) -> ExportFormat:
    """Normalize string/enum input into ExportFormat."""
    if isinstance(format_name, ExportFormat):
        return format_name

    try:
        return ExportFormat(format_name.lower())
    except ValueError as exc:
        supported = ", ".join(fmt.value for fmt in ExportFormat)
        raise ValueError(
            f"Unsupported format: {format_name}. Supported: {supported}"
        ) from exc


def get_formatter(
    format_name: str | ExportFormat,
    *,
    include_timestamps: bool = True,
) -> OutputFormatter:
    """Create formatter instance by format name.

    Args:
        format_name: Format identifier (srt, vtt, txt, ass).
        include_timestamps: TXT-only option for timestamp prefix.
    """
    export_format = _coerce_export_format(format_name)
    formatter_class = FORMATTERS[export_format]

    if export_format == ExportFormat.TXT:
        return TXTFormatter(include_timestamps=include_timestamps)

    return formatter_class()


def list_formats() -> list[str]:
    """Return list of supported format names."""
    return [fmt.value for fmt in ExportFormat]


def list_export_content_types() -> list[str]:
    """Return media types exposed by all configured export formatters."""
    content_types: list[str] = []
    for export_format in ExportFormat:
        formatter_class = FORMATTERS[export_format]
        media_type = formatter_class().content_type.split(";", maxsplit=1)[0].strip()
        if media_type not in content_types:
            content_types.append(media_type)
    return content_types


__all__ = [
    "ExportFormat",
    "OutputFormatter",
    "SegmentData",
    "SRTFormatter",
    "VTTFormatter",
    "TXTFormatter",
    "ASSFormatter",
    "FORMATTERS",
    "get_formatter",
    "list_formats",
    "list_export_content_types",
]
