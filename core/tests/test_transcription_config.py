"""Tests for transcription configuration schema and default helpers."""

from dataclasses import asdict
from dataclasses import fields as dataclass_fields

from faster_whisper.vad import VadOptions
from pydantic import TypeAdapter

from nola.config.transcription import get_transcription_param_schema
from nola.config.transcription.defaults import (
    get_effective_defaults,
    get_engine_defaults,
)
from nola.config.transcription.languages import (
    get_effective_languages,
    is_multilingual,
)
from nola.config.transcription.metadata import OptionFieldSchema
from nola.engines.base import TranscribeOptions


class StubConfigStore:
    """Provide the minimal config-store contract needed by helper tests."""

    def __init__(self, values: dict[str, object]) -> None:
        """Initialize the stubbed response payload."""
        self.values = values

    def get_all(self, prefix: str) -> dict[str, object]:
        """Return the preconfigured values for the requested prefix."""
        assert prefix == "transcription."
        return self.values


class TestEngineDefaults:
    """Verify the config helpers preserve the runtime contract."""

    def test_get_engine_defaults_expands_vad_defaults(self):
        """Engine defaults should expose all non-batched fields and VAD subkeys."""
        defaults = get_engine_defaults()
        expected = asdict(TranscribeOptions())
        expected["vad_parameters"] = asdict(VadOptions())
        expected["vad_parameters"]["max_speech_duration_s"] = "inf"

        assert defaults == expected

    def test_get_effective_defaults_deep_merges_nested_vad_values(self):
        """Nested overrides should not discard untouched VAD defaults."""
        merged = get_effective_defaults(
            StubConfigStore(
                {
                    "beam_size": 3,
                    "vad_parameters": {
                        "threshold": 0.6,
                        "min_silence_duration_ms": 1500,
                    },
                }
            )
        )

        assert merged["beam_size"] == 3
        assert merged["vad_parameters"]["threshold"] == 0.6
        assert merged["vad_parameters"]["min_silence_duration_ms"] == 1500
        assert merged["vad_parameters"]["speech_pad_ms"] == 400
        assert merged["vad_parameters"]["max_speech_duration_s"] == "inf"

    def test_get_effective_defaults_serializes_special_override_values(self):
        """Merged defaults should keep API-safe sentinel values."""
        merged = get_effective_defaults(
            StubConfigStore(
                {
                    "vad_parameters": {
                        "max_speech_duration_s": float("inf"),
                    }
                }
            )
        )

        assert merged["vad_parameters"]["max_speech_duration_s"] == "inf"


class TestLanguageCapabilities:
    """Verify language capability helpers match the current model contract."""

    def test_is_multilingual_uses_official_en_suffix_rule(self):
        """Official *.en model IDs should be treated as English-only."""
        assert is_multilingual("small") is True
        assert is_multilingual("large-v3") is True
        assert is_multilingual("small.en") is False

    def test_get_effective_languages_respects_model_capability(self):
        """Language options should collapse to English for English-only models."""
        multilingual = get_effective_languages("small")
        english_only = get_effective_languages("small.en")
        multilingual_codes = {option.code for option in multilingual}

        assert {"af", "en", "zh", "yue"} <= multilingual_codes
        assert [option.model_dump() for option in english_only] == [
            {"code": "en", "label_key": "options.language.en"}
        ]


class TestTranscriptionParamSchema:
    """Verify schema metadata covers the planned option surface."""

    def test_option_field_union_keeps_discriminator_for_openapi(self):
        """Keep option-field schema as a typed discriminator union."""
        schema = TypeAdapter(OptionFieldSchema).json_schema()

        assert schema["discriminator"]["propertyName"] == "type"
        assert "oneOf" in schema
        assert "select" in schema["discriminator"]["mapping"]

    def test_param_schema_covers_transcribe_options_surface(self):
        """Cover all editable TranscribeOptions fields in schema keys."""
        schema = get_transcription_param_schema()
        schema_keys = {field.key for group in schema for field in group.fields}

        expected = {field.name for field in dataclass_fields(TranscribeOptions)}
        expected.remove("vad_parameters")
        expected |= {
            f"vad_parameters.{field.name}" for field in dataclass_fields(VadOptions)
        }

        assert expected <= schema_keys

    def test_param_schema_includes_runtime_supported_vad_subfields(self):
        """VAD metadata should match the installed faster-whisper contract."""
        schema = get_transcription_param_schema()
        vad_keys = {
            field.key
            for group in schema
            if group.group in {"vad", "vad_advanced"}
            for field in group.fields
        }
        supported_nested = {
            f"vad_parameters.{field.name}" for field in dataclass_fields(VadOptions)
        }

        assert vad_keys == {"vad_filter", *supported_nested}

    def test_max_speech_duration_schema_advertises_inf_special_value(self):
        """The schema should document the API-level infinity sentinel."""
        schema = get_transcription_param_schema()
        vad_advanced = next(group for group in schema if group.group == "vad_advanced")
        max_speech_field = next(
            field
            for field in vad_advanced.fields
            if field.key == "vad_parameters.max_speech_duration_s"
        )

        assert max_speech_field.special_values == ["inf"]

    def test_number_list_schema_exposes_list_parsing_constraints(self):
        """Number-list metadata should expose parser-relevant constraints."""
        schema = get_transcription_param_schema()
        number_list_fields = {
            field.key: field
            for group in schema
            for field in group.fields
            if field.type == "number_list"
        }

        temperature_field = number_list_fields["temperature"]
        suppress_tokens_field = number_list_fields["suppress_tokens"]

        assert temperature_field.collapse_single_value is True
        assert temperature_field.allow_negative is False
        assert temperature_field.integer_only is False
        assert suppress_tokens_field.allow_negative is True
        assert suppress_tokens_field.integer_only is True
        assert suppress_tokens_field.collapse_single_value is False

    def test_param_schema_returns_a_defensive_copy(self):
        """The public schema accessor should not expose shared mutable state."""
        first = get_transcription_param_schema()
        second = get_transcription_param_schema()

        first[0].fields.append(first[0].fields[0].model_copy())

        assert len(second[0].fields) + 1 == len(first[0].fields)
