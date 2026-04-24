"""Session-level default configuration helpers."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Protocol, TypedDict, TypeVar, cast

from nola.config import settings
from nola.config.common.types import ConfigMap
from nola.engines.base import (
    ALLOWED_ENGINE_COMPUTE_TYPES,
    ALLOWED_ENGINE_DEVICES,
    EngineComputeType,
    EngineDevice,
)
from nola.model_hub import get_model

MODEL_CONFIG_PREFIX = "model."
EXECUTION_CONFIG_PREFIX = "execution."
_MODEL_ID_KEY = "configured_model_id"
_DEVICE_KEY = "device"
_COMPUTE_TYPE_KEY = "compute_type"
_FALLBACK_DEVICE: EngineDevice = "cpu"
_FALLBACK_COMPUTE_TYPE: EngineComputeType = "default"
_EngineOptionValue = TypeVar(
    "_EngineOptionValue",
    EngineDevice,
    EngineComputeType,
)


class SupportsSessionDefaultsRead(Protocol):
    """Expose config reads required by session defaults."""

    def get_all(self, prefix: str) -> ConfigMap:
        """Return all config values matching the provided prefix."""


class SupportsSessionDefaultsWrite(Protocol):
    """Expose config writes required by session defaults."""

    def patch_many_prefixes(
        self,
        patches_by_prefix: Mapping[str, ConfigMap],
    ) -> list[str]:
        """Patch config values across prefixes in one transaction."""


class SessionExecutionDefaultsPatch(TypedDict, total=False):
    """Partial update payload for execution defaults."""

    model_id: str | None
    device: str | None
    compute_type: str | None


@dataclass(frozen=True, slots=True)
class SessionExecutionDefaults:
    """Represent resolved execution defaults for new tasks."""

    model_id: str
    device: EngineDevice
    compute_type: EngineComputeType


@dataclass(frozen=True, slots=True)
class SessionDefaults:
    """Represent resolved session defaults for Workbench flows."""

    execution: SessionExecutionDefaults
    transcription: ConfigMap


def _canonicalize_model_id(raw_model_id: str) -> str:
    model = get_model(raw_model_id)
    return model.model_id if model is not None else raw_model_id


def _resolve_model_id(configured_model_id: object) -> str:
    if isinstance(configured_model_id, str):
        model = get_model(configured_model_id)
        if model is not None:
            return model.model_id
    return _canonicalize_model_id(settings.model_size)


def _resolve_engine_option_value(
    *,
    configured_value: object,
    settings_value: str,
    fallback_value: _EngineOptionValue,
    allowed_values: Sequence[_EngineOptionValue],
) -> _EngineOptionValue:
    if isinstance(configured_value, str) and configured_value in allowed_values:
        return cast(_EngineOptionValue, configured_value)
    if settings_value in allowed_values:
        return cast(_EngineOptionValue, settings_value)
    return fallback_value


def get_session_execution_defaults(
    config_db: SupportsSessionDefaultsRead,
) -> SessionExecutionDefaults:
    """Return execution defaults resolved against settings fallbacks."""
    model_config = config_db.get_all(MODEL_CONFIG_PREFIX)
    execution_config = config_db.get_all(EXECUTION_CONFIG_PREFIX)

    return SessionExecutionDefaults(
        model_id=_resolve_model_id(model_config.get(_MODEL_ID_KEY)),
        device=_resolve_engine_option_value(
            configured_value=execution_config.get(_DEVICE_KEY),
            settings_value=settings.device,
            fallback_value=_FALLBACK_DEVICE,
            allowed_values=ALLOWED_ENGINE_DEVICES,
        ),
        compute_type=_resolve_engine_option_value(
            configured_value=execution_config.get(_COMPUTE_TYPE_KEY),
            settings_value=settings.compute_type,
            fallback_value=_FALLBACK_COMPUTE_TYPE,
            allowed_values=ALLOWED_ENGINE_COMPUTE_TYPES,
        ),
    )


def get_session_defaults(config_db: SupportsSessionDefaultsRead) -> SessionDefaults:
    """Return execution and transcription defaults for session creation."""
    from nola.config.transcription.defaults import get_effective_defaults

    return SessionDefaults(
        execution=get_session_execution_defaults(config_db),
        transcription=get_effective_defaults(config_db),
    )


def _require_model_id(raw_model_id: str) -> str:
    model = get_model(raw_model_id)
    if model is None:
        raise ValueError(f"Unknown model id: {raw_model_id}")
    return model.model_id


def _require_engine_option_value(
    raw_value: str | None,
    *,
    allowed_values: Sequence[_EngineOptionValue],
    field_name: str,
) -> _EngineOptionValue | None:
    if raw_value is None:
        return None
    if raw_value in allowed_values:
        return cast(_EngineOptionValue, raw_value)
    raise ValueError(f"Invalid session execution {field_name}: {raw_value}")


def patch_session_execution_defaults(
    config_db: SupportsSessionDefaultsWrite,
    patch_values: SessionExecutionDefaultsPatch,
) -> None:
    """Apply partial execution-default updates with explicit-null resets."""
    model_patch: ConfigMap = {}
    execution_patch: ConfigMap = {}

    if "model_id" in patch_values:
        model_id = patch_values["model_id"]
        model_patch[_MODEL_ID_KEY] = (
            None if model_id is None else _require_model_id(model_id)
        )

    if "device" in patch_values:
        execution_patch[_DEVICE_KEY] = _require_engine_option_value(
            patch_values["device"],
            allowed_values=ALLOWED_ENGINE_DEVICES,
            field_name=_DEVICE_KEY,
        )

    if "compute_type" in patch_values:
        execution_patch[_COMPUTE_TYPE_KEY] = _require_engine_option_value(
            patch_values["compute_type"],
            allowed_values=ALLOWED_ENGINE_COMPUTE_TYPES,
            field_name=_COMPUTE_TYPE_KEY,
        )

    patches_by_prefix: dict[str, ConfigMap] = {}
    if model_patch:
        patches_by_prefix[MODEL_CONFIG_PREFIX] = model_patch
    if execution_patch:
        patches_by_prefix[EXECUTION_CONFIG_PREFIX] = execution_patch
    if patches_by_prefix:
        config_db.patch_many_prefixes(patches_by_prefix)
