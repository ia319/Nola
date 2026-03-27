"""Consistency tests for transcription contracts across engine/API/UI layers."""

from dataclasses import fields as dataclass_fields

from nola.api.schemas.transcriptions import (
    TranscriptionOptionsPayload,
    VadParametersRequest,
)
from nola.config.transcription import get_transcription_param_schema
from nola.config.transcription.contracts import (
    get_allowed_task_values,
    get_allowed_vad_parameter_keys,
)
from nola.engines.base import TranscribeOptions


def _extract_bounds(field_info: object) -> tuple[float | None, float | None]:
    """Extract ge/le constraints from Pydantic field metadata."""
    ge_value: float | None = None
    le_value: float | None = None

    metadata = getattr(field_info, "metadata", ())
    for item in metadata:
        ge = getattr(item, "ge", None)
        if ge is not None:
            ge_value = float(ge)
        le = getattr(item, "le", None)
        if le is not None:
            le_value = float(le)

    return ge_value, le_value


def _get_api_range_constraints() -> dict[str, tuple[float | None, float | None]]:
    """Collect coarse API bounds for top-level and nested VAD fields."""
    bounds: dict[str, tuple[float | None, float | None]] = {}

    for key, field_info in TranscriptionOptionsPayload.model_fields.items():
        ge_value, le_value = _extract_bounds(field_info)
        if ge_value is not None or le_value is not None:
            bounds[key] = (ge_value, le_value)

    for key, field_info in VadParametersRequest.model_fields.items():
        ge_value, le_value = _extract_bounds(field_info)
        if ge_value is not None or le_value is not None:
            bounds[f"vad_parameters.{key}"] = (ge_value, le_value)

    # VadParametersRequest.check_max_speech_duration_s enforces non-negative values
    # while still allowing the "inf" sentinel.
    bounds["vad_parameters.max_speech_duration_s"] = (0.0, None)
    return bounds


def _get_metadata_range_constraints() -> dict[str, tuple[float | None, float | None]]:
    """Collect UI min/max bounds from schema fields."""
    bounds: dict[str, tuple[float | None, float | None]] = {}

    for group in get_transcription_param_schema():
        for field in group.fields:
            if field.type not in {"slider", "number"}:
                continue

            min_value = getattr(field, "min", None)
            max_value = getattr(field, "max", None)
            if min_value is None and max_value is None:
                continue

            bounds[field.key] = (
                float(min_value) if min_value is not None else None,
                float(max_value) if max_value is not None else None,
            )

    return bounds


def test_engine_and_api_option_fields_stay_aligned() -> None:
    """Engine option fields should match API option payload fields."""
    engine_keys = {field.name for field in dataclass_fields(TranscribeOptions)}
    api_keys = set(TranscriptionOptionsPayload.model_fields)

    assert engine_keys == api_keys


def test_task_contract_values_match_ui_metadata_options() -> None:
    """Shared task-value contract should match UI task select options."""
    schema = get_transcription_param_schema()
    task_field = next(
        (
            field
            for group in schema
            for field in group.fields
            if field.type == "select" and field.key == "task"
        ),
        None,
    )

    assert task_field is not None, "UI schema missing 'task' select field"
    assert task_field.options is not None
    metadata_values = {option.value.lower() for option in task_field.options}
    assert metadata_values == get_allowed_task_values()


def test_vad_contract_keys_match_ui_metadata_fields() -> None:
    """Shared VAD-key contract should match UI VAD field definitions."""
    schema = get_transcription_param_schema()
    metadata_keys = {
        field.key.split(".", maxsplit=1)[1]
        for group in schema
        if group.group in {"vad", "vad_advanced"}
        for field in group.fields
        if field.key.startswith("vad_parameters.")
    }

    assert metadata_keys == get_allowed_vad_parameter_keys()


def test_ui_ranges_remain_subset_of_api_ranges() -> None:
    """UI field bounds should remain within API coarse validation bounds."""
    api_bounds = _get_api_range_constraints()
    metadata_bounds = _get_metadata_range_constraints()

    for key, (ui_min, ui_max) in metadata_bounds.items():
        assert key in api_bounds
        api_min, api_max = api_bounds[key]

        if ui_min is not None and api_min is not None:
            assert ui_min >= api_min

        if ui_max is not None and api_max is not None:
            assert ui_max <= api_max
