"""Define Live WhisperStreaming runtime configuration."""

from dataclasses import dataclass
from math import inf
from typing import Final, Literal, TypeAlias, TypedDict, cast

from nola.application.live.realtime.whisper_streaming.errors import (
    WhisperStreamingRuntimeConfigError,
)
from nola.application.live.runtime_config import (
    LIVE_REALTIME_AUDIO_FORMAT,
    LIVE_RUNTIME_CONFIG_SCHEMA_VERSION,
)
from nola.application.live.types import LiveRuntimeConfig
from nola.common.types import JsonDict, JsonValue
from nola.config.live_realtime import CONTEXT_PROMPT_MAX_CHARS

WHISPER_STREAMING_SAMPLE_RATE: Final = 16000
WHISPER_STREAMING_CONTEXT_PROMPT_SEPARATOR: Final = "\n\n"
WhisperStreamingTask: TypeAlias = Literal["transcribe", "translate"]
WhisperStreamingTemperature: TypeAlias = float | list[float]


class WhisperStreamingVadParameters(TypedDict, total=False):
    """Match faster-whisper VadOptions fields used by Live runtime."""

    threshold: float
    neg_threshold: float | None
    min_speech_duration_ms: int
    max_speech_duration_s: float
    min_silence_duration_ms: int
    speech_pad_ms: int


@dataclass(frozen=True)
class WhisperStreamingRuntimeConfig:
    """Configure one Live WhisperStreaming runtime."""

    language: str | None = None
    task: WhisperStreamingTask = "transcribe"
    context_prompt: str | None = None
    sample_rate: Literal[16000] = WHISPER_STREAMING_SAMPLE_RATE
    min_chunk_ms: int = 1000
    buffer_trimming_ms: int = 15000
    prompt_max_chars: int = 200
    timestamp_tolerance_ms: int = 100
    max_duplicate_ngram: int = 5
    beam_size: int = 5
    best_of: int = 5
    temperature: WhisperStreamingTemperature = 0.0
    compression_ratio_threshold: float | None = None
    log_prob_threshold: float | None = None
    no_speech_threshold: float | None = None
    condition_on_previous_text: bool = True
    vad_filter: bool = False
    vad_parameters: WhisperStreamingVadParameters | None = None
    silence_rms_threshold: float = 0.01
    segment_close_silence_ms: int = 500
    context_reset_silence_ms: int = 2000


@dataclass(frozen=True, slots=True)
class WhisperStreamingRuntimeSnapshot:
    """Carry a validated session snapshot for WhisperStreaming runtime use."""

    model_id: str
    config: WhisperStreamingRuntimeConfig


def validate_whisper_streaming_runtime_config(
    config: WhisperStreamingRuntimeConfig,
) -> WhisperStreamingRuntimeConfig:
    """Return a valid runtime config or raise a stable runtime error."""
    if config.sample_rate != WHISPER_STREAMING_SAMPLE_RATE:
        raise WhisperStreamingRuntimeConfigError(
            "WhisperStreaming requires 16 kHz audio"
        )

    if config.task not in ("transcribe", "translate"):
        raise WhisperStreamingRuntimeConfigError("task is not supported")

    if config.context_prompt is not None:
        normalized_prompt = config.context_prompt.strip()
        if not normalized_prompt:
            raise WhisperStreamingRuntimeConfigError("context_prompt must not be blank")
        if len(normalized_prompt) > CONTEXT_PROMPT_MAX_CHARS:
            raise WhisperStreamingRuntimeConfigError("context_prompt is too long")

    positive_fields = {
        "min_chunk_ms": config.min_chunk_ms,
        "buffer_trimming_ms": config.buffer_trimming_ms,
        "prompt_max_chars": config.prompt_max_chars,
        "max_duplicate_ngram": config.max_duplicate_ngram,
        "beam_size": config.beam_size,
        "best_of": config.best_of,
        "segment_close_silence_ms": config.segment_close_silence_ms,
        "context_reset_silence_ms": config.context_reset_silence_ms,
    }
    for field_name, value in positive_fields.items():
        if value <= 0:
            raise WhisperStreamingRuntimeConfigError(
                f"{field_name} must be greater than 0"
            )

    if config.timestamp_tolerance_ms < 0:
        raise WhisperStreamingRuntimeConfigError(
            "timestamp_tolerance_ms must be greater than or equal to 0"
        )

    if config.silence_rms_threshold <= 0:
        raise WhisperStreamingRuntimeConfigError(
            "silence_rms_threshold must be greater than 0"
        )

    _validate_temperature(config.temperature)

    if (
        config.no_speech_threshold is not None
        and not 0 <= config.no_speech_threshold <= 1
    ):
        raise WhisperStreamingRuntimeConfigError(
            "no_speech_threshold must be between 0 and 1"
        )

    if config.context_reset_silence_ms < config.segment_close_silence_ms:
        raise WhisperStreamingRuntimeConfigError(
            "context_reset_silence_ms must be greater than or equal to "
            "segment_close_silence_ms"
        )

    return config


