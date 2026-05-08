"""Define Live realtime configuration contracts."""

from __future__ import annotations

from typing import Annotated, Literal, TypeAlias

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from nola.config.common.types import ConfigMap
from nola.config.constants import SUPPORTED_LANGUAGES
from nola.engines.faster_whisper_defaults import (
    FASTER_WHISPER_TASK_VALUES,
    serialize_faster_whisper_default,
)

LiveRealtimeAdapter: TypeAlias = Literal["mock", "whisper_streaming"]
LiveRealtimeTask: TypeAlias = Literal["transcribe", "translate"]
LiveRealtimeMaxSpeechDuration: TypeAlias = float | Literal["inf"]
LiveRealtimeTemperature: TypeAlias = float | list[float]
LiveRealtimeFieldDefaultValue: TypeAlias = str | int | float | bool | None | list[float]

CONTEXT_PROMPT_MAX_CHARS = 2000


class LiveRealtimeVadParameters(BaseModel):
    """Validate faster-whisper VAD options exposed by Live realtime."""

    model_config = ConfigDict(extra="forbid")

    threshold: float = Field(ge=0, le=1)
    neg_threshold: float | None = Field(None, ge=0, le=1)
    min_speech_duration_ms: int = Field(ge=0)
    max_speech_duration_s: LiveRealtimeMaxSpeechDuration
    min_silence_duration_ms: int = Field(ge=0)
    speech_pad_ms: int = Field(ge=0)

    @field_validator("max_speech_duration_s")
    @classmethod
    def validate_max_speech_duration(
        cls, value: LiveRealtimeMaxSpeechDuration
    ) -> LiveRealtimeMaxSpeechDuration:
        """Allow the API infinity sentinel while rejecting negative numbers."""
        if value == "inf":
            return value
        if value < 0:
            raise ValueError("max_speech_duration_s must be non-negative")
        return value


class LiveRealtimeDefaults(BaseModel):
    """Validate one resolved Live realtime defaults payload."""

    model_config = ConfigDict(extra="forbid")

    language: str | None = None
    task: LiveRealtimeTask
    context_prompt: str | None = None
    min_chunk_ms: int = Field(gt=0)
    buffer_trimming_ms: int = Field(gt=0)
    prompt_max_chars: int = Field(gt=0)
    timestamp_tolerance_ms: int = Field(ge=0)
    max_duplicate_ngram: int = Field(gt=0)
    silence_rms_threshold: float = Field(gt=0)
    segment_close_silence_ms: int = Field(gt=0)
    context_reset_silence_ms: int = Field(gt=0)
    beam_size: int = Field(ge=1, le=10)
    best_of: int = Field(ge=1)
    temperature: LiveRealtimeTemperature
    compression_ratio_threshold: float | None = None
    log_prob_threshold: float | None = None
    no_speech_threshold: float | None = Field(None, ge=0, le=1)
    condition_on_previous_text: bool
    vad_filter: bool
    vad_parameters: LiveRealtimeVadParameters

    @field_validator("language")
    @classmethod
    def validate_language(cls, value: str | None) -> str | None:
        """Normalize and reject unsupported language codes."""
        if value is None:
            return None
        normalized = value.strip().lower()
        if normalized not in SUPPORTED_LANGUAGES:
            raise ValueError(f"Unsupported language: {value}")
        return normalized

    @field_validator("task", mode="before")
    @classmethod
    def validate_task(cls, value: object) -> object:
        """Normalize and reject unsupported faster-whisper task values."""
        if not isinstance(value, str):
            return value
        normalized = value.strip().lower()
        if normalized not in FASTER_WHISPER_TASK_VALUES:
            raise ValueError(f"Unsupported task: {value}")
        return normalized

    @field_validator("context_prompt")
    @classmethod
    def normalize_context_prompt(cls, value: str | None) -> str | None:
        """Store blank prompt context as null and cap prompt length."""
        if value is None:
            return None
        normalized = value.strip()
        if normalized == "":
            return None
        if len(normalized) > CONTEXT_PROMPT_MAX_CHARS:
            raise ValueError("context_prompt exceeds the maximum length")
        return normalized

    @field_validator("temperature")
    @classmethod
    def validate_temperature(
        cls, value: LiveRealtimeTemperature
    ) -> LiveRealtimeTemperature:
        """Reject empty or negative fallback temperatures."""
        if isinstance(value, list) and not value:
            raise ValueError("temperature must contain at least one value")
        values = value if isinstance(value, list) else [value]
        for index, item in enumerate(values):
            if item < 0:
                raise ValueError(f"temperature[{index}] must be non-negative")
        return value

    @model_validator(mode="after")
    def validate_silence_order(self) -> LiveRealtimeDefaults:
        """Keep context reset later than segment close."""
        if self.context_reset_silence_ms < self.segment_close_silence_ms:
            raise ValueError(
                "context_reset_silence_ms must be greater than or equal to "
                "segment_close_silence_ms"
            )
        return self

    def to_config_map(self) -> ConfigMap:
        """Return the resolved defaults as API-safe JSON values."""
        serialized = serialize_faster_whisper_default(self.model_dump(mode="json"))
        if not isinstance(serialized, dict):
            raise TypeError("Serialized Live realtime defaults must be a dictionary")
        return serialized


