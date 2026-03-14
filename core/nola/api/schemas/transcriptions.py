"""Transcription-related Pydantic schemas."""

from dataclasses import asdict
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from nola.api.schemas.validators import (
    validate_language_code,
    validate_task_value,
    validate_temperature,
    validate_vad_parameter_keys,
)
from nola.config.constants import MAX_BATCH_EXPORT_TASKS
from nola.engines.base import TranscribeOptions

_ENGINE_DEFAULTS = TranscribeOptions()


def _swagger_default(value: Any) -> dict[str, Any]:
    """Keep Swagger examples aligned with engine defaults."""
    return {"example": value}


def _create_task_example() -> dict[str, Any]:
    """Build a complete create-task example with runtime value types."""
    return {"file_id": "uploaded-file-id", **asdict(_ENGINE_DEFAULTS)}


def _defaults_patch_example() -> dict[str, Any]:
    """Build a sparse PATCH example that demonstrates partial-update semantics."""
    return {
        "beam_size": 3,
        "language": "zh",
        "vad_parameters": {"threshold": 0.6},
        "hotwords": None,
    }


class VadParametersRequest(BaseModel):
    """Typed VAD payload for task creation and defaults updates."""

    model_config = ConfigDict(extra="forbid")

    threshold: float | None = Field(None, ge=0, le=1)
    neg_threshold: float | None = Field(None, ge=0, le=1)
    min_speech_duration_ms: int | None = Field(None, ge=0)
    max_speech_duration_s: float | Literal["inf"] | None = None
    min_silence_duration_ms: int | None = Field(None, ge=0)
    speech_pad_ms: int | None = Field(None, ge=0)
    min_silence_at_max_speech: int | None = Field(None, ge=0)
    use_max_poss_sil_at_max_speech: bool | None = None

    @model_validator(mode="before")
    @classmethod
    def check_supported_keys(cls, value: Any) -> Any:
        """Reject runtime-unsupported keys before field parsing."""
        if isinstance(value, dict):
            validate_vad_parameter_keys(value)
        return value

    @field_validator("max_speech_duration_s")
    @classmethod
    def check_max_speech_duration_s(
        cls, value: float | Literal["inf"] | None
    ) -> float | Literal["inf"] | None:
        """Keep VAD max speech duration non-negative while allowing the inf sentinel."""
        if value is None or value == "inf":
            return value
        if value < 0:
            raise ValueError("max_speech_duration_s must be non-negative.")
        return value


