"""Resolve immutable Live realtime runtime configuration snapshots."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, NoReturn, Protocol, TypeAlias, cast

from pydantic import ValidationError

from nola.application.live.errors import LiveUseCaseError
from nola.application.live.types import (
    LiveRealtimeRuntimeOverrides,
    LiveRuntimeConfig,
)
from nola.common.merge import deep_merge
from nola.common.types import JsonDict
from nola.config.common.types import ConfigMap
from nola.config.live_realtime import (
    LiveRealtimeAdapter,
    get_live_realtime_effective_defaults,
    resolve_live_realtime_defaults,
)
from nola.engines.base import (
    ALLOWED_ENGINE_COMPUTE_TYPES,
    ALLOWED_ENGINE_DEVICES,
    EngineComputeType,
    EngineConfig,
    EngineDevice,
)
from nola.model_hub import ModelInfo, UnknownModelError, require_model
from nola.model_hub.contracts import ModelCacheState

LIVE_RUNTIME_CONFIG_SCHEMA_VERSION = 1
LiveRealtimeAudioFormat: TypeAlias = Literal["pcm_s16le_16khz_mono"]
LIVE_REALTIME_AUDIO_FORMAT: LiveRealtimeAudioFormat = "pcm_s16le_16khz_mono"
_MODEL_CONFIG_PREFIX = "model."
_CONFIGURED_MODEL_ID_KEY = "configured_model_id"
_SUPPORTED_LIVE_REALTIME_ADAPTERS: tuple[LiveRealtimeAdapter, ...] = (
    "mock",
    "whisper_streaming",
)
_WHISPER_STREAMING_CONFIG_KEYS: tuple[str, ...] = (
    "min_chunk_ms",
    "buffer_trimming_ms",
    "prompt_max_chars",
    "timestamp_tolerance_ms",
    "max_duplicate_ngram",
)
_SILENCE_CONFIG_KEYS: tuple[str, ...] = (
    "silence_rms_threshold",
    "segment_close_silence_ms",
    "context_reset_silence_ms",
)
_FASTER_WHISPER_CONFIG_KEYS: tuple[str, ...] = (
    "language",
    "task",
    "beam_size",
    "best_of",
    "temperature",
    "compression_ratio_threshold",
    "log_prob_threshold",
    "no_speech_threshold",
    "condition_on_previous_text",
)
_EXECUTION_CONFIG_KEYS: tuple[str, ...] = ("device", "compute_type")


@dataclass(frozen=True, slots=True)
class ResolvedLiveSessionOverrides:
    """Carry split session overrides for realtime defaults and execution."""

    realtime: ConfigMap
    execution: ConfigMap
    all: ConfigMap


@dataclass(frozen=True, slots=True)
class ResolvedLiveExecutionConfig:
    """Carry one resolved Live execution target."""

    device: EngineDevice
    compute_type: EngineComputeType


class SupportsLiveRuntimeConfigRead(Protocol):
    """Expose config reads required by Live runtime resolution."""

    def get_all(self, prefix: str) -> ConfigMap:
        """Return all config values matching the provided prefix."""
        ...


class SupportsLiveRuntimeModelStorage(Protocol):
    """Expose model cache state required by Live runtime resolution."""

    def get_cache_state(self, repo_id: str) -> ModelCacheState:
        """Return the local cache state for one model repository."""
        ...


@dataclass(frozen=True, slots=True)
class ResolvedLiveRuntimeConfig:
    """Carry one resolved Live runtime snapshot and summary fields."""

    runtime: LiveRealtimeAdapter
    model_id: str | None
    audio_format: LiveRealtimeAudioFormat
    snapshot: LiveRuntimeConfig


def _raise_runtime_config_error(
    *,
    status_code: int,
    code: str,
    message: str,
) -> NoReturn:
    raise LiveUseCaseError(
        status_code=status_code,
        detail={"code": code, "message": message},
    )


def _ensure_runtime_adapter(runtime_adapter: str) -> LiveRealtimeAdapter:
    normalized = runtime_adapter.strip().casefold()
    if normalized in _SUPPORTED_LIVE_REALTIME_ADAPTERS:
        return cast(LiveRealtimeAdapter, normalized)
    _raise_runtime_config_error(
        status_code=422,
        code="runtime_config_invalid",
        message="Live realtime transcriber setting is invalid",
    )


def _require_registered_model(model_id: str) -> ModelInfo:
    try:
        return require_model(model_id)
    except UnknownModelError as error:
        raise LiveUseCaseError(
            status_code=404,
            detail={
                "code": "runtime_model_not_registered",
                "message": "Live realtime model is not registered",
            },
        ) from error


def _resolve_optional_registered_model_id(model_id: str | None) -> str | None:
    if model_id is None:
        return None
    normalized = model_id.strip()
    if not normalized:
        return None
    return _require_registered_model(normalized).model_id


def _resolve_whisper_streaming_model(
    *,
    request_model_id: str | None,
    config_store: SupportsLiveRuntimeConfigRead,
    model_storage: SupportsLiveRuntimeModelStorage | None,
) -> ModelInfo:
    configured_model_id: str | None = None
    if request_model_id is not None and request_model_id.strip():
        configured_model_id = request_model_id.strip()
    else:
        model_config = config_store.get_all(_MODEL_CONFIG_PREFIX)
        configured = model_config.get(_CONFIGURED_MODEL_ID_KEY)
        if isinstance(configured, str) and configured.strip():
            configured_model_id = configured.strip()

    if configured_model_id is None:
        _raise_runtime_config_error(
            status_code=409,
            code="runtime_model_not_configured",
            message="Live realtime model is not configured",
        )

    model_info = _require_registered_model(configured_model_id)
    if model_storage is None:
        _raise_runtime_config_error(
            status_code=409,
            code="runtime_model_not_downloaded",
            message="Live realtime model is not downloaded",
        )

    if model_storage.get_cache_state(model_info.repo_id) != "downloaded":
        _raise_runtime_config_error(
            status_code=409,
            code="runtime_model_not_downloaded",
            message="Live realtime model is not downloaded",
        )
    return model_info


def _build_session_overrides(
    *,
    language_hint: str | None,
    runtime_overrides: LiveRealtimeRuntimeOverrides | None,
) -> ResolvedLiveSessionOverrides:
    overrides: ConfigMap = {}
    if language_hint is not None:
        normalized_hint = language_hint.strip().lower()
        if normalized_hint:
            overrides["language"] = normalized_hint

    if runtime_overrides:
        overrides = deep_merge(overrides, runtime_overrides)

    realtime_overrides = {
        key: value
        for key, value in overrides.items()
        if key not in _EXECUTION_CONFIG_KEYS
    }
    execution_overrides = {
        key: value for key, value in overrides.items() if key in _EXECUTION_CONFIG_KEYS
    }
    return ResolvedLiveSessionOverrides(
        realtime=realtime_overrides,
        execution=execution_overrides,
        all=overrides,
    )


def _resolve_engine_device(value: object) -> EngineDevice:
    if isinstance(value, str) and value in ALLOWED_ENGINE_DEVICES:
        return cast(EngineDevice, value)
    _raise_runtime_config_error(
        status_code=422,
        code="runtime_config_invalid",
        message="Live realtime execution device is invalid",
    )


def _resolve_engine_compute_type(value: object) -> EngineComputeType:
    if isinstance(value, str) and value in ALLOWED_ENGINE_COMPUTE_TYPES:
        return cast(EngineComputeType, value)
    _raise_runtime_config_error(
        status_code=422,
        code="runtime_config_invalid",
        message="Live realtime execution compute type is invalid",
    )


def _resolve_execution_config(
    execution_overrides: ConfigMap,
) -> ResolvedLiveExecutionConfig:
    engine_config = EngineConfig()
    return ResolvedLiveExecutionConfig(
        device=_resolve_engine_device(
            execution_overrides.get("device", engine_config.device)
        ),
        compute_type=_resolve_engine_compute_type(
            execution_overrides.get("compute_type", engine_config.compute_type)
        ),
    )


def _serialize_nested(values: ConfigMap, keys: tuple[str, ...]) -> JsonDict:
    return {key: values[key] for key in keys}


def _build_whisper_streaming_snapshot(
    *,
    runtime: LiveRealtimeAdapter,
    model_id: str,
    execution: ResolvedLiveExecutionConfig,
    resolved_defaults: ConfigMap,
    session_overrides: ResolvedLiveSessionOverrides,
) -> LiveRuntimeConfig:
    vad_parameters = resolved_defaults.get("vad_parameters")
    if not isinstance(vad_parameters, dict):
        _raise_runtime_config_error(
            status_code=422,
            code="runtime_config_invalid",
            message="Live realtime VAD config is invalid",
        )

    snapshot: LiveRuntimeConfig = {
        "schema_version": LIVE_RUNTIME_CONFIG_SCHEMA_VERSION,
        "runtime": runtime,
        "model_id": model_id,
        "audio_format": LIVE_REALTIME_AUDIO_FORMAT,
        "execution": {
            "device": execution.device,
            "compute_type": execution.compute_type,
        },
        "language": resolved_defaults["language"],
        "task": resolved_defaults["task"],
        "context_prompt": resolved_defaults["context_prompt"],
        "whisper_streaming": {
            "sample_rate": 16000,
            **_serialize_nested(resolved_defaults, _WHISPER_STREAMING_CONFIG_KEYS),
        },
        "silence": _serialize_nested(resolved_defaults, _SILENCE_CONFIG_KEYS),
        "faster_whisper": _serialize_nested(
            resolved_defaults,
            _FASTER_WHISPER_CONFIG_KEYS,
        ),
        "vad": {
            "vad_filter": resolved_defaults["vad_filter"],
            "vad_parameters": vad_parameters,
        },
        "session_overrides": session_overrides.all if session_overrides.all else None,
    }
    return snapshot


def _build_mock_snapshot(
    *,
    runtime: LiveRealtimeAdapter,
    model_id: str | None,
) -> LiveRuntimeConfig:
    return {
        "schema_version": LIVE_RUNTIME_CONFIG_SCHEMA_VERSION,
        "runtime": runtime,
        "model_id": model_id,
        "audio_format": LIVE_REALTIME_AUDIO_FORMAT,
    }


def _reject_mock_runtime_overrides(
    *,
    session_overrides: ConfigMap,
) -> None:
    if not session_overrides:
        return
    _raise_runtime_config_error(
        status_code=422,
        code="runtime_config_invalid",
        message="Mock Live realtime does not support runtime option overrides",
    )


def build_live_runtime_config(
    *,
    runtime_adapter: str,
    request_model_id: str | None,
    language_hint: str | None,
    runtime_overrides: LiveRealtimeRuntimeOverrides | None,
    config_store: SupportsLiveRuntimeConfigRead,
    model_storage: SupportsLiveRuntimeModelStorage | None = None,
) -> ResolvedLiveRuntimeConfig:
    """Resolve Live realtime config layers into one immutable snapshot."""
    runtime = _ensure_runtime_adapter(runtime_adapter)

    if runtime == "mock":
        _reject_mock_runtime_overrides(
            session_overrides=runtime_overrides or {},
        )
        model_id = _resolve_optional_registered_model_id(request_model_id)
        return ResolvedLiveRuntimeConfig(
            runtime=runtime,
            model_id=model_id,
            audio_format=LIVE_REALTIME_AUDIO_FORMAT,
            snapshot=_build_mock_snapshot(runtime=runtime, model_id=model_id),
        )

    session_overrides = _build_session_overrides(
        language_hint=language_hint,
        runtime_overrides=runtime_overrides,
    )
    execution = _resolve_execution_config(session_overrides.execution)
    model_info = _resolve_whisper_streaming_model(
        request_model_id=request_model_id,
        config_store=config_store,
        model_storage=model_storage,
    )
    try:
        effective_defaults = get_live_realtime_effective_defaults(config_store)
        resolved_defaults = resolve_live_realtime_defaults(
            deep_merge(effective_defaults, session_overrides.realtime)
        )
    except (TypeError, ValueError, ValidationError) as error:
        raise LiveUseCaseError(
            status_code=422,
            detail={
                "code": "runtime_config_invalid",
                "message": "Live realtime runtime config is invalid",
            },
        ) from error

    return ResolvedLiveRuntimeConfig(
        runtime=runtime,
        model_id=model_info.model_id,
        audio_format=LIVE_REALTIME_AUDIO_FORMAT,
        snapshot=_build_whisper_streaming_snapshot(
            runtime=runtime,
            model_id=model_info.model_id,
            execution=execution,
            resolved_defaults=resolved_defaults,
            session_overrides=session_overrides,
        ),
    )


__all__ = [
    "LIVE_REALTIME_AUDIO_FORMAT",
    "LIVE_RUNTIME_CONFIG_SCHEMA_VERSION",
    "LiveRealtimeAudioFormat",
    "ResolvedLiveRuntimeConfig",
    "SupportsLiveRuntimeConfigRead",
    "SupportsLiveRuntimeModelStorage",
    "build_live_runtime_config",
]
