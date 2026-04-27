"""Tests for transcription request schemas and default option alignment."""

from dataclasses import asdict

import pytest
from pydantic import ValidationError

from nola.api.schemas import TranscriptionDefaultsUpdateRequest, TranscriptionRequest
from nola.config.transcription import get_transcription_param_schema
from nola.config.transcription.schema.models import (
    NumberFieldSchema,
    SelectFieldSchema,
    SelectOptionSchema,
    SliderFieldSchema,
)
from nola.engines.base import TranscribeOptions


class TestTranscribeOptionsDefaults:
    """Verify local defaults stay aligned with faster-whisper's non-batched path."""

    def test_non_batched_defaults_match_current_contract(self):
        """Drift-prone defaults should stay aligned with WhisperModel.transcribe."""
        defaults = TranscribeOptions()

        assert defaults.without_timestamps is False
        assert defaults.vad_filter is False
        assert defaults.chunk_length is None
        assert defaults.clip_timestamps == "0"
        assert defaults.language_detection_threshold == 0.5
        assert defaults.language_detection_segments == 1
        assert defaults.prepend_punctuations == "\"'“¿([{-"
        assert defaults.append_punctuations == "\"'.。,，!！?？:：”)]}、"


class TestTranscriptionSchemas:
    """Verify task and defaults payloads share the same option contract."""

    def test_transcription_request_schema_defaults_match_engine_defaults(self):
        """OpenAPI examples should stay aligned with TranscribeOptions."""
        schema = TranscriptionRequest.model_json_schema()["properties"]
        engine_defaults = asdict(TranscribeOptions())
        overridden = {"initial_prompt", "prefix", "hotwords"}

        for key, expected in engine_defaults.items():
            assert key in schema
            if key not in overridden:
                assert schema[key].get("example") == expected

    def test_optional_text_fields_use_null_examples_in_schema(self):
        """Swagger should keep optional text fields visible via empty examples."""
        schema = TranscriptionRequest.model_json_schema()["properties"]

        for key in ("initial_prompt", "prefix", "hotwords"):
            assert schema[key].get("example") == ""

    def test_request_model_uses_full_example_with_string_clip_timestamps(self):
        """Create-task example should preserve string-valued clip timestamps."""
        request_example = TranscriptionRequest.model_json_schema()["example"]

        assert request_example["file_id"] == "uploaded-file-id"
        assert request_example["clip_timestamps"] == "0"
        assert "beam_size" in request_example

    def test_defaults_patch_model_uses_sparse_example(self):
        """PATCH example should show partial updates instead of full defaults."""
        defaults_example = TranscriptionDefaultsUpdateRequest.model_json_schema()[
            "example"
        ]

        assert defaults_example == {
            "beam_size": 3,
            "language": "zh",
            "vad_parameters": {"threshold": 0.6},
            "hotwords": None,
        }

    def test_transcription_request_includes_chunk_length_in_options(self):
        """Task creation payload should retain chunk_length when provided."""
        request = TranscriptionRequest(file_id="file-001", chunk_length=30)

        assert request.get_options_dict() == {"chunk_length": 30}

    def test_transcription_request_excludes_execution_config_from_options(self):
        """Task creation payload should keep engine config outside options JSON."""
        request = TranscriptionRequest(
            file_id="file-001",
            model_id="small",
            engine={"device": "cuda", "compute_type": "float16"},
            language="en",
        )

        assert request.get_options_dict() == {"language": "en"}
        assert request.engine is not None
        assert request.engine.device == "cuda"
        assert request.engine.compute_type == "float16"

    def test_transcription_request_canonicalizes_model_id_aliases(self):
        """Accepted model aliases should normalize to one canonical model id."""
        request = TranscriptionRequest(file_id="file-001", model_id="large")

        assert request.model_id == "large-v3"

    def test_transcription_request_rejects_unknown_engine_values(self):
        """Unknown task engine values should fail request validation early."""
        with pytest.raises(ValidationError):
            TranscriptionRequest(
                file_id="file-001",
                engine={"device": "metal"},
            )

        with pytest.raises(ValidationError):
            TranscriptionRequest(
                file_id="file-001",
                engine={"compute_type": "float32"},
            )

    def test_transcription_defaults_update_request_has_no_file_id(self):
        """Defaults update schema should expose only transcription option fields."""
        schema = TranscriptionDefaultsUpdateRequest.model_json_schema()

        assert "file_id" not in schema["properties"]

    def test_transcription_defaults_update_request_keeps_only_defined_fields(self):
        """Defaults update payload should serialize only explicitly provided values."""
        request = TranscriptionDefaultsUpdateRequest(
            chunk_length=15,
            vad_filter=True,
        )

        assert request.get_options_dict() == {
            "chunk_length": 15,
            "vad_filter": True,
        }

    def test_transcription_defaults_update_request_preserves_explicit_nulls(self):
        """Defaults update payload should keep explicit nulls for key resets."""
        request = TranscriptionDefaultsUpdateRequest(
            hotwords=None,
            prefix="speaker:",
        )

        assert request.get_options_dict() == {
            "hotwords": None,
            "prefix": "speaker:",
        }

    def test_transcription_defaults_update_request_preserves_nested_nulls(self):
        """Defaults update payload should keep nested nulls for VAD key resets."""
        request = TranscriptionDefaultsUpdateRequest(
            vad_parameters={"threshold": None},
        )

        assert request.get_options_dict() == {
            "vad_parameters": {"threshold": None},
        }

    def test_vad_parameters_unknown_key_is_rejected(self):
        """Unknown nested VAD keys should fail schema validation."""
        with pytest.raises(ValidationError, match="Unsupported vad_parameters key"):
            TranscriptionDefaultsUpdateRequest(
                vad_parameters={"threshld": 0.6},
            )

    def test_transcription_request_accepts_inf_vad_sentinel(self):
        """Accept API-level infinity sentinel for VAD max duration in task payload."""
        request = TranscriptionRequest(
            file_id="file-001",
            vad_parameters={"max_speech_duration_s": "inf"},
        )

        assert request.get_options_dict() == {
            "vad_parameters": {"max_speech_duration_s": "inf"},
        }

    def test_task_validation_uses_runtime_task_options(self):
        """Task values should follow the backend metadata option list."""
        schema = get_transcription_param_schema()
        task_field = next(
            field
            for group in schema
            for field in group.fields
            if field.type == "select" and field.key == "task"
        )
        assert task_field.options is not None

        selected = task_field.options[0].value
        request = TranscriptionRequest(file_id="file-001", task=selected.upper())

        assert request.get_options_dict() == {"task": selected}

    def test_task_validation_rejects_unknown_values(self):
        """Unknown task values should fail request validation early."""
        with pytest.raises(ValidationError, match="Unsupported task"):
            TranscriptionRequest(file_id="file-001", task="summarize")

    def test_transcription_request_rejects_out_of_range_probability_fields(self):
        """Probability-like fields should stay in the [0, 1] range."""
        with pytest.raises(ValidationError):
            TranscriptionRequest(
                file_id="file-001",
                no_speech_threshold=1.2,
            )

        with pytest.raises(ValidationError):
            TranscriptionRequest(
                file_id="file-001",
                language_detection_threshold=-0.1,
            )

        with pytest.raises(ValidationError):
            TranscriptionRequest(
                file_id="file-001",
                vad_parameters={"threshold": 1.1},
            )

    def test_transcription_request_rejects_negative_duration_fields(self):
        """Duration and threshold fields should reject negative values."""
        with pytest.raises(ValidationError):
            TranscriptionRequest(
                file_id="file-001",
                max_initial_timestamp=-0.1,
            )

        with pytest.raises(ValidationError):
            TranscriptionRequest(
                file_id="file-001",
                hallucination_silence_threshold=-0.1,
            )

        with pytest.raises(ValidationError):
            TranscriptionRequest(
                file_id="file-001",
                vad_parameters={"speech_pad_ms": -10},
            )

    def test_defaults_patch_rejects_non_positive_count_fields(self):
        """Count-like fields should reject zero/negative values."""
        with pytest.raises(ValidationError):
            TranscriptionDefaultsUpdateRequest(max_new_tokens=0)

        with pytest.raises(ValidationError):
            TranscriptionDefaultsUpdateRequest(language_detection_segments=0)


