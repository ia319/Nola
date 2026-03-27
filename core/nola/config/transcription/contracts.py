"""Shared transcription contracts consumed by API and UI layers."""

from __future__ import annotations

from dataclasses import fields as dataclass_fields
from functools import lru_cache

from faster_whisper.vad import VadOptions

# Keep task values explicit as an API-level contract.
# UI metadata should mirror this list, not define it.
_TRANSCRIPTION_TASK_VALUES: tuple[str, ...] = ("transcribe", "translate")


@lru_cache(maxsize=1)
def get_allowed_task_values() -> frozenset[str]:
    """Return allowed transcription task values."""
    return frozenset(_TRANSCRIPTION_TASK_VALUES)


@lru_cache(maxsize=1)
def get_allowed_vad_parameter_keys() -> frozenset[str]:
    """Return nested VAD keys supported by the installed faster-whisper build."""
    return frozenset(field.name for field in dataclass_fields(VadOptions))
