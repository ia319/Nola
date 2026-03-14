"""Tests for transcription request schemas and default option alignment."""

from dataclasses import asdict

import pytest
from pydantic import ValidationError

from nola.api.schemas import TranscriptionDefaultsUpdateRequest, TranscriptionRequest
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
