"""Export default-value helpers."""

from __future__ import annotations

from typing import Protocol, TypedDict

from nola.config.common.types import ConfigMap
from nola.services.formatters import ExportFormat

EXPORT_CONFIG_PREFIX = "export."


class SupportsConfigRead(Protocol):
    """Represent the config-store contract used by defaults resolution."""

    def get_all(self, prefix: str) -> ConfigMap:
        """Return all config values matching the provided prefix."""


class ExportDefaults(TypedDict):
    """Normalized export defaults that the API exposes to frontend clients."""

    format: str
    include_timestamps: bool


def get_engine_defaults() -> ExportDefaults:
    """Return built-in export defaults used when no override exists."""
    return {
        "format": ExportFormat.SRT.value,
        "include_timestamps": True,
    }


def get_effective_defaults(config_db: SupportsConfigRead) -> ExportDefaults:
    """Return built-in defaults merged with persisted application overrides.

    Invalid persisted values are ignored so a corrupted config row cannot break
    config endpoints.
    """
    defaults = get_engine_defaults()
    overrides = config_db.get_all(EXPORT_CONFIG_PREFIX)

    raw_format = overrides.get("format")
    if isinstance(raw_format, str):
        try:
            defaults["format"] = ExportFormat(raw_format).value
        except ValueError:
            pass

    raw_include_timestamps = overrides.get("include_timestamps")
    if isinstance(raw_include_timestamps, bool):
        defaults["include_timestamps"] = raw_include_timestamps

    return defaults
