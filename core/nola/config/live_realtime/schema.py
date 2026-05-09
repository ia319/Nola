"""Live realtime schema registry."""

from __future__ import annotations

from collections.abc import Sequence
from functools import cache
from typing import Literal, cast

from nola.config.live_realtime.defaults import (
    get_live_realtime_builtin_defaults,
    get_live_realtime_vad_parameter_keys,
)
from nola.config.live_realtime.types import (
    CONTEXT_PROMPT_MAX_CHARS,
    LiveRealtimeAdapter,
    LiveRealtimeFieldDefaultValue,
    LiveRealtimeNumberFieldSchema,
    LiveRealtimeNumberListFieldSchema,
    LiveRealtimeOptionFieldSchema,
    LiveRealtimeOptionGroupSchema,
    LiveRealtimeSelectFieldSchema,
    LiveRealtimeSelectOptionSchema,
    LiveRealtimeSliderFieldSchema,
    LiveRealtimeSwitchFieldSchema,
    LiveRealtimeTextareaFieldSchema,
)
from nola.engines.faster_whisper_defaults import SerializedDefaultValue

_WHISPER_STREAMING_ADAPTERS: list[LiveRealtimeAdapter] = ["whisper_streaming"]


@cache
def _schema_default_values() -> SerializedDefaultValue:
    """Return built-in defaults once for schema field construction."""
    return cast(SerializedDefaultValue, get_live_realtime_builtin_defaults())


def _default_value(key: str) -> LiveRealtimeFieldDefaultValue:
    """Return one built-in default value by dotted field path."""
    current = _schema_default_values()
    for part in key.split("."):
        if not isinstance(current, dict) or part not in current:
            raise KeyError(f"Unknown Live realtime default key: {key}")
        current = current[part]
    if isinstance(current, list):
        values: list[float] = []
        for item in current:
            if type(item) not in (int, float):
                raise TypeError(f"Live realtime default list must be numeric: {key}")
            values.append(float(cast(int | float, item)))
        return values
    if isinstance(current, str | int | float | bool) or current is None:
        return current
    raise TypeError(f"Live realtime default must be scalar or numeric list: {key}")


def _select(
    *,
    key: str,
    label_key: str,
    description_key: str,
    options: list[LiveRealtimeSelectOptionSchema] | None = None,
    options_source: Literal["effective_languages"] | None = None,
) -> LiveRealtimeSelectFieldSchema:
    return LiveRealtimeSelectFieldSchema(
        key=key,
        label_key=label_key,
        description_key=description_key,
        default_value=_default_value(key),
        supported_adapters=list(_WHISPER_STREAMING_ADAPTERS),
        type="select",
        options=options,
        options_source=options_source,
    )


def _textarea(
    *,
    key: str,
    label_key: str,
    description_key: str,
    max_length: int | None = None,
) -> LiveRealtimeTextareaFieldSchema:
    return LiveRealtimeTextareaFieldSchema(
        key=key,
        label_key=label_key,
        description_key=description_key,
        default_value=_default_value(key),
        supported_adapters=list(_WHISPER_STREAMING_ADAPTERS),
        type="textarea",
        max_length=max_length,
    )


def _slider(
    *,
    key: str,
    label_key: str,
    description_key: str,
    min_value: float,
    max_value: float,
    step: float,
    depends_on: str | None = None,
) -> LiveRealtimeSliderFieldSchema:
    return LiveRealtimeSliderFieldSchema(
        key=key,
        label_key=label_key,
        description_key=description_key,
        default_value=_default_value(key),
        supported_adapters=list(_WHISPER_STREAMING_ADAPTERS),
        depends_on=depends_on,
        type="slider",
        min=min_value,
        max=max_value,
        step=step,
    )


def _number(
    *,
    key: str,
    label_key: str,
    description_key: str,
    min_value: float | None = None,
    max_value: float | None = None,
    step: float | None = None,
    depends_on: str | None = None,
    special_values: list[str] | None = None,
) -> LiveRealtimeNumberFieldSchema:
    return LiveRealtimeNumberFieldSchema(
        key=key,
        label_key=label_key,
        description_key=description_key,
        default_value=_default_value(key),
        supported_adapters=list(_WHISPER_STREAMING_ADAPTERS),
        depends_on=depends_on,
        type="number",
        min=min_value,
        max=max_value,
        step=step,
        special_values=special_values,
    )


def _number_list(
    *,
    key: str,
    label_key: str,
    description_key: str,
    allow_negative: bool = False,
    collapse_single_value: bool = False,
) -> LiveRealtimeNumberListFieldSchema:
    return LiveRealtimeNumberListFieldSchema(
        key=key,
        label_key=label_key,
        description_key=description_key,
        default_value=_default_value(key),
        supported_adapters=list(_WHISPER_STREAMING_ADAPTERS),
        type="number_list",
        allow_negative=allow_negative,
        collapse_single_value=collapse_single_value,
    )