def whisper_streaming_runtime_snapshot_from_live_snapshot(
    snapshot: LiveRuntimeConfig,
) -> WhisperStreamingRuntimeSnapshot:
    """Return a typed WhisperStreaming config from a saved Live session snapshot."""
    _require_equal(snapshot, "schema_version", LIVE_RUNTIME_CONFIG_SCHEMA_VERSION)
    _require_equal(snapshot, "runtime", "whisper_streaming")
    _require_equal(snapshot, "audio_format", LIVE_REALTIME_AUDIO_FORMAT)
    model_id = _require_non_blank_string(snapshot, "model_id")
    whisper_streaming = _require_dict(snapshot, "whisper_streaming")
    silence = _require_dict(snapshot, "silence")
    faster_whisper = _require_dict(snapshot, "faster_whisper")
    vad = _require_dict(snapshot, "vad")

    config = validate_whisper_streaming_runtime_config(
        WhisperStreamingRuntimeConfig(
            language=_optional_string(faster_whisper, "language"),
            task=_require_task(faster_whisper, "task"),
            context_prompt=_optional_normalized_string(snapshot, "context_prompt"),
            sample_rate=_require_sample_rate(whisper_streaming, "sample_rate"),
            min_chunk_ms=_require_int(whisper_streaming, "min_chunk_ms"),
            buffer_trimming_ms=_require_int(whisper_streaming, "buffer_trimming_ms"),
            prompt_max_chars=_require_int(whisper_streaming, "prompt_max_chars"),
            timestamp_tolerance_ms=_require_int(
                whisper_streaming,
                "timestamp_tolerance_ms",
            ),
            max_duplicate_ngram=_require_int(
                whisper_streaming,
                "max_duplicate_ngram",
            ),
            beam_size=_require_int(faster_whisper, "beam_size"),
            best_of=_require_int(faster_whisper, "best_of"),
            temperature=_require_temperature(faster_whisper, "temperature"),
            compression_ratio_threshold=_optional_float(
                faster_whisper,
                "compression_ratio_threshold",
            ),
            log_prob_threshold=_optional_float(faster_whisper, "log_prob_threshold"),
            no_speech_threshold=_optional_float(
                faster_whisper,
                "no_speech_threshold",
            ),
            condition_on_previous_text=_require_bool(
                faster_whisper,
                "condition_on_previous_text",
            ),
            vad_filter=_require_bool(vad, "vad_filter"),
            vad_parameters=_require_vad_parameters(vad, "vad_parameters"),
            silence_rms_threshold=_require_float(silence, "silence_rms_threshold"),
            segment_close_silence_ms=_require_int(silence, "segment_close_silence_ms"),
            context_reset_silence_ms=_require_int(
                silence,
                "context_reset_silence_ms",
            ),
        )
    )
    return WhisperStreamingRuntimeSnapshot(model_id=model_id, config=config)


def combine_initial_prompt(
    *,
    context_prompt: str | None,
    dynamic_prompt: str,
) -> str | None:
    """Combine session-level context with WhisperStreaming dynamic prompt."""
    parts: list[str] = []
    if context_prompt is not None and context_prompt.strip():
        parts.append(context_prompt.strip())
    if dynamic_prompt.strip():
        parts.append(dynamic_prompt.strip())
    if not parts:
        return None
    return WHISPER_STREAMING_CONTEXT_PROMPT_SEPARATOR.join(parts)


def _validate_temperature(temperature: WhisperStreamingTemperature) -> None:
    values = temperature if isinstance(temperature, list) else [temperature]
    if not values:
        raise WhisperStreamingRuntimeConfigError("temperature must not be empty")
    if any(value < 0 for value in values):
        raise WhisperStreamingRuntimeConfigError("temperature must be non-negative")


def _require_key(values: JsonDict, key: str) -> JsonValue:
    if key not in values:
        raise WhisperStreamingRuntimeConfigError(f"{key} is required")
    return values[key]


def _require_equal(values: JsonDict, key: str, expected: JsonValue) -> None:
    if _require_key(values, key) != expected:
        raise WhisperStreamingRuntimeConfigError(f"{key} is invalid")


def _require_dict(values: JsonDict, key: str) -> JsonDict:
    value = _require_key(values, key)
    if isinstance(value, dict):
        return value
    raise WhisperStreamingRuntimeConfigError(f"{key} must be an object")


