"""Transcription configuration metadata and response models."""

from __future__ import annotations

from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from nola.config.constants import ALLOWED_AUDIO_TYPES, ALLOWED_EXTENSIONS
from nola.config.settings import settings
from nola.config.transcription.languages import LanguageOptionSchema


class SliderFieldSchema(BaseModel):
    """Describe a slider-backed numeric field."""

    key: str
    label_key: str
    type: Literal["slider"]
    min: float
    max: float
    step: float
    depends_on: str | None = None


class SwitchFieldSchema(BaseModel):
    """Describe a boolean toggle field."""

    key: str
    label_key: str
    type: Literal["switch"]
    depends_on: str | None = None


class NumberFieldSchema(BaseModel):
    """Describe a numeric text input field."""

    key: str
    label_key: str
    type: Literal["number"]
    min: float | None = None
    max: float | None = None
    step: float | None = None
    depends_on: str | None = None
    special_values: list[str] | None = None


class NumberListFieldSchema(BaseModel):
    """Describe a comma-separated numeric list field."""

    key: str
    label_key: str
    type: Literal["number_list"]
    depends_on: str | None = None


class TextFieldSchema(BaseModel):
    """Describe a free-form text field."""

    key: str
    label_key: str
    type: Literal["text"]
    depends_on: str | None = None


OptionFieldSchema = Annotated[
    SliderFieldSchema
    | SwitchFieldSchema
    | NumberFieldSchema
    | NumberListFieldSchema
    | TextFieldSchema,
    Field(discriminator="type"),
]


class OptionGroupSchema(BaseModel):
    """Group related option fields under one UI section."""

    group: str
    group_label_key: str
    fields: list[OptionFieldSchema]


class EngineConfigResponse(BaseModel):
    """Expose the active engine configuration."""

    model_size: str
    device: str
    compute_type: str
    is_multilingual: bool


class FileConfigResponse(BaseModel):
    """Expose upload-related configuration needed by the frontend."""

    allowed_extensions: list[str]
    allowed_mime_types: list[str]
    max_file_size: int


class TranscriptionConfigResponse(BaseModel):
    """Expose effective transcription defaults and field metadata."""

    model_config = ConfigDict(populate_by_name=True)

    defaults: dict[str, Any]
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


class EngineDefaultsResponse(BaseModel):
    """Return the raw engine defaults without application overrides."""

    defaults: dict[str, Any]


class TranscriptionDefaultsPatchResponse(BaseModel):
    """Return the effective defaults after a PATCH update."""

    defaults: dict[str, Any]


