"""Response models for transcription-related configuration APIs."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from nola.api.schemas.models import ModelConfigResponse
from nola.config.constants import ALLOWED_AUDIO_TYPES, ALLOWED_EXTENSIONS
from nola.config.settings import settings
from nola.config.transcription.languages import LanguageOptionSchema
from nola.config.transcription.schema.models import OptionGroupSchema
from nola.engines.base import EngineComputeType, EngineDevice


class EngineConfigResponse(BaseModel):
    """Expose the active engine configuration."""

    model_config = ConfigDict(populate_by_name=True)

    model_size: str
    device: EngineDevice
    compute_type: EngineComputeType
    is_multilingual: bool
    schema_: list[OptionGroupSchema] = Field(
        alias="schema",
        serialization_alias="schema",
    )


class FileConfigResponse(BaseModel):
    """Expose upload-related configuration needed by the frontend."""

    allowed_extensions: list[str]
    allowed_mime_types: list[str]
    max_file_size: int


class VadParametersDefaultsResponse(BaseModel):
    """Expose expanded VAD defaults in API-safe form."""

    threshold: float
    neg_threshold: float | None
    min_speech_duration_ms: int
    max_speech_duration_s: float | Literal["inf"]
    min_silence_duration_ms: int
    speech_pad_ms: int
    min_silence_at_max_speech: int | None = None
    use_max_poss_sil_at_max_speech: bool | None = None


class TranscriptionResolvedDefaultsResponse(BaseModel):
    """Expose fully resolved transcription defaults used at runtime."""

    language: str | None
    task: str
    beam_size: int
    best_of: int
    patience: float
    length_penalty: float
    repetition_penalty: float
    no_repeat_ngram_size: int
    temperature: float | list[float]
    compression_ratio_threshold: float | None
    log_prob_threshold: float | None
    no_speech_threshold: float | None
    condition_on_previous_text: bool
    prompt_reset_on_temperature: float
    initial_prompt: str | None
    prefix: str | None
    hotwords: str | None
    suppress_blank: bool
    suppress_tokens: list[int] | None
    max_new_tokens: int | None
    without_timestamps: bool
    max_initial_timestamp: float
    word_timestamps: bool
    prepend_punctuations: str
    append_punctuations: str
    vad_filter: bool
    vad_parameters: VadParametersDefaultsResponse
    multilingual: bool
    chunk_length: int | None
    clip_timestamps: str | list[float]
    hallucination_silence_threshold: float | None
    language_detection_threshold: float | None
    language_detection_segments: int


class TranscriptionConfigResponse(BaseModel):
    """Expose effective transcription defaults and field metadata."""

    model_config = ConfigDict(populate_by_name=True)

    defaults: TranscriptionResolvedDefaultsResponse
    schema_: list[OptionGroupSchema] = Field(
        alias="schema",
        serialization_alias="schema",
    )


class AppConfigResponse(BaseModel):
    """Aggregate application configuration required by the frontend."""

    engine: EngineConfigResponse
    transcription: TranscriptionConfigResponse
    file: FileConfigResponse
    effective_languages: list[LanguageOptionSchema]
    model: ModelConfigResponse | None = None


class EngineDefaultsResponse(BaseModel):
    """Return the raw engine defaults without application overrides."""

    defaults: TranscriptionResolvedDefaultsResponse


class TranscriptionDefaultsPatchResponse(BaseModel):
    """Return the effective defaults after a PATCH update."""

    defaults: TranscriptionResolvedDefaultsResponse


def build_file_config() -> FileConfigResponse:
    """Return upload constraints in a frontend-friendly format."""
    return FileConfigResponse(
        allowed_extensions=sorted(ALLOWED_EXTENSIONS),
        allowed_mime_types=sorted(ALLOWED_AUDIO_TYPES),
        max_file_size=settings.max_file_size,
    )


__all__ = [
    "AppConfigResponse",
    "build_file_config",
    "EngineConfigResponse",
    "EngineDefaultsResponse",
    "FileConfigResponse",
    "TranscriptionConfigResponse",
    "TranscriptionDefaultsPatchResponse",
    "TranscriptionResolvedDefaultsResponse",
    "VadParametersDefaultsResponse",
]