def _require_non_blank_string(values: JsonDict, key: str) -> str:
    value = _require_key(values, key)
    if isinstance(value, str) and value.strip():
        return value.strip()
    raise WhisperStreamingRuntimeConfigError(f"{key} must be a non-empty string")


def _optional_string(values: JsonDict, key: str) -> str | None:
    value = _require_key(values, key)
    if value is None:
        return None
    if isinstance(value, str):
        return value
    raise WhisperStreamingRuntimeConfigError(f"{key} must be a string or null")


def _optional_normalized_string(values: JsonDict, key: str) -> str | None:
    value = _require_key(values, key)
    if value is None:
        return None
    if isinstance(value, str):
        normalized = value.strip()
        return normalized or None
    raise WhisperStreamingRuntimeConfigError(f"{key} must be a string or null")


def _require_task(values: JsonDict, key: str) -> WhisperStreamingTask:
    value = _require_key(values, key)
    if value in ("transcribe", "translate"):
        return cast(WhisperStreamingTask, value)
    raise WhisperStreamingRuntimeConfigError(f"{key} is not supported")


def _require_bool(values: JsonDict, key: str) -> bool:
    value = _require_key(values, key)
    if isinstance(value, bool):
        return value
    raise WhisperStreamingRuntimeConfigError(f"{key} must be a boolean")


def _require_int(values: JsonDict, key: str) -> int:
    value = _require_key(values, key)
    if isinstance(value, int) and not isinstance(value, bool):
        return value
    raise WhisperStreamingRuntimeConfigError(f"{key} must be an integer")


def _require_float(values: JsonDict, key: str) -> float:
    value = _require_key(values, key)
    return _coerce_float(value, key=key)


def _optional_float(values: JsonDict, key: str) -> float | None:
    value = _require_key(values, key)
    if value is None:
        return None
    return _coerce_float(value, key=key)


def _coerce_float(value: JsonValue, *, key: str) -> float:
    if isinstance(value, int | float) and not isinstance(value, bool):
        return float(value)
    raise WhisperStreamingRuntimeConfigError(f"{key} must be a number")


def _require_sample_rate(
    values: JsonDict,
    key: str,
) -> Literal[16000]:
    value = _require_int(values, key)
    if value == WHISPER_STREAMING_SAMPLE_RATE:
        return WHISPER_STREAMING_SAMPLE_RATE
    raise WhisperStreamingRuntimeConfigError("sample_rate is invalid")


def _require_temperature(
    values: JsonDict,
    key: str,
) -> WhisperStreamingTemperature:
    value = _require_key(values, key)
    if isinstance(value, int | float) and not isinstance(value, bool):
        return float(value)
    if isinstance(value, list):
        temperatures = [_coerce_float(item, key=key) for item in value]
        _validate_temperature(temperatures)
        return temperatures
    raise WhisperStreamingRuntimeConfigError(f"{key} must be a number or list")


def _require_vad_parameters(
    values: JsonDict,
    key: str,
) -> WhisperStreamingVadParameters | None:
    value = _require_key(values, key)
    if value is None:
        return None
    if not isinstance(value, dict):
        raise WhisperStreamingRuntimeConfigError(f"{key} must be an object or null")

    raw_parameters = value
    parameters: WhisperStreamingVadParameters = {
        "threshold": _require_float(raw_parameters, "threshold"),
        "neg_threshold": _optional_float(raw_parameters, "neg_threshold"),
        "min_speech_duration_ms": _require_int(
            raw_parameters,
            "min_speech_duration_ms",
        ),
        "max_speech_duration_s": _require_vad_max_speech_duration(
            raw_parameters,
            "max_speech_duration_s",
        ),
        "min_silence_duration_ms": _require_int(
            raw_parameters,
            "min_silence_duration_ms",
        ),
        "speech_pad_ms": _require_int(raw_parameters, "speech_pad_ms"),
    }
    return parameters


def _require_vad_max_speech_duration(values: JsonDict, key: str) -> float:
    value = _require_key(values, key)
    if value == "inf":
        return inf
    return _coerce_float(value, key=key)


__all__ = [
    "WHISPER_STREAMING_CONTEXT_PROMPT_SEPARATOR",
    "WHISPER_STREAMING_SAMPLE_RATE",
    "WhisperStreamingRuntimeSnapshot",
    "WhisperStreamingRuntimeConfig",
    "WhisperStreamingTask",
    "WhisperStreamingTemperature",
    "WhisperStreamingVadParameters",
    "combine_initial_prompt",
    "validate_whisper_streaming_runtime_config",
    "whisper_streaming_runtime_snapshot_from_live_snapshot",
]
