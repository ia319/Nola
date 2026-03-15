"""Transcription default-value helpers."""

from __future__ import annotations

from dataclasses import asdict
from math import isinf
from typing import Any, Protocol, TypeAlias, cast

from faster_whisper.vad import VadOptions

from nola.common.merge import deep_merge
from nola.engines.base import TranscribeOptions

SerializedDefaultValue: TypeAlias = (
    str
    | int
    | float
    | bool
    | None
    | list["SerializedDefaultValue"]
    | dict[str, "SerializedDefaultValue"]
)


class SupportsConfigRead(Protocol):
    """Represent the config-store contract used by defaults merging."""

    def get_all(self, prefix: str) -> dict[str, Any]:
        """Return all config values matching the provided prefix."""


def _serialize_special_values(value: object) -> SerializedDefaultValue:
    """Convert non-JSON engine defaults into API-safe values."""
    if isinstance(value, float) and isinf(value):
        return "inf"
    if isinstance(value, dict):
        return {key: _serialize_special_values(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_serialize_special_values(item) for item in value]
    if isinstance(value, tuple):
        return [_serialize_special_values(item) for item in value]
    return cast(SerializedDefaultValue, value)


def _build_engine_defaults() -> dict[str, Any]:
    """Build raw non-batched WhisperModel defaults with expanded VAD options."""
    defaults = asdict(TranscribeOptions())
    defaults["vad_parameters"] = asdict(VadOptions())
    return defaults


def get_engine_defaults() -> dict[str, SerializedDefaultValue]:
    """Return non-batched WhisperModel defaults with expanded VAD options."""
    serialized = _serialize_special_values(_build_engine_defaults())
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
    serialized = _serialize_special_values(merged)
    if not isinstance(serialized, dict):
        raise TypeError("Serialized effective defaults must be a dictionary")
    return serialized