class TranscriptionOptionsPayload(BaseModel):
    """Shared optional transcription parameters for task and defaults APIs.

    All parameters default to None, meaning "use engine default".
    See TranscribeOptions in engines/base.py for actual defaults.
    """

    model_config = ConfigDict(extra="forbid")

    # Language settings
    language: str | None = Field(
        None,
        description="Language code. Auto-detect if omitted.",
        json_schema_extra={
            **_swagger_default(_ENGINE_DEFAULTS.language),
            "examples": ["en", "zh", "ja"],
        },
    )
    task: str | None = Field(
        None,
        description="Task value defined by backend transcription schema",
        json_schema_extra=_swagger_default(_ENGINE_DEFAULTS.task),
    )

    # Decoding parameters
    beam_size: int | None = Field(
        None,
        ge=1,
        le=10,
        description="Beam size for decoding",
        json_schema_extra=_swagger_default(_ENGINE_DEFAULTS.beam_size),
    )
    best_of: int | None = Field(
        None,
        ge=1,
        description="Number of candidates",
        json_schema_extra=_swagger_default(_ENGINE_DEFAULTS.best_of),
    )
    patience: float | None = Field(
        None,
        ge=0,
        description="Beam search patience",
        json_schema_extra=_swagger_default(_ENGINE_DEFAULTS.patience),
    )
    length_penalty: float | None = Field(
        None,
        description="Length penalty",
        json_schema_extra=_swagger_default(_ENGINE_DEFAULTS.length_penalty),
    )
    repetition_penalty: float | None = Field(
        None,
        ge=1,
        description="Repetition penalty",
        json_schema_extra=_swagger_default(_ENGINE_DEFAULTS.repetition_penalty),
    )
    no_repeat_ngram_size: int | None = Field(
        None,
        ge=0,
        description="No repeat n-gram size",
        json_schema_extra=_swagger_default(_ENGINE_DEFAULTS.no_repeat_ngram_size),
    )
    temperature: float | list[float] | None = Field(
        None,
        description="Sampling temperature(s)",
        json_schema_extra=_swagger_default(_ENGINE_DEFAULTS.temperature),
    )

    # Quality thresholds
    compression_ratio_threshold: float | None = Field(
        None,
        description="Compression ratio threshold",
        json_schema_extra=_swagger_default(
            _ENGINE_DEFAULTS.compression_ratio_threshold
        ),
    )
    log_prob_threshold: float | None = Field(
        None,
        description="Log probability threshold",
        json_schema_extra=_swagger_default(_ENGINE_DEFAULTS.log_prob_threshold),
    )
    no_speech_threshold: float | None = Field(
        None,
        ge=0,
        le=1,
        description="No speech threshold",
        json_schema_extra=_swagger_default(_ENGINE_DEFAULTS.no_speech_threshold),
    )

    # Context control
    condition_on_previous_text: bool | None = Field(
        None,
        description="Condition on previous text",
        json_schema_extra=_swagger_default(_ENGINE_DEFAULTS.condition_on_previous_text),
    )
    prompt_reset_on_temperature: float | None = Field(
        None,
        ge=0,
        description="Reset prompt on temperature",
        json_schema_extra=_swagger_default(
            _ENGINE_DEFAULTS.prompt_reset_on_temperature
        ),
    )
    initial_prompt: str | None = Field(
        None,
        description="Initial prompt for context",
        json_schema_extra={"example": ""},
    )
    prefix: str | None = Field(
        None,
        description="Prefix for each segment",
        json_schema_extra={"example": ""},
    )
    hotwords: str | None = Field(
        None,
        description="Hotwords to boost recognition",
        json_schema_extra={"example": ""},
    )

    # Token control
    suppress_blank: bool | None = Field(
        None,
        description="Suppress blank outputs",
        json_schema_extra=_swagger_default(_ENGINE_DEFAULTS.suppress_blank),
    )
    suppress_tokens: list[int] | None = Field(
        None,
        description="Token IDs to suppress",
        json_schema_extra=_swagger_default(_ENGINE_DEFAULTS.suppress_tokens),
    )
    max_new_tokens: int | None = Field(
        None,
        ge=1,
        description="Max new tokens per segment",
        json_schema_extra=_swagger_default(_ENGINE_DEFAULTS.max_new_tokens),
    )

    # Timestamp settings
    without_timestamps: bool | None = Field(
        None,
        description="Disable timestamps",
        json_schema_extra=_swagger_default(_ENGINE_DEFAULTS.without_timestamps),
    )
    max_initial_timestamp: float | None = Field(
        None,
        ge=0,
        description="Max initial timestamp",
        json_schema_extra=_swagger_default(_ENGINE_DEFAULTS.max_initial_timestamp),
    )
    word_timestamps: bool | None = Field(
        None,
        description="Enable word-level timestamps",
        json_schema_extra=_swagger_default(_ENGINE_DEFAULTS.word_timestamps),
    )
    prepend_punctuations: str | None = Field(
        None,
        description="Punctuations to prepend",
        json_schema_extra=_swagger_default(_ENGINE_DEFAULTS.prepend_punctuations),
    )
    append_punctuations: str | None = Field(
        None,
        description="Punctuations to append",
        json_schema_extra=_swagger_default(_ENGINE_DEFAULTS.append_punctuations),
    )

    # VAD settings
    vad_filter: bool | None = Field(
        None,
        description="Enable VAD filtering",
        json_schema_extra=_swagger_default(_ENGINE_DEFAULTS.vad_filter),
    )
    vad_parameters: VadParametersRequest | None = Field(
        None,
        description="VAD parameters",
        json_schema_extra=_swagger_default(_ENGINE_DEFAULTS.vad_parameters),
    )

    # Advanced
    multilingual: bool | None = Field(
        None,
        description="Enable multilingual mode",
        json_schema_extra=_swagger_default(_ENGINE_DEFAULTS.multilingual),
    )
    chunk_length: int | None = Field(
        None,
        ge=1,
        description="Chunk length in seconds",
        json_schema_extra=_swagger_default(_ENGINE_DEFAULTS.chunk_length),
    )
    clip_timestamps: str | list[float] | None = Field(
        None,
        description="Clip timestamps",
        json_schema_extra=_swagger_default(_ENGINE_DEFAULTS.clip_timestamps),
    )
    hallucination_silence_threshold: float | None = Field(
        None,
        ge=0,
        description="Hallucination silence threshold",
        json_schema_extra=_swagger_default(
            _ENGINE_DEFAULTS.hallucination_silence_threshold
        ),
    )
    language_detection_threshold: float | None = Field(
        None,
        ge=0,
        le=1,
        description="Language detection threshold",
        json_schema_extra=_swagger_default(
            _ENGINE_DEFAULTS.language_detection_threshold
        ),
    )
    language_detection_segments: int | None = Field(
        None,
        ge=1,
        description="Segments for language detection",
        json_schema_extra=_swagger_default(
            _ENGINE_DEFAULTS.language_detection_segments
        ),
    )

    @field_validator("language")
    @classmethod
    def check_language(cls, v: str | None) -> str | None:
        """Reject unsupported language codes early."""
        return validate_language_code(v)

    @field_validator("task")
    @classmethod
    def check_task(cls, v: str | None) -> str | None:
        """Reject task values not exposed by runtime transcription metadata."""
        return validate_task_value(v)

    @field_validator("temperature")
    @classmethod
    def check_temperature(
        cls, v: float | list[float] | None
    ) -> float | list[float] | None:
        """Reject negative temperature values."""
        return validate_temperature(v)

    def get_options_dict(self) -> dict[str, Any]:
        """Return non-None options as dict for storage."""
        return self.model_dump(exclude_none=True)


