"""Transcription-related Pydantic schemas."""

from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

from nola.api.schemas.validators import validate_language_code, validate_temperature
from nola.config.constants import MAX_BATCH_EXPORT_TASKS
from nola.engines.base import TranscribeOptions

_ENGINE_DEFAULTS = TranscribeOptions()


def _swagger_default(value: Any) -> dict[str, Any]:
    """Keep Swagger defaults aligned with engine defaults."""
    if value is None:
        return {"default": value}
    return {"default": value, "examples": [value]}


class TranscriptionRequest(BaseModel):
    """Transcription request with optional parameters.

    All parameters default to None, meaning "use engine default".
    See TranscribeOptions in engines/base.py for actual defaults.
    """

    file_id: str = Field(..., description="File ID from upload API")

    # Language settings
    language: str | None = Field(
        None,
        description="Language code. Auto-detect if omitted.",
        json_schema_extra={"examples": ["en", "zh", "ja"]},
    )
    task: Literal["transcribe", "translate"] | None = Field(
        None, description="'transcribe' or 'translate'"
    )

    # Decoding parameters
    beam_size: int | None = Field(
        None, ge=1, le=10, description="Beam size for decoding"
    )
    best_of: int | None = Field(None, ge=1, description="Number of candidates")
    patience: float | None = Field(None, ge=0, description="Beam search patience")
    length_penalty: float | None = Field(None, description="Length penalty")
    repetition_penalty: float | None = Field(
        None, ge=1, description="Repetition penalty"
    )
    no_repeat_ngram_size: int | None = Field(
        None, ge=0, description="No repeat n-gram size"
    )
    temperature: float | list[float] | None = Field(
        None, description="Sampling temperature(s)"
    )

    # Quality thresholds
    compression_ratio_threshold: float | None = Field(
        None, description="Compression ratio threshold"
    )
    log_prob_threshold: float | None = Field(
        None, description="Log probability threshold"
    )
    no_speech_threshold: float | None = Field(None, description="No speech threshold")

    # Context control
    condition_on_previous_text: bool | None = Field(
        None, description="Condition on previous text"
    )
    prompt_reset_on_temperature: float | None = Field(
        None, description="Reset prompt on temperature"
    )
    initial_prompt: str | None = Field(
        None,
        description="Initial prompt for context",
        json_schema_extra=_swagger_default(_ENGINE_DEFAULTS.initial_prompt),
    )
    prefix: str | None = Field(
        None,
        description="Prefix for each segment",
        json_schema_extra=_swagger_default(_ENGINE_DEFAULTS.prefix),
    )
    hotwords: str | None = Field(
        None,
        description="Hotwords to boost recognition",
        json_schema_extra=_swagger_default(_ENGINE_DEFAULTS.hotwords),
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
    vad_filter: bool | None = Field(None, description="Enable VAD filtering")
    vad_parameters: dict[str, Any] | None = Field(None, description="VAD parameters")

    # Advanced
    multilingual: bool | None = Field(None, description="Enable multilingual mode")
    clip_timestamps: str | list[float] | None = Field(
        None, description="Clip timestamps"
    )
    hallucination_silence_threshold: float | None = Field(
        None, description="Hallucination silence threshold"
    )
    language_detection_threshold: float | None = Field(
        None, description="Language detection threshold"
    )
    language_detection_segments: int | None = Field(
        None, description="Segments for language detection"
    )

    @field_validator("language")
    @classmethod
    def check_language(cls, v: str | None) -> str | None:
        """Reject unsupported language codes early."""
        return validate_language_code(v)

    @field_validator("temperature")
    @classmethod
    def check_temperature(
        cls, v: float | list[float] | None
    ) -> float | list[float] | None:
        """Reject negative temperature values."""
        return validate_temperature(v)

    def get_options_dict(self) -> dict[str, Any]:
        """Return non-None options as dict for storage."""
        return self.model_dump(exclude={"file_id"}, exclude_none=True)


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
