"""Resolve task execution configuration at task creation time."""

from __future__ import annotations

from collections.abc import Callable, Sequence
from typing import Literal, TypeVar, cast

from nola.application.tasks.errors import TaskUseCaseError
from nola.application.tasks.types import (
    ResolvedTaskExecutionConfig,
    TaskExecutionConfigValues,
)
from nola.engines.base import ALLOWED_ENGINE_COMPUTE_TYPES, ALLOWED_ENGINE_DEVICES

TaskExecutionConfigField = Literal["model_id", "device", "compute_type"]
ModelIdResolver = Callable[[str], str | None]
_AllowedValue = TypeVar("_AllowedValue", bound=str)


_EMPTY_VALUES = TaskExecutionConfigValues()


def _pick_value(
    *,
    request: str | None,
    session_default: str | None,
    settings_default: str | None,
    field_name: TaskExecutionConfigField,
) -> str:
    for value in (request, session_default, settings_default):
        if value is not None:
            return value
    raise TaskUseCaseError(
        status_code=422,
        detail=f"Missing task execution {field_name}",
    )


def _format_allowed(values: Sequence[str]) -> str:
    return ", ".join(values)


def _require_allowed(
    *,
    value: str,
    field_name: TaskExecutionConfigField,
    allowed_values: Sequence[_AllowedValue],
) -> _AllowedValue:
    if value in allowed_values:
        return cast(_AllowedValue, value)
    raise TaskUseCaseError(
        status_code=422,
        detail=(
            f"Invalid task execution {field_name}: {value}. "
            f"Expected one of: {_format_allowed(allowed_values)}"
        ),
    )


def _resolve_model_id(raw_model_id: str, model_resolver: ModelIdResolver) -> str:
    resolved = model_resolver(raw_model_id)
    if resolved is None:
        raise TaskUseCaseError(
            status_code=422,
            detail=f"Invalid task execution model_id: {raw_model_id}",
        )

    if not resolved:
        raise TaskUseCaseError(
            status_code=422,
            detail=f"Invalid task execution model_id: {raw_model_id}",
        )
    return resolved


def resolve_task_execution_config(
    *,
    request: TaskExecutionConfigValues | None = None,
    session_defaults: TaskExecutionConfigValues | None = None,
    settings_defaults: TaskExecutionConfigValues,
    model_resolver: ModelIdResolver,
) -> ResolvedTaskExecutionConfig:
    """Resolve task execution values from request, session defaults, and settings."""
    request_values = request or _EMPTY_VALUES
    session_values = session_defaults or _EMPTY_VALUES

    raw_model_id = _pick_value(
        request=request_values.model_id,
        session_default=session_values.model_id,
        settings_default=settings_defaults.model_id,
        field_name="model_id",
    )
    raw_device = _pick_value(
        request=request_values.device,
        session_default=session_values.device,
        settings_default=settings_defaults.device,
        field_name="device",
    )
    raw_compute_type = _pick_value(
        request=request_values.compute_type,
        session_default=session_values.compute_type,
        settings_default=settings_defaults.compute_type,
        field_name="compute_type",
    )

    return {
        "model_id": _resolve_model_id(raw_model_id, model_resolver),
        "engine_device": _require_allowed(
            value=raw_device,
            field_name="device",
            allowed_values=ALLOWED_ENGINE_DEVICES,
        ),
        "engine_compute_type": _require_allowed(
            value=raw_compute_type,
            field_name="compute_type",
            allowed_values=ALLOWED_ENGINE_COMPUTE_TYPES,
        ),
    }
