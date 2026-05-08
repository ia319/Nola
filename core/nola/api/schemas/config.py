"""Configuration API request schemas."""

from typing import Literal, cast

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from nola.api.schemas.transcriptions import TranscriptionDefaultsUpdateRequest
from nola.config.common import ConfigMap
from nola.config.export import ExportFormat
from nola.config.live_realtime import (
    CONTEXT_PROMPT_MAX_CHARS,
    LiveRealtimeDefaults,
    LiveRealtimeOptionGroupSchema,
    get_live_realtime_vad_parameter_keys,
)
from nola.config.session import SessionExecutionDefaultsPatch
from nola.config.transcription.schema.responses import (
    TranscriptionResolvedDefaultsResponse,
)
from nola.engines.base import EngineComputeType, EngineDevice
from nola.engines.faster_whisper_defaults import FASTER_WHISPER_TASK_VALUES
from nola.model_hub import get_model


class ExportDefaultsUpdateRequest(BaseModel):
    """Partial update payload for application-level export defaults."""

    model_config = ConfigDict(
        extra="forbid",
        json_schema_extra={"example": {"format": "vtt", "include_timestamps": False}},
    )

    format: ExportFormat | None = Field(None, description="Default export format")
    include_timestamps: bool | None = Field(
        None,
        description="Whether TXT export includes timestamp prefixes by default",
    )

    def get_options_dict(self) -> ConfigMap:
        """Return explicitly provided keys, preserving nulls for field resets."""
        return cast(ConfigMap, self.model_dump(exclude_unset=True))


class LiveRealtimeVadParametersUpdateRequest(BaseModel):
    """Partial update payload for Live realtime VAD defaults."""

    model_config = ConfigDict(extra="forbid")

    threshold: float | None = Field(None, ge=0, le=1)
    neg_threshold: float | None = Field(None, ge=0, le=1)
    min_speech_duration_ms: int | None = Field(None, ge=0)
    max_speech_duration_s: float | Literal["inf"] | None = None
    min_silence_duration_ms: int | None = Field(None, ge=0)
    speech_pad_ms: int | None = Field(None, ge=0)

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


class LiveRealtimeDefaultsUpdateRequest(BaseModel):
    """Partial update payload for application-level Live realtime defaults."""

    model_config = ConfigDict(
        extra="forbid",
        json_schema_extra={
            "example": {
                "language": "en",
                "beam_size": 3,
                "context_prompt": "Domain terms and proper nouns",
                "vad_parameters": {"threshold": 0.6},
            }
        },
    )

    language: str | None = None
    task: str | None = None
    context_prompt: str | None = None
    min_chunk_ms: int | None = Field(None, gt=0)
    buffer_trimming_ms: int | None = Field(None, gt=0)
    prompt_max_chars: int | None = Field(None, gt=0)
    timestamp_tolerance_ms: int | None = Field(None, ge=0)
    max_duplicate_ngram: int | None = Field(None, gt=0)
    silence_rms_threshold: float | None = Field(None, gt=0)
    segment_close_silence_ms: int | None = Field(None, gt=0)
    context_reset_silence_ms: int | None = Field(None, gt=0)
    beam_size: int | None = Field(None, ge=1, le=10)
    best_of: int | None = Field(None, ge=1)
    temperature: float | list[float] | None = None
    compression_ratio_threshold: float | None = None
    log_prob_threshold: float | None = None
    no_speech_threshold: float | None = Field(None, ge=0, le=1)
    condition_on_previous_text: bool | None = None
    vad_filter: bool | None = None
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
        """Return explicitly provided keys, preserving nulls for resets."""
        return cast(ConfigMap, self.model_dump(exclude_unset=True))


class LiveRealtimeDefaultsResponse(BaseModel):
    """Expose resolved Live realtime defaults."""

    defaults: LiveRealtimeDefaults


class LiveRealtimeDefaultsPatchResponse(LiveRealtimeDefaultsResponse):
    """Expose Live realtime defaults after a persisted PATCH."""


class LiveRealtimeSchemaResponse(BaseModel):
    """Expose Live realtime option metadata for schema-driven clients."""

    schema_: list[LiveRealtimeOptionGroupSchema] = Field(alias="schema")


class SessionExecutionDefaultsResponse(BaseModel):
    """Expose resolved execution defaults for new session tasks."""

    model_id: str
    device: EngineDevice
    compute_type: EngineComputeType


class SessionDefaultsResponse(BaseModel):
    """Expose Workbench defaults split by execution and transcription scope."""

    execution: SessionExecutionDefaultsResponse
    transcription: TranscriptionResolvedDefaultsResponse


class SessionExecutionDefaultsUpdateRequest(BaseModel):
    """Partial update payload for session execution defaults."""

    model_config = ConfigDict(
        extra="forbid",
        json_schema_extra={
            "example": {
                "model_id": "small",
                "device": "auto",
                "compute_type": "default",
            }
        },
    )

    model_id: str | None = Field(None, description="Default model id for new tasks")
    device: EngineDevice | None = Field(
        None,
        description="Default engine device for new tasks",
    )
    compute_type: EngineComputeType | None = Field(
        None,
        description="Default engine compute type for new tasks",
    )

    @field_validator("model_id")
    @classmethod
    def check_model_id(cls, value: str | None) -> str | None:
        """Reject unknown model ids and normalize aliases to canonical ids."""
        if value is None:
            return None

        model = get_model(value)
        if model is None:
            raise ValueError(f"Unknown model id: {value}")
        return model.model_id

    def get_options_dict(self) -> SessionExecutionDefaultsPatch:
        """Return explicitly provided keys, preserving nulls for field resets."""
        raw_values = self.model_dump(exclude_unset=True)
        patch: SessionExecutionDefaultsPatch = {}

        if "model_id" in raw_values:
            patch["model_id"] = cast(str | None, raw_values["model_id"])
        if "device" in raw_values:
            patch["device"] = cast(str | None, raw_values["device"])
        if "compute_type" in raw_values:
            patch["compute_type"] = cast(str | None, raw_values["compute_type"])

        return patch


class SessionDefaultsUpdateRequest(BaseModel):
    """Partial update payload for session defaults."""

    model_config = ConfigDict(
        extra="forbid",
        json_schema_extra={
            "example": {
                "execution": {
                    "model_id": "small",
                    "device": "auto",
                    "compute_type": "default",
                },
                "transcription": {
                    "vad_filter": True,
                    "vad_parameters": {"threshold": 0.1},
                },
            }
        },
    )

    execution: SessionExecutionDefaultsUpdateRequest | None = None
    transcription: TranscriptionDefaultsUpdateRequest | None = None
