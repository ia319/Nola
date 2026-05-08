"""Live realtime default-value helpers."""

from __future__ import annotations

from typing import Protocol

from nola.common.merge import deep_merge
from nola.config.common.types import ConfigMap
from nola.config.live_realtime.types import LiveRealtimeDefaults
from nola.engines.faster_whisper_defaults import (
    get_faster_whisper_defaults,
    get_faster_whisper_vad_default_keys,
)

LIVE_REALTIME_CONFIG_PREFIX = "live_realtime."

_WHISPER_STREAMING_DEFAULTS: ConfigMap = {
    "min_chunk_ms": 1000,
    "buffer_trimming_ms": 15000,
    "prompt_max_chars": 200,
    "timestamp_tolerance_ms": 100,
    "max_duplicate_ngram": 5,
    "silence_rms_threshold": 0.01,
    "segment_close_silence_ms": 500,
    "context_reset_silence_ms": 2000,
}

_FASTER_WHISPER_KEYS: tuple[str, ...] = (
    "language",
    "task",
    "beam_size",
    "best_of",
    "temperature",
    "compression_ratio_threshold",
    "log_prob_threshold",
    "no_speech_threshold",
    "condition_on_previous_text",
    "vad_filter",
)

_LIVE_REALTIME_VAD_KEYS: tuple[str, ...] = (
    "threshold",
    "neg_threshold",
    "min_speech_duration_ms",
    "max_speech_duration_s",
    "min_silence_duration_ms",
    "speech_pad_ms",
)


class SupportsConfigRead(Protocol):
    """Represent the config-store contract used by Live defaults merging."""

    def get_all(self, prefix: str) -> ConfigMap:
        """Return all config values matching the provided prefix."""


def get_live_realtime_vad_parameter_keys() -> tuple[str, ...]:
    """Return supported VAD keys exposed by Live realtime."""
    installed_keys = get_faster_whisper_vad_default_keys()
    return tuple(key for key in _LIVE_REALTIME_VAD_KEYS if key in installed_keys)


def get_live_realtime_default_keys() -> frozenset[str]:
    """Return top-level keys supported by Live realtime defaults."""
    return frozenset(
        {
            "context_prompt",
            "vad_parameters",
            *_WHISPER_STREAMING_DEFAULTS.keys(),
            *_FASTER_WHISPER_KEYS,
        }
    )


def _build_live_realtime_builtin_defaults() -> ConfigMap:
    """Build raw built-in defaults for one Live realtime runtime."""
    faster_whisper_defaults = get_faster_whisper_defaults()
    vad_parameters = faster_whisper_defaults.get("vad_parameters")
    if not isinstance(vad_parameters, dict):
        raise TypeError("faster-whisper VAD defaults must be a dictionary")

    defaults: ConfigMap = {
        "context_prompt": None,
        **_WHISPER_STREAMING_DEFAULTS,
    }
    for key in _FASTER_WHISPER_KEYS:
        defaults[key] = faster_whisper_defaults[key]

    defaults["vad_parameters"] = {
        key: vad_parameters[key]
        for key in get_live_realtime_vad_parameter_keys()
        if key in vad_parameters
    }
    return defaults


def _validate_defaults(values: ConfigMap) -> LiveRealtimeDefaults:
    """Return a validated Live realtime defaults model."""
    return LiveRealtimeDefaults.model_validate(values)


def resolve_live_realtime_defaults(overrides: ConfigMap | None = None) -> ConfigMap:
    """Return API-safe Live realtime defaults with optional overrides."""
    builtin_defaults = _build_live_realtime_builtin_defaults()
    merged = deep_merge(builtin_defaults, overrides or {})
    return _validate_defaults(merged).to_config_map()


def get_live_realtime_builtin_defaults() -> ConfigMap:
    """Return API-safe Live realtime built-in defaults."""
    return resolve_live_realtime_defaults()


def get_live_realtime_effective_defaults(
    config_db: SupportsConfigRead,
) -> ConfigMap:
    """Return Live realtime defaults merged with persisted overrides."""
    persisted_defaults = config_db.get_all(LIVE_REALTIME_CONFIG_PREFIX)
    return resolve_live_realtime_defaults(persisted_defaults)


__all__ = [
    "get_live_realtime_builtin_defaults",
    "get_live_realtime_default_keys",
    "get_live_realtime_effective_defaults",
    "get_live_realtime_vad_parameter_keys",
    "LIVE_REALTIME_CONFIG_PREFIX",
    "resolve_live_realtime_defaults",
]
