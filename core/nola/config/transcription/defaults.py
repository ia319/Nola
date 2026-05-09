"""Transcription default-value helpers."""

from __future__ import annotations

from typing import Protocol

from nola.common.merge import deep_merge
from nola.config.common.types import ConfigMap
from nola.engines.faster_whisper_defaults import (
    SerializedDefaultValue,
    build_faster_whisper_defaults,
    serialize_faster_whisper_default,
)


class SupportsConfigRead(Protocol):
    """Represent the config-store contract used by defaults merging."""

    def get_all(self, prefix: str) -> ConfigMap:
        """Return all config values matching the provided prefix."""


def _build_engine_defaults() -> ConfigMap:
    """Build raw non-batched WhisperModel defaults with expanded VAD options."""
    return build_faster_whisper_defaults()


def get_engine_defaults() -> dict[str, SerializedDefaultValue]:
    """Return non-batched WhisperModel defaults with expanded VAD options."""
    serialized = serialize_faster_whisper_default(_build_engine_defaults())
    if not isinstance(serialized, dict):
        raise TypeError("Serialized engine defaults must be a dictionary")
    return serialized


def get_effective_defaults(
    config_db: SupportsConfigRead,
) -> dict[str, SerializedDefaultValue]:
    """Return engine defaults merged with persisted application overrides."""
    engine_defaults = _build_engine_defaults()
    app_defaults = config_db.get_all("transcription.")
    merged = deep_merge(engine_defaults, app_defaults)
    serialized = serialize_faster_whisper_default(merged)
    if not isinstance(serialized, dict):
        raise TypeError("Serialized effective defaults must be a dictionary")
    return serialized
