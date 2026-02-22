"""Reusable validation functions for API schemas.

Separate validation logic from schema definitions to enable
independent testing and cross-schema reuse (e.g., future CLI).

Each validator:
- Accepts and returns None unchanged (None means "use engine default")
- Raises ValueError with user-friendly messages on invalid input
- Contains no Pydantic-specific code
"""

from __future__ import annotations

from nola.config.constants import SUPPORTED_LANGUAGES


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
