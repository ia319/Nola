"""Shared helpers for task export use-cases."""

from nola.config.export import get_effective_defaults as get_effective_export_defaults
from nola.models import AppConfigDatabase
from nola.services.formatters import ExportFormat


def resolve_export_options(
    *,
    config_store: AppConfigDatabase,
    requested_format: ExportFormat | None,
    requested_include_timestamps: bool | None,
) -> tuple[ExportFormat, bool]:
    """Resolve effective export format and timestamp mode."""
    defaults = get_effective_export_defaults(config_store)
    default_format = ExportFormat(defaults["format"])
    default_include_timestamps = defaults["include_timestamps"]

    effective_format = requested_format or default_format
    effective_include_timestamps = (
        requested_include_timestamps
        if requested_include_timestamps is not None
        else default_include_timestamps
    )

    return effective_format, effective_include_timestamps