def _switch(
    *,
    key: str,
    label_key: str,
    description_key: str,
    depends_on: str | None = None,
) -> LiveRealtimeSwitchFieldSchema:
    return LiveRealtimeSwitchFieldSchema(
        key=key,
        label_key=label_key,
        description_key=description_key,
        default_value=_default_value(key),
        supported_adapters=list(_WHISPER_STREAMING_ADAPTERS),
        depends_on=depends_on,
        type="switch",
    )


def _build_live_realtime_param_schema() -> list[LiveRealtimeOptionGroupSchema]:
    """Build Live realtime field metadata with current built-in defaults."""
    return [
        LiveRealtimeOptionGroupSchema(
            group="common",
            group_label_key="liveRealtime.options.group.common",
            fields=[
                _select(
                    key="language",
                    label_key="liveRealtime.options.field.language",
                    description_key="liveRealtime.options.description.language",
                    options_source="effective_languages",
                ),
                _select(
                    key="task",
                    label_key="liveRealtime.options.field.task",
                    description_key="liveRealtime.options.description.task",
                    options=[
                        LiveRealtimeSelectOptionSchema(
                            value="transcribe",
                            label_key="liveRealtime.options.task.transcribe",
                        ),
                        LiveRealtimeSelectOptionSchema(
                            value="translate",
                            label_key="liveRealtime.options.task.translate",
                        ),
                    ],
                ),
                _textarea(
                    key="context_prompt",
                    label_key="liveRealtime.options.field.contextPrompt",
                    description_key="liveRealtime.options.description.contextPrompt",
                    max_length=CONTEXT_PROMPT_MAX_CHARS,
                ),
            ],
        ),
        LiveRealtimeOptionGroupSchema(
            group="whisperStreaming",
            group_label_key="liveRealtime.options.group.whisperStreaming",
            fields=[
                _slider(
                    key="min_chunk_ms",
                    label_key="liveRealtime.options.field.minChunkMs",
                    description_key="liveRealtime.options.description.minChunkMs",
                    min_value=100,
                    max_value=5000,
                    step=100,
                ),
                _slider(
                    key="buffer_trimming_ms",
                    label_key="liveRealtime.options.field.bufferTrimmingMs",
                    description_key=(
                        "liveRealtime.options.description.bufferTrimmingMs"
                    ),
                    min_value=1000,
                    max_value=60000,
                    step=1000,
                ),
                _number(
                    key="prompt_max_chars",
                    label_key="liveRealtime.options.field.promptMaxChars",
                    description_key="liveRealtime.options.description.promptMaxChars",
                    min_value=1,
                    max_value=2000,
                    step=50,
                ),
                _slider(
                    key="timestamp_tolerance_ms",
                    label_key="liveRealtime.options.field.timestampToleranceMs",
                    description_key=(
                        "liveRealtime.options.description.timestampToleranceMs"
                    ),
                    min_value=0,
                    max_value=1000,
                    step=10,
                ),
                _number(
                    key="max_duplicate_ngram",
                    label_key="liveRealtime.options.field.maxDuplicateNgram",
                    description_key=(
                        "liveRealtime.options.description.maxDuplicateNgram"
                    ),
                    min_value=1,
                    max_value=20,
                    step=1,
                ),
            ],
        ),
        LiveRealtimeOptionGroupSchema(
            group="silence",
            group_label_key="liveRealtime.options.group.silence",
            fields=[
                _number(
                    key="silence_rms_threshold",
                    label_key="liveRealtime.options.field.silenceRmsThreshold",
                    description_key=(
                        "liveRealtime.options.description.silenceRmsThreshold"
                    ),
                    min_value=0.001,
                    max_value=1,
                    step=0.001,
                ),
                _slider(
                    key="segment_close_silence_ms",
                    label_key="liveRealtime.options.field.segmentCloseSilenceMs",
                    description_key=(
                        "liveRealtime.options.description.segmentCloseSilenceMs"
                    ),
                    min_value=100,
                    max_value=10000,
                    step=100,
                ),
                _slider(
                    key="context_reset_silence_ms",
                    label_key="liveRealtime.options.field.contextResetSilenceMs",
                    description_key=(
                        "liveRealtime.options.description.contextResetSilenceMs"
                    ),
                    min_value=100,
                    max_value=60000,
                    step=100,
                ),
            ],
        ),
        LiveRealtimeOptionGroupSchema(
            group="fasterWhisper",
            group_label_key="liveRealtime.options.group.fasterWhisper",
            fields=[
                _slider(
                    key="beam_size",
                    label_key="liveRealtime.options.field.beamSize",
                    description_key="liveRealtime.options.description.beamSize",
                    min_value=1,
                    max_value=10,
                    step=1,
                ),
                _number(
                    key="best_of",
                    label_key="liveRealtime.options.field.bestOf",
                    description_key="liveRealtime.options.description.bestOf",
                    min_value=1,
                    max_value=10,
                    step=1,
                ),
                _number_list(
                    key="temperature",
                    label_key="liveRealtime.options.field.temperature",
                    description_key="liveRealtime.options.description.temperature",
                    collapse_single_value=True,
                ),
                _number(
                    key="compression_ratio_threshold",
                    label_key=("liveRealtime.options.field.compressionRatioThreshold"),
                    description_key=(
                        "liveRealtime.options.description.compressionRatioThreshold"
                    ),
                    step=0.1,
                ),
                _number(
                    key="log_prob_threshold",
                    label_key="liveRealtime.options.field.logProbThreshold",
                    description_key=(
                        "liveRealtime.options.description.logProbThreshold"
                    ),
                    step=0.1,
                ),
                _slider(
                    key="no_speech_threshold",
                    label_key="liveRealtime.options.field.noSpeechThreshold",
                    description_key=(
                        "liveRealtime.options.description.noSpeechThreshold"
                    ),
                    min_value=0,
                    max_value=1,
                    step=0.05,
                ),
                _switch(
                    key="condition_on_previous_text",
                    label_key=("liveRealtime.options.field.conditionOnPreviousText"),
                    description_key=(
                        "liveRealtime.options.description.conditionOnPreviousText"
                    ),
                ),
            ],
        ),
        LiveRealtimeOptionGroupSchema(
            group="vad",
            group_label_key="liveRealtime.options.group.vad",
            fields=[
                _switch(
                    key="vad_filter",
                    label_key="liveRealtime.options.field.vadFilter",
                    description_key="liveRealtime.options.description.vadFilter",
                ),
                _slider(
                    key="vad_parameters.threshold",
                    label_key="liveRealtime.options.field.vadThreshold",
                    description_key="liveRealtime.options.description.vadThreshold",
                    min_value=0,
                    max_value=1,
                    step=0.05,
                    depends_on="vad_filter",
                ),
                _slider(
                    key="vad_parameters.min_silence_duration_ms",
                    label_key="liveRealtime.options.field.vadMinSilenceDurationMs",
                    description_key=(
                        "liveRealtime.options.description.vadMinSilenceDurationMs"
                    ),
                    min_value=0,
                    max_value=5000,
                    step=100,
                    depends_on="vad_filter",
                ),
                _slider(
                    key="vad_parameters.speech_pad_ms",
                    label_key="liveRealtime.options.field.vadSpeechPadMs",
                    description_key="liveRealtime.options.description.vadSpeechPadMs",
                    min_value=0,
                    max_value=1000,
                    step=50,
                    depends_on="vad_filter",
                ),
            ],
        ),
        LiveRealtimeOptionGroupSchema(
            group="vadAdvanced",
            group_label_key="liveRealtime.options.group.vadAdvanced",
            fields=[
                _slider(
                    key="vad_parameters.neg_threshold",
                    label_key="liveRealtime.options.field.vadNegThreshold",
                    description_key="liveRealtime.options.description.vadNegThreshold",
                    min_value=0,
                    max_value=1,
                    step=0.05,
                    depends_on="vad_filter",
                ),
                _number(
                    key="vad_parameters.min_speech_duration_ms",
                    label_key="liveRealtime.options.field.vadMinSpeechDurationMs",
                    description_key=(
                        "liveRealtime.options.description.vadMinSpeechDurationMs"
                    ),
                    min_value=0,
                    max_value=10000,
                    step=1,
                    depends_on="vad_filter",
                ),
                _number(
                    key="vad_parameters.max_speech_duration_s",
                    label_key="liveRealtime.options.field.vadMaxSpeechDurationS",
                    description_key=(
                        "liveRealtime.options.description.vadMaxSpeechDurationS"
                    ),
                    min_value=0,
                    step=1,
                    depends_on="vad_filter",
                    special_values=["inf"],
                ),
            ],
        ),
    ]


def _field_is_supported(field: LiveRealtimeOptionFieldSchema) -> bool:
    """Keep schema fields aligned with the installed faster-whisper contract."""
    if not field.key.startswith("vad_parameters."):
        return True
    nested_key = field.key.split(".", maxsplit=1)[1]
    return nested_key in get_live_realtime_vad_parameter_keys()


def _filter_supported_fields(
    fields: Sequence[LiveRealtimeOptionFieldSchema],
) -> list[LiveRealtimeOptionFieldSchema]:
    """Return the fields supported by the installed runtime dependencies."""
    return [field for field in fields if _field_is_supported(field)]


def get_live_realtime_param_schema() -> list[LiveRealtimeOptionGroupSchema]:
    """Return a defensive copy of the Live realtime field metadata."""
    schema = _build_live_realtime_param_schema()
    filtered: list[LiveRealtimeOptionGroupSchema] = []
    for group in schema:
        filtered_fields = _filter_supported_fields(group.fields)
        if filtered_fields:
            filtered.append(
                group.model_copy(
                    update={
                        "fields": [
                            field.model_copy(deep=True) for field in filtered_fields
                        ]
                    },
                    deep=False,
                )
            )
    return filtered


__all__ = [
    "get_live_realtime_param_schema",
]
