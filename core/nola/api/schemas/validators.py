"""Reusable validation functions for API schemas.

Separate validation logic from schema definitions to enable
independent testing and cross-schema reuse (e.g., future CLI).

Each validator:
- Accepts and returns None unchanged (None means "use engine default")
- Raises ValueError with user-friendly messages on invalid input
- Contains no Pydantic-specific code
"""

from __future__ import annotations

from functools import lru_cache

from nola.config.constants import SUPPORTED_LANGUAGES
from nola.config.transcription.contracts import (
    get_allowed_task_values,
    get_allowed_vad_parameter_keys,
)


def validate_language_code(code: str | None) -> str | None:
    """
    Args:
        code: Language code string, or None for auto-detect.

    Returns:
        The validated code, or None.

    Raises:
        ValueError: If code is not a recognized Whisper language.
    """
    if code is None:
        return None
    normalized_code = code.lower()
    if normalized_code not in SUPPORTED_LANGUAGES:
        raise ValueError(
            f"Unsupported language: '{code}'. "
            f"Use ISO 639-1 codes (e.g., 'en', 'zh', 'ja')."
        )
    return normalized_code


def validate_temperature(
    value: float | list[float] | None,
) -> float | list[float] | None:
    """Validate temperature is non-negative.

    Temperature is a softmax scaling factor; negative values are
    mathematically invalid. No upper bound is enforced because
    Whisper does not define one.

    Args:
        value: Temperature scalar, list of fallback temperatures, or None.

    Returns:
        The validated value, or None.

    Raises:
        ValueError: If any temperature is negative.
    """
    if value is None:
        return None

    if isinstance(value, list):
        for i, t in enumerate(value):
            if t < 0:
                raise ValueError(f"temperature[{i}] must be non-negative, got {t}.")
    elif value < 0:
        raise ValueError(f"Temperature must be non-negative, got {value}.")

    return value


@lru_cache(maxsize=1)
def _allowed_task_values() -> frozenset[str]:
    """Read supported task values from shared transcription contracts."""
    return get_allowed_task_values()


def validate_task_value(value: str | None) -> str | None:
    """Validate task values against the runtime task option list."""
    if value is None:
        return None

    normalized_value = value.lower()
    if normalized_value not in _allowed_task_values():
        raise ValueError(
            f"Unsupported task: '{value}'. "
            f"Use one of: {', '.join(sorted(_allowed_task_values()))}."
        )
    return normalized_value


@lru_cache(maxsize=1)
def _allowed_vad_parameter_keys() -> frozenset[str]:
    """Read supported nested VAD keys from shared transcription contracts."""
    return get_allowed_vad_parameter_keys()


def validate_vad_parameter_keys(
    value: dict[str, object] | None,
) -> dict[str, object] | None:
    """Reject unsupported nested keys in vad_parameters."""
    if value is None:
        return None

    invalid_keys = sorted(set(value) - _allowed_vad_parameter_keys())
    if invalid_keys:
        invalid_list = ", ".join(invalid_keys)
        raise ValueError(f"Unsupported vad_parameters key(s): {invalid_list}")

    return value
