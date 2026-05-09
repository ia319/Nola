"""Resolve immutable task runtime configuration snapshots."""

from __future__ import annotations

from dataclasses import asdict, fields
from typing import Any, Protocol, cast

from nola.application.tasks.types import (
    ResolvedTaskExecutionConfig,
    TaskOptions,
    TaskRuntimeConfig,
)
from nola.common.merge import deep_merge
from nola.common.types import JsonValue
from nola.config.common.types import ConfigMap
from nola.engines.base import TranscribeOptions
from nola.engines.faster_whisper_defaults import serialize_faster_whisper_default

TASK_RUNTIME_CONFIG_SCHEMA_VERSION = 1
_TRANSCRIBE_OPTION_FIELDS = frozenset(field.name for field in fields(TranscribeOptions))


class SupportsTranscriptionConfigRead(Protocol):
    """Expose persisted transcription defaults for task config resolution."""

    def get_all(self, prefix: str) -> ConfigMap:
        """Return all config values matching the provided prefix."""
        ...


def _filter_valid_options(raw_options: TaskOptions | ConfigMap | None) -> ConfigMap:
    """Discard keys that are not part of TranscribeOptions."""
    if not raw_options:
        return {}
    return {
        key: cast(JsonValue, value)
        for key, value in raw_options.items()
        if key in _TRANSCRIBE_OPTION_FIELDS
    }


def _deserialize_special_values(value: Any, *, key: str | None = None) -> Any:
    """Convert API sentinel values back to runtime types.

    Symmetric counterpart to ``_serialize_special_values`` in defaults.py,
    including recursive list/tuple handling. The ``"inf"`` sentinel is only
    converted for known numeric fields to avoid mutating user text values.
    The API writes ``"inf"`` today, and accepts both signs defensively.
    """
    if isinstance(value, dict):
        return {
            child_key: _deserialize_special_values(child_value, key=child_key)
            for child_key, child_value in value.items()
        }
    if isinstance(value, list):
        return [_deserialize_special_values(item, key=key) for item in value]
    if isinstance(value, tuple):
        return [_deserialize_special_values(item, key=key) for item in value]
    if (
        key == "max_speech_duration_s"
        and isinstance(value, str)
        and value in {"inf", "-inf"}
    ):
        return float(value)
    return value


def _serialize_config_map(values: ConfigMap) -> ConfigMap:
    """Return an API-safe JSON object for runtime snapshot storage."""
    serialized = serialize_faster_whisper_default(values)
    if not isinstance(serialized, dict):
        raise TypeError("Serialized task runtime config must be a dictionary")
    return serialized


def resolve_task_transcribe_options(
    task_options: TaskOptions | None,
    config_store: SupportsTranscriptionConfigRead | None = None,
) -> TranscribeOptions:
    """Resolve TranscribeOptions from built-ins, persisted defaults, and overrides."""
    # Plain deep_merge is intentional here: None values in engine defaults
    # (e.g. initial_prompt=None) are real defaults, not "remove override"
    # instructions. The null-removes-key semantics only apply to the PATCH
    # endpoint in config routes.
    merged_options: ConfigMap = asdict(TranscribeOptions())

    if config_store is not None:
        app_defaults = _filter_valid_options(config_store.get_all("transcription."))
        merged_options = deep_merge(merged_options, app_defaults)

    task_overrides = _filter_valid_options(task_options)
    if task_overrides:
        merged_options = deep_merge(merged_options, task_overrides)

    # Convert API sentinel values (e.g. "inf") back to runtime types
    # before constructing the dataclass.
    runtime_values = _deserialize_special_values(merged_options)
    return TranscribeOptions(**runtime_values)


def build_task_runtime_config(
    *,
    request_options: TaskOptions | None,
    execution_config: ResolvedTaskExecutionConfig,
    config_store: SupportsTranscriptionConfigRead,
) -> TaskRuntimeConfig:
    """Build the task runtime snapshot fixed at task creation time."""
    resolved_options = resolve_task_transcribe_options(request_options, config_store)
    filtered_request_options = _filter_valid_options(request_options)

    return {
        "schema_version": TASK_RUNTIME_CONFIG_SCHEMA_VERSION,
        "model_id": execution_config["model_id"],
        "engine_device": execution_config["engine_device"],
        "engine_compute_type": execution_config["engine_compute_type"],
        "transcription_options": _serialize_config_map(
            cast(ConfigMap, asdict(resolved_options))
        ),
        "request_options": (
            _serialize_config_map(filtered_request_options)
            if filtered_request_options
            else None
        ),
    }


def transcribe_options_from_runtime_config(
    runtime_config: TaskRuntimeConfig,
) -> TranscribeOptions:
    """Return TranscribeOptions from a stored task runtime snapshot."""
    schema_version = runtime_config.get("schema_version")
    if schema_version != TASK_RUNTIME_CONFIG_SCHEMA_VERSION:
        raise ValueError(f"Unsupported task runtime config schema: {schema_version}")

    raw_options = runtime_config.get("transcription_options")
    if not isinstance(raw_options, dict):
        raise ValueError("Task runtime config is missing transcription_options")

    filtered_options = _filter_valid_options(raw_options)
    # Convert API sentinel values (e.g. "inf") back to runtime types
    # before constructing the dataclass.
    runtime_values = _deserialize_special_values(filtered_options)
    return TranscribeOptions(**runtime_values)
