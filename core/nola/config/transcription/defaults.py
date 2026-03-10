"""Transcription default-value helpers."""

from __future__ import annotations

from dataclasses import asdict
from math import isinf
from typing import Any, Protocol

from faster_whisper.vad import VadOptions

from nola.engines.base import TranscribeOptions


class SupportsConfigRead(Protocol):
    """Represent the config-store contract used by defaults merging."""

    def get_all(self, prefix: str) -> dict[str, Any]:
        """Return all config values matching the provided prefix."""


def _serialize_special_values(value: Any) -> Any:
    """Convert non-JSON engine defaults into API-safe values."""
    if isinstance(value, float) and isinf(value):
        return "inf"
    if isinstance(value, dict):
        return {key: _serialize_special_values(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_serialize_special_values(item) for item in value]
    if isinstance(value, tuple):
        return [_serialize_special_values(item) for item in value]
    return value


def _deep_merge(base: dict[str, Any], overrides: dict[str, Any]) -> dict[str, Any]:
    """Merge nested config overrides without discarding untouched subkeys."""
    result = dict(base)
    for key, value in overrides.items():
        current = result.get(key)
        if isinstance(current, dict) and isinstance(value, dict):
            result[key] = _deep_merge(current, value)
        else:
            result[key] = value
    return result


def _build_engine_defaults() -> dict[str, Any]:
    """Build raw non-batched WhisperModel defaults with expanded VAD options."""
    defaults = asdict(TranscribeOptions())
    defaults["vad_parameters"] = asdict(VadOptions())
    return defaults


def get_engine_defaults() -> dict[str, Any]:
    """Return non-batched WhisperModel defaults with expanded VAD options."""
    return _serialize_special_values(_build_engine_defaults())


def get_effective_defaults(config_db: SupportsConfigRead) -> dict[str, Any]:
    """Return engine defaults merged with persisted application overrides."""
    engine_defaults = _build_engine_defaults()
    app_defaults = config_db.get_all("transcription.")
    merged = _deep_merge(engine_defaults, app_defaults)
    return _serialize_special_values(merged)
