"""Tests for transcription request schemas and default option alignment."""

from dataclasses import asdict

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
        """OpenAPI defaults should stay aligned with TranscribeOptions."""
        schema = TranscriptionRequest.model_json_schema()["properties"]
        engine_defaults = asdict(TranscribeOptions())

        for key, expected in engine_defaults.items():
            assert key in schema
            assert schema[key].get("default") == expected

    def test_optional_text_fields_use_null_examples_in_schema(self):
        """Swagger should keep optional text fields visible without placeholders."""
        schema = TranscriptionRequest.model_json_schema()["properties"]

        for key in ("initial_prompt", "prefix", "hotwords"):
            assert schema[key].get("default") is None
            assert schema[key].get("example") == ""

    def test_request_models_do_not_override_generated_body_examples(self):
        """Schema should rely on field-level examples for Swagger request rendering."""
        assert "example" not in TranscriptionRequest.model_json_schema()
        assert "example" not in TranscriptionDefaultsUpdateRequest.model_json_schema()

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