class TestTranscriptionSchemaMetadataModels:
    """Validate static metadata model invariants."""

    def test_slider_rejects_inverted_bounds(self):
        """Reject slider definitions where min exceeds max."""
        with pytest.raises(ValidationError, match="slider field min"):
            SliderFieldSchema(
                key="beam_size",
                label_key="options.field.beamSize",
                type="slider",
                min=10,
                max=1,
                step=1,
            )

    def test_slider_rejects_non_positive_step(self):
        """Reject slider definitions where step is zero or negative."""
        with pytest.raises(ValidationError, match="slider field step"):
            SliderFieldSchema(
                key="beam_size",
                label_key="options.field.beamSize",
                type="slider",
                min=1,
                max=10,
                step=0,
            )

    def test_number_rejects_invalid_bounds_and_step(self):
        """Reject number definitions with invalid bounds or step."""
        with pytest.raises(ValidationError, match="number field min"):
            NumberFieldSchema(
                key="chunk_length",
                label_key="options.field.chunkLength",
                type="number",
                min=5,
                max=1,
            )

        with pytest.raises(ValidationError, match="number field step"):
            NumberFieldSchema(
                key="chunk_length",
                label_key="options.field.chunkLength",
                type="number",
                step=0,
            )

    def test_select_requires_exactly_one_option_source(self):
        """Reject select definitions that provide zero or multiple option sources."""
        with pytest.raises(ValidationError, match="exactly one"):
            SelectFieldSchema(
                key="task",
                label_key="options.task.label",
                type="select",
            )

        with pytest.raises(ValidationError, match="exactly one"):
            SelectFieldSchema(
                key="task",
                label_key="options.task.label",
                type="select",
                options=[
                    SelectOptionSchema(
                        value="transcribe",
                        label_key="options.task.transcribe",
                    )
                ],
                options_source="effective_languages",
            )

        with pytest.raises(ValidationError, match="exactly one"):
            SelectFieldSchema(
                key="task",
                label_key="options.task.label",
                type="select",
                options=[],
                options_source="effective_languages",
            )

        with pytest.raises(ValidationError, match="must not be empty"):
            SelectFieldSchema(
                key="task",
                label_key="options.task.label",
                type="select",
                options=[],
            )

    def test_select_accepts_single_option_source(self):
        """Accept select definitions with exactly one option source."""
        inline = SelectFieldSchema(
            key="task",
            label_key="options.task.label",
            type="select",
            options=[
                SelectOptionSchema(
                    value="transcribe",
                    label_key="options.task.transcribe",
                )
            ],
        )
        dynamic = SelectFieldSchema(
            key="language",
            label_key="options.language.label",
            type="select",
            options_source="effective_languages",
        )

        assert inline.options is not None
        assert dynamic.options_source == "effective_languages"
