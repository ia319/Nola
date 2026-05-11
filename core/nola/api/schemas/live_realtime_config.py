"""Live realtime configuration request schemas."""

from typing import Literal, cast

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StrictBool,
    StrictFloat,
    StrictInt,
    field_validator,
    model_validator,
)

from nola.config.common import ConfigMap
from nola.config.live_realtime import (
    CONTEXT_PROMPT_MAX_CHARS,
    get_live_realtime_vad_parameter_keys,
)
from nola.engines.base import EngineComputeType, EngineDevice
from nola.engines.faster_whisper_defaults import FASTER_WHISPER_TASK_VALUES


class LiveRealtimeVadParametersUpdateRequest(BaseModel):
    """Partial update payload for Live realtime VAD defaults."""

    model_config = ConfigDict(extra="forbid")

    threshold: StrictFloat | None = Field(None, ge=0, le=1)
    neg_threshold: StrictFloat | None = Field(None, ge=0, le=1)
    min_speech_duration_ms: StrictInt | None = Field(None, ge=0)
    max_speech_duration_s: StrictFloat | Literal["inf"] | None = None
    min_silence_duration_ms: StrictInt | None = Field(None, ge=0)
    speech_pad_ms: StrictInt | None = Field(None, ge=0)

    @model_validator(mode="before")
    @classmethod
    def check_supported_keys(cls, value: object) -> object:
        """Reject VAD keys unsupported by the installed faster-whisper build."""
        if isinstance(value, dict):
            supported_keys = set(get_live_realtime_vad_parameter_keys())
            unknown_keys = sorted(set(value) - supported_keys)
            if unknown_keys:
                joined = ", ".join(unknown_keys)
                raise ValueError(f"Unsupported VAD parameter key(s): {joined}")
        return value

    @field_validator("max_speech_duration_s")
    @classmethod
    def check_max_speech_duration_s(
        cls, value: float | Literal["inf"] | None
    ) -> float | Literal["inf"] | None:
        """Keep VAD max speech duration non-negative while allowing inf."""
        if value is None or value == "inf":
            return value
        if value < 0:
            raise ValueError("max_speech_duration_s must be non-negative")
        return value


class _LiveRealtimeOptionsUpdateRequest(BaseModel):
    """Partial Live realtime option payload shared by default and session overrides."""

    model_config = ConfigDict(extra="forbid")

    language: str | None = None
    task: str | None = None
    context_prompt: str | None = None
    min_chunk_ms: StrictInt | None = Field(None, gt=0)
    buffer_trimming_ms: StrictInt | None = Field(None, gt=0)
    prompt_max_chars: StrictInt | None = Field(None, gt=0)
    timestamp_tolerance_ms: StrictInt | None = Field(None, ge=0)
    max_duplicate_ngram: StrictInt | None = Field(None, gt=0)
    silence_rms_threshold: StrictFloat | None = Field(None, gt=0)
    segment_close_silence_ms: StrictInt | None = Field(None, gt=0)
    context_reset_silence_ms: StrictInt | None = Field(None, gt=0)
    beam_size: StrictInt | None = Field(None, ge=1, le=10)
    best_of: StrictInt | None = Field(None, ge=1)
    temperature: StrictFloat | list[StrictFloat] | None = None
    compression_ratio_threshold: StrictFloat | None = None
    log_prob_threshold: StrictFloat | None = None
    no_speech_threshold: StrictFloat | None = Field(None, ge=0, le=1)
    condition_on_previous_text: StrictBool | None = None
    vad_filter: StrictBool | None = None
    vad_parameters: LiveRealtimeVadParametersUpdateRequest | None = None

    @field_validator("language")
    @classmethod
    def normalize_language(cls, value: str | None) -> str | None:
        """Normalize optional language codes before effective validation."""
        if value is None:
            return None
        normalized = value.strip().lower()
        return normalized or None

    @field_validator("task")
    @classmethod
    def validate_task(cls, value: str | None) -> str | None:
        """Normalize and reject unsupported faster-whisper task values."""
        if value is None:
            return None
        normalized = value.strip().lower()
        if normalized not in FASTER_WHISPER_TASK_VALUES:
            raise ValueError(f"Unsupported task: {value}")
        return normalized

    @field_validator("context_prompt")
    @classmethod
    def normalize_context_prompt(cls, value: str | None) -> str | None:
        """Treat blank prompt context as a request to clear the override."""
        if value is None:
            return None
        normalized = value.strip()
        if len(normalized) > CONTEXT_PROMPT_MAX_CHARS:
            raise ValueError("context_prompt exceeds the maximum length")
        return normalized or None

    @field_validator("temperature")
    @classmethod
    def validate_temperature(
        cls, value: float | list[float] | None
    ) -> float | list[float] | None:
        """Reject empty or negative fallback temperatures."""
        if value is None:
            return None
        if isinstance(value, list) and not value:
            raise ValueError("temperature must contain at least one value")
        values = value if isinstance(value, list) else [value]
        for index, item in enumerate(values):
            if item < 0:
                raise ValueError(f"temperature[{index}] must be non-negative")
        return value

    def get_options_dict(self) -> ConfigMap:
        """Return explicitly provided keys, preserving null override values."""
        return cast(ConfigMap, self.model_dump(exclude_unset=True))


class LiveRealtimeDefaultsUpdateRequest(_LiveRealtimeOptionsUpdateRequest):
    """Partial update payload for application-level Live realtime defaults."""

    model_config = ConfigDict(
        extra="forbid",
        json_schema_extra={
            "example": {
                "language": "en",
                "beam_size": 3,
                "vad_parameters": {"threshold": 0.6},
            }
        },
    )


class LiveRealtimeRuntimeOverridesRequest(_LiveRealtimeOptionsUpdateRequest):
    """Partial Live realtime option payload for one session create request."""

    device: EngineDevice | None = None
    compute_type: EngineComputeType | None = None

    @model_validator(mode="after")
    def reject_unsupported_null_overrides(
        self,
    ) -> "LiveRealtimeRuntimeOverridesRequest":
        """Allow null only where session runtime semantics define it."""
        for field_name in self.model_fields_set:
            if field_name == "context_prompt":
                continue
            if getattr(self, field_name) is None:
                raise ValueError(
                    "Only context_prompt supports explicit null in session "
                    "runtime overrides"
                )

        if self.vad_parameters is not None:
            for field_name in self.vad_parameters.model_fields_set:
                if getattr(self.vad_parameters, field_name) is None:
                    raise ValueError(
                        "VAD session runtime overrides do not support explicit null"
                    )

        return self


__all__ = [
    "LiveRealtimeDefaultsUpdateRequest",
    "LiveRealtimeRuntimeOverridesRequest",
    "LiveRealtimeVadParametersUpdateRequest",
]