class LiveRealtimeSelectOptionSchema(BaseModel):
    """Describe one selectable Live realtime option."""

    value: str
    label_key: str


class LiveRealtimeFieldBase(BaseModel):
    """Describe shared Live realtime field metadata."""

    key: str
    label_key: str
    description_key: str
    default_value: LiveRealtimeFieldDefaultValue
    supported_adapters: list[LiveRealtimeAdapter]
    depends_on: str | None = None


class LiveRealtimeSliderFieldSchema(LiveRealtimeFieldBase):
    """Describe a slider-backed Live realtime numeric field."""

    type: Literal["slider"]
    min: float
    max: float
    step: float

    @model_validator(mode="after")
    def validate_numeric_bounds(self) -> LiveRealtimeSliderFieldSchema:
        """Keep slider range and step definitions valid."""
        if self.min > self.max:
            raise ValueError("slider field min must be less than or equal to max")
        if self.step <= 0:
            raise ValueError("slider field step must be greater than zero")
        return self


class LiveRealtimeNumberFieldSchema(LiveRealtimeFieldBase):
    """Describe a number-input Live realtime field."""

    type: Literal["number"]
    min: float | None = None
    max: float | None = None
    step: float | None = None
    special_values: list[str] | None = None

    @model_validator(mode="after")
    def validate_numeric_bounds(self) -> LiveRealtimeNumberFieldSchema:
        """Keep numeric range and step definitions valid when provided."""
        if self.min is not None and self.max is not None and self.min > self.max:
            raise ValueError("number field min must be less than or equal to max")
        if self.step is not None and self.step <= 0:
            raise ValueError("number field step must be greater than zero")
        return self


class LiveRealtimeNumberListFieldSchema(LiveRealtimeFieldBase):
    """Describe a comma-separated numeric-list Live realtime field."""

    type: Literal["number_list"]
    allow_negative: bool = False
    collapse_single_value: bool = False


class LiveRealtimeSwitchFieldSchema(LiveRealtimeFieldBase):
    """Describe a boolean Live realtime field."""

    type: Literal["switch"]


class LiveRealtimeTextareaFieldSchema(LiveRealtimeFieldBase):
    """Describe a multi-line text Live realtime field."""

    type: Literal["textarea"]
    max_length: int | None = None


class LiveRealtimeSelectFieldSchema(LiveRealtimeFieldBase):
    """Describe a single-select Live realtime field."""

    type: Literal["select"]
    options: list[LiveRealtimeSelectOptionSchema] | None = None
    options_source: Literal["effective_languages"] | None = None

    @model_validator(mode="after")
    def validate_option_source(self) -> LiveRealtimeSelectFieldSchema:
        """Require exactly one source for selectable options."""
        has_inline_options = self.options is not None
        has_dynamic_source = self.options_source is not None
        if has_inline_options == has_dynamic_source:
            raise ValueError(
                "select field must define exactly one of options or options_source"
            )
        if has_inline_options and self.options == []:
            raise ValueError("select field options must not be empty")
        return self


LiveRealtimeOptionFieldSchema = Annotated[
    LiveRealtimeSliderFieldSchema
    | LiveRealtimeNumberFieldSchema
    | LiveRealtimeNumberListFieldSchema
    | LiveRealtimeSwitchFieldSchema
    | LiveRealtimeTextareaFieldSchema
    | LiveRealtimeSelectFieldSchema,
    Field(discriminator="type"),
]


class LiveRealtimeOptionGroupSchema(BaseModel):
    """Group related Live realtime option fields under one UI section."""

    group: str
    group_label_key: str
    fields: list[LiveRealtimeOptionFieldSchema]


__all__ = [
    "CONTEXT_PROMPT_MAX_CHARS",
    "LiveRealtimeAdapter",
    "LiveRealtimeDefaults",
    "LiveRealtimeFieldDefaultValue",
    "LiveRealtimeMaxSpeechDuration",
    "LiveRealtimeNumberFieldSchema",
    "LiveRealtimeNumberListFieldSchema",
    "LiveRealtimeOptionFieldSchema",
    "LiveRealtimeOptionGroupSchema",
    "LiveRealtimeSelectFieldSchema",
    "LiveRealtimeSelectOptionSchema",
    "LiveRealtimeSliderFieldSchema",
    "LiveRealtimeSwitchFieldSchema",
    "LiveRealtimeTask",
    "LiveRealtimeTemperature",
    "LiveRealtimeTextareaFieldSchema",
    "LiveRealtimeVadParameters",
]