_TRANSCRIPTION_PARAM_SCHEMA: list[OptionGroupSchema] = [
    OptionGroupSchema(
        group="decoding",
        group_label_key="options.group.decoding",
        fields=[
            SliderFieldSchema(
                key="beam_size",
                label_key="options.field.beamSize",
                type="slider",
                min=1,
                max=10,
                step=1,
            ),
            NumberFieldSchema(
                key="best_of",
                label_key="options.field.bestOf",
                type="number",
                min=1,
                step=1,
            ),
            NumberFieldSchema(
                key="patience",
                label_key="options.field.patience",
                type="number",
                min=0,
                step=0.1,
            ),
            NumberFieldSchema(
                key="length_penalty",
                label_key="options.field.lengthPenalty",
                type="number",
                step=0.1,
            ),
            NumberFieldSchema(
                key="repetition_penalty",
                label_key="options.field.repetitionPenalty",
                type="number",
                min=1,
                step=0.1,
            ),
            NumberFieldSchema(
                key="no_repeat_ngram_size",
                label_key="options.field.noRepeatNgramSize",
                type="number",
                min=0,
                step=1,
            ),
            NumberListFieldSchema(
                key="temperature",
                label_key="options.field.temperature",
                type="number_list",
            ),
        ],
    ),
    OptionGroupSchema(
        group="quality",
        group_label_key="options.group.quality",
        fields=[
            NumberFieldSchema(
                key="compression_ratio_threshold",
                label_key="options.field.compressionRatioThreshold",
                type="number",
                step=0.1,
            ),
            NumberFieldSchema(
                key="log_prob_threshold",
                label_key="options.field.logProbThreshold",
                type="number",
                step=0.1,
            ),
            SliderFieldSchema(
                key="no_speech_threshold",
                label_key="options.field.noSpeechThreshold",
                type="slider",
                min=0,
                max=1,
                step=0.05,
            ),
        ],
    ),
    OptionGroupSchema(
        group="context",
        group_label_key="options.group.context",
        fields=[
            SwitchFieldSchema(
                key="condition_on_previous_text",
                label_key="options.field.conditionOnPreviousText",
                type="switch",
            ),
            SliderFieldSchema(
                key="prompt_reset_on_temperature",
                label_key="options.field.promptResetOnTemperature",
                type="slider",
                min=0,
                max=1,
                step=0.05,
            ),
            TextFieldSchema(
                key="initial_prompt",
                label_key="options.field.initialPrompt",
                type="text",
            ),
            TextFieldSchema(
                key="prefix",
                label_key="options.field.prefix",
                type="text",
            ),
            TextFieldSchema(
                key="hotwords",
                label_key="options.field.hotwords",
                type="text",
            ),
        ],
    ),
    OptionGroupSchema(
        group="token_control",
        group_label_key="options.group.tokenControl",
        fields=[
            SwitchFieldSchema(
                key="suppress_blank",
                label_key="options.field.suppressBlank",
                type="switch",
            ),
            NumberListFieldSchema(
                key="suppress_tokens",
                label_key="options.field.suppressTokens",
                type="number_list",
            ),
            NumberFieldSchema(
                key="max_new_tokens",
                label_key="options.field.maxNewTokens",
                type="number",
                min=1,
                step=1,
            ),
        ],
    ),
    OptionGroupSchema(
        group="timestamps",
        group_label_key="options.group.timestamps",
        fields=[
            SwitchFieldSchema(
                key="without_timestamps",
                label_key="options.field.withoutTimestamps",
                type="switch",
            ),
            NumberFieldSchema(
                key="max_initial_timestamp",
                label_key="options.field.maxInitialTimestamp",
                type="number",
                min=0,
                step=0.1,
            ),
            SwitchFieldSchema(
                key="word_timestamps",
                label_key="options.field.wordTimestamps",
                type="switch",
            ),
            TextFieldSchema(
                key="prepend_punctuations",
                label_key="options.field.prependPunctuations",
                type="text",
            ),
            TextFieldSchema(
                key="append_punctuations",
                label_key="options.field.appendPunctuations",
                type="text",
            ),
            TextFieldSchema(
                key="clip_timestamps",
                label_key="options.field.clipTimestamps",
                type="text",
            ),
        ],
    ),
    OptionGroupSchema(
        group="vad",
        group_label_key="options.group.vad",
        fields=[
            SwitchFieldSchema(
                key="vad_filter",
                label_key="options.field.vadFilter",
                type="switch",
            ),
            SliderFieldSchema(
                key="vad_parameters.threshold",
                label_key="options.field.vadThreshold",
                type="slider",
                min=0,
                max=1,
                step=0.05,
                depends_on="vad_filter",
            ),
            SliderFieldSchema(
                key="vad_parameters.min_silence_duration_ms",
                label_key="options.field.vadMinSilenceDurationMs",
                type="slider",
                min=0,
                max=5000,
                step=100,
                depends_on="vad_filter",
            ),
            SliderFieldSchema(
                key="vad_parameters.speech_pad_ms",
                label_key="options.field.vadSpeechPadMs",
                type="slider",
                min=0,
                max=1000,
                step=50,
                depends_on="vad_filter",
            ),
        ],
    ),
    OptionGroupSchema(
        group="vad_advanced",
        group_label_key="options.group.vadAdvanced",
        fields=[
            SliderFieldSchema(
                key="vad_parameters.neg_threshold",
                label_key="options.field.vadNegThreshold",
                type="slider",
                min=0,
                max=1,
                step=0.05,
                depends_on="vad_filter",
            ),
            NumberFieldSchema(
                key="vad_parameters.min_speech_duration_ms",
                label_key="options.field.vadMinSpeechDurationMs",
                type="number",
                min=0,
                max=10000,
                step=1,
                depends_on="vad_filter",
            ),
            NumberFieldSchema(
                key="vad_parameters.max_speech_duration_s",
                label_key="options.field.vadMaxSpeechDurationS",
                type="number",
                min=0,
                step=1,
                depends_on="vad_filter",
                special_values=["inf"],
            ),
            NumberFieldSchema(
                key="vad_parameters.min_silence_at_max_speech",
                label_key="options.field.vadMinSilenceAtMaxSpeech",
                type="number",
                min=0,
                max=10000,
                step=1,
                depends_on="vad_filter",
            ),
            SwitchFieldSchema(
                key="vad_parameters.use_max_poss_sil_at_max_speech",
                label_key="options.field.vadUseMaxPossibleSilenceAtMaxSpeech",
                type="switch",
                depends_on="vad_filter",
            ),
        ],
    ),
    OptionGroupSchema(
        group="advanced",
        group_label_key="options.group.advanced",
        fields=[
            SwitchFieldSchema(
                key="multilingual",
                label_key="options.field.multilingual",
                type="switch",
            ),
            NumberFieldSchema(
                key="chunk_length",
                label_key="options.field.chunkLength",
                type="number",
                min=1,
                step=1,
            ),
            NumberFieldSchema(
                key="hallucination_silence_threshold",
                label_key="options.field.hallucinationSilenceThreshold",
                type="number",
                min=0,
                step=0.1,
            ),
            SliderFieldSchema(
                key="language_detection_threshold",
                label_key="options.field.languageDetectionThreshold",
                type="slider",
                min=0,
                max=1,
                step=0.05,
            ),
            NumberFieldSchema(
                key="language_detection_segments",
                label_key="options.field.languageDetectionSegments",
                type="number",
                min=1,
                step=1,
            ),
        ],
    ),
]


def get_transcription_param_schema() -> list[OptionGroupSchema]:
    """Return a defensive copy of the transcription field metadata."""
    return [group.model_copy(deep=True) for group in _TRANSCRIPTION_PARAM_SCHEMA]


def build_file_config() -> FileConfigResponse:
    """Return upload constraints in a frontend-friendly format."""
    return FileConfigResponse(
        allowed_extensions=sorted(ALLOWED_EXTENSIONS),
        allowed_mime_types=sorted(ALLOWED_AUDIO_TYPES),
        max_file_size=settings.max_file_size,
    )