class TranscriptionRequest(TranscriptionOptionsPayload):
    """Transcription request payload for creating a task."""

    model_config = ConfigDict(json_schema_extra={"example": _create_task_example()})

    file_id: str = Field(..., description="File ID from upload API")

    def get_options_dict(self) -> dict[str, Any]:
        """Return non-None transcription options without the file identifier."""
        return self.model_dump(exclude={"file_id"}, exclude_none=True)


class TranscriptionDefaultsUpdateRequest(TranscriptionOptionsPayload):
    """Partial update payload for application-level transcription defaults."""

    model_config = ConfigDict(json_schema_extra={"example": _defaults_patch_example()})

    def get_options_dict(self) -> dict[str, Any]:
        """Return explicitly provided keys, preserving nulls for field resets."""
        return self.model_dump(exclude_unset=True)


class BatchExportRequest(BaseModel):
    """Batch export request for multiple transcriptions."""

    task_ids: list[str] = Field(
        ...,
        min_length=1,
        max_length=MAX_BATCH_EXPORT_TASKS,
        description="List of task IDs to export",
    )
    format: Literal["srt", "vtt", "txt", "ass"] = Field(
        "srt", description="Output format for all files"
    )
    include_timestamps: bool = Field(
        True, description="Include timestamps in TXT format"
    )
    zip_name: str | None = Field(
        None, description="Custom ZIP filename (without extension)"
    )
