"""Normalize model and engine config values."""

from __future__ import annotations

from typing import TypeVar, cast

from nola.engines.base import (
    ALLOWED_ENGINE_COMPUTE_TYPES,
    ALLOWED_ENGINE_DEVICES,
    EngineComputeType,
    EngineDevice,
)
from nola.model_hub import get_model

_EngineOptionValue = TypeVar(
    "_EngineOptionValue",
    EngineDevice,
    EngineComputeType,
)


def canonicalize_model_id(raw_model_id: str) -> str:
    """Resolve one alias to its canonical model id when known."""
    model = get_model(raw_model_id)
    return model.model_id if model is not None else raw_model_id


def canonicalize_optional_model_id(raw_model_id: object) -> str | None:
    """Resolve one optional model-id value to a canonical id when possible."""
    return (
        canonicalize_model_id(raw_model_id) if isinstance(raw_model_id, str) else None
    )


def _canonicalize_optional_engine_option(
    raw_value: object,
    allowed_values: tuple[_EngineOptionValue, ...],
) -> _EngineOptionValue | None:
    if raw_value in allowed_values:
        return cast(_EngineOptionValue, raw_value)
    return None


def canonicalize_optional_engine_device(raw_value: object) -> EngineDevice | None:
    """Return a supported engine device value when present."""
    return _canonicalize_optional_engine_option(raw_value, ALLOWED_ENGINE_DEVICES)


def canonicalize_optional_engine_compute_type(
    raw_value: object,
) -> EngineComputeType | None:
    """Return a supported engine compute type value when present."""
    return _canonicalize_optional_engine_option(raw_value, ALLOWED_ENGINE_COMPUTE_TYPES)
