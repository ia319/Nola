"""Expose neutral faster-whisper default-value helpers."""

from __future__ import annotations

from dataclasses import asdict
from dataclasses import fields as dataclass_fields
from math import isinf, isnan
from typing import TypeAlias, cast

from faster_whisper.vad import VadOptions

from nola.config.common.types import ConfigMap
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

FASTER_WHISPER_TASK_VALUES: tuple[str, ...] = ("transcribe", "translate")


def serialize_faster_whisper_default(value: object) -> SerializedDefaultValue:
    """Convert non-JSON faster-whisper defaults into API-safe values."""
    if isinstance(value, float):
        if isinf(value):
            return "inf" if value > 0 else "-inf"
        if isnan(value):
            raise TypeError("faster-whisper defaults must not contain NaN")
    if isinstance(value, dict):
        return {
            key: serialize_faster_whisper_default(item) for key, item in value.items()
        }
    if isinstance(value, list):
        return [serialize_faster_whisper_default(item) for item in value]
    if isinstance(value, tuple):
        return [serialize_faster_whisper_default(item) for item in value]
    return cast(SerializedDefaultValue, value)


def build_faster_whisper_defaults() -> ConfigMap:
    """Build raw WhisperModel.transcribe defaults with expanded VAD options."""
    defaults = cast(ConfigMap, asdict(TranscribeOptions()))
    defaults["vad_parameters"] = cast(ConfigMap, asdict(VadOptions()))
    return defaults


def get_faster_whisper_defaults() -> dict[str, SerializedDefaultValue]:
    """Return API-safe WhisperModel.transcribe defaults with expanded VAD options."""
    serialized = serialize_faster_whisper_default(build_faster_whisper_defaults())
    if not isinstance(serialized, dict):
        raise TypeError("Serialized faster-whisper defaults must be a dictionary")
    return serialized


def get_faster_whisper_vad_default_keys() -> frozenset[str]:
    """Return nested VAD keys supported by the installed faster-whisper build."""
    return frozenset(field.name for field in dataclass_fields(VadOptions))


__all__ = [
    "build_faster_whisper_defaults",
    "FASTER_WHISPER_TASK_VALUES",
    "get_faster_whisper_defaults",
    "get_faster_whisper_vad_default_keys",
    "SerializedDefaultValue",
    "serialize_faster_whisper_default",
]
