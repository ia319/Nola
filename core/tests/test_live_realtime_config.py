"""Tests for Live realtime configuration helpers."""

from dataclasses import asdict

import pytest
from faster_whisper.vad import VadOptions

from nola.config.live_realtime import (
    get_live_realtime_builtin_defaults,
    get_live_realtime_default_keys,
    get_live_realtime_effective_defaults,
    get_live_realtime_param_schema,
    get_live_realtime_vad_parameter_keys,
)
from nola.config.transcription.defaults import get_engine_defaults
from nola.engines.base import TranscribeOptions
from nola.engines.faster_whisper_defaults import get_faster_whisper_defaults


class StubConfigStore:
    """Provide the minimal config-store contract needed by helper tests."""

    def __init__(self, values_by_prefix: dict[str, dict[str, object]]) -> None:
        """Initialize stubbed config values by prefix."""
        self.values_by_prefix = values_by_prefix
        self.requested_prefixes: list[str] = []

    def get_all(self, prefix: str) -> dict[str, object]:
        """Return values for the requested prefix."""
        self.requested_prefixes.append(prefix)
        return self.values_by_prefix.get(prefix, {})


def _schema_field_keys() -> set[str]:
    schema = get_live_realtime_param_schema()
    return {field.key for group in schema for field in group.fields}


class TestFasterWhisperDefaults:
    """Verify the neutral helper preserves existing defaults behavior."""

    def test_neutral_helper_matches_transcription_engine_defaults(self) -> None:
        """Keep batch transcription defaults aligned with the neutral helper."""
        expected = asdict(TranscribeOptions())
        expected["vad_parameters"] = asdict(VadOptions())
        expected["vad_parameters"]["max_speech_duration_s"] = "inf"

        assert get_faster_whisper_defaults() == expected
        assert get_engine_defaults() == expected


class TestLiveRealtimeDefaults:
    """Verify Live realtime default composition."""

    def test_builtin_defaults_include_full_supported_surface(self) -> None:
        """Live realtime built-ins should expose every first-release field."""
        defaults = get_live_realtime_builtin_defaults()

        assert defaults["language"] is None
        assert defaults["task"] == "transcribe"
        assert defaults["context_prompt"] is None
        assert defaults["beam_size"] == 5
        assert defaults["best_of"] == 5
        assert defaults["temperature"] == [0.0, 0.2, 0.4, 0.6, 0.8, 1.0]
        assert defaults["compression_ratio_threshold"] == 2.4
        assert defaults["log_prob_threshold"] == -1.0
        assert defaults["no_speech_threshold"] == 0.6
        assert defaults["condition_on_previous_text"] is True
        assert defaults["min_chunk_ms"] == 1000
        assert defaults["buffer_trimming_ms"] == 15000
        assert defaults["prompt_max_chars"] == 200
        assert defaults["timestamp_tolerance_ms"] == 100
        assert defaults["max_duplicate_ngram"] == 5
        assert defaults["silence_rms_threshold"] == 0.01
        assert defaults["segment_close_silence_ms"] == 500
        assert defaults["context_reset_silence_ms"] == 2000
        assert defaults["vad_filter"] is False
        assert defaults["vad_parameters"] == {
            "threshold": 0.5,
            "neg_threshold": None,
            "min_speech_duration_ms": 0,
            "max_speech_duration_s": "inf",
            "min_silence_duration_ms": 2000,
            "speech_pad_ms": 400,
        }

    def test_supported_key_helpers_match_builtin_defaults(self) -> None:
        """Supported key helpers should align with the defaults payload."""
        defaults = get_live_realtime_builtin_defaults()

        assert get_live_realtime_default_keys() == set(defaults)
        assert get_live_realtime_vad_parameter_keys() == tuple(
            defaults["vad_parameters"]
        )

    def test_effective_defaults_reads_only_live_realtime_prefix(self) -> None:
        """Live defaults should not read batch transcription overrides."""
        store = StubConfigStore(
            {
                "live_realtime.": {
                    "beam_size": 3,
                    "vad_parameters": {
                        "threshold": 0.7,
                    },
                },
                "transcription.": {
                    "beam_size": 9,
                    "vad_parameters": {
                        "speech_pad_ms": 900,
                    },
                },
            }
        )

        defaults = get_live_realtime_effective_defaults(store)

        assert store.requested_prefixes == ["live_realtime."]
        assert defaults["beam_size"] == 3
        assert defaults["vad_parameters"]["threshold"] == 0.7
        assert defaults["vad_parameters"]["speech_pad_ms"] == 400

    def test_effective_defaults_normalizes_context_prompt(self) -> None:
        """Prompt context should be trimmed and blank values should become null."""
        with_prompt = get_live_realtime_effective_defaults(
            StubConfigStore({"live_realtime.": {"context_prompt": "  Domain terms  "}})
        )
        blank_prompt = get_live_realtime_effective_defaults(
            StubConfigStore({"live_realtime.": {"context_prompt": "   "}})
        )

        assert with_prompt["context_prompt"] == "Domain terms"
        assert blank_prompt["context_prompt"] is None

    def test_effective_defaults_rejects_invalid_silence_order(self) -> None:
        """Context reset should not occur before segment close."""
        with pytest.raises(ValueError, match="context_reset_silence_ms"):
            get_live_realtime_effective_defaults(
                StubConfigStore(
                    {
                        "live_realtime.": {
                            "segment_close_silence_ms": 3000,
                            "context_reset_silence_ms": 1000,
                        }
                    }
                )
            )

    def test_effective_defaults_rejects_empty_temperature_list(self) -> None:
        """Temperature fallback lists should contain at least one value."""
        with pytest.raises(ValueError, match="temperature"):
            get_live_realtime_effective_defaults(
                StubConfigStore({"live_realtime.": {"temperature": []}})
            )


class TestLiveRealtimeSchema:
    """Verify Live realtime schema metadata."""

    def test_schema_covers_defaults_supported_surface(self) -> None:
        """Every editable Live realtime default should have field metadata."""
        schema_keys = _schema_field_keys()
        expected = set(get_live_realtime_builtin_defaults())
        expected.remove("vad_parameters")
        expected |= {
            f"vad_parameters.{key}" for key in get_live_realtime_vad_parameter_keys()
        }

        assert expected <= schema_keys

    def test_schema_fields_have_descriptions_defaults_and_adapter_support(self) -> None:
        """UI metadata should be complete enough for schema-driven rendering."""
        schema = get_live_realtime_param_schema()

        for group in schema:
            assert group.group_label_key.startswith("liveRealtime.options.group.")
            for field in group.fields:
                assert field.label_key.startswith("liveRealtime.options.field.")
                assert field.description_key.startswith(
                    "liveRealtime.options.description."
                )
                assert field.supported_adapters == ["whisper_streaming"]
                assert field.default_value is not None or field.key in {
                    "language",
                    "context_prompt",
                    "vad_parameters.neg_threshold",
                }

    def test_schema_exposes_task_options(self) -> None:
        """Task should expose transcribe and translate options."""
        schema = get_live_realtime_param_schema()
        common = next(group for group in schema if group.group == "common")
        task = next(field for field in common.fields if field.key == "task")

        assert task.type == "select"
        assert task.default_value == "transcribe"
        assert task.options is not None
        assert [option.value for option in task.options] == ["transcribe", "translate"]

    def test_schema_exposes_max_speech_inf_special_value(self) -> None:
        """VAD max speech duration should document the infinity sentinel."""
        schema = get_live_realtime_param_schema()
        vad_advanced = next(group for group in schema if group.group == "vadAdvanced")
        max_speech = next(
            field
            for field in vad_advanced.fields
            if field.key == "vad_parameters.max_speech_duration_s"
        )

        assert max_speech.type == "number"
        assert max_speech.default_value == "inf"
        assert max_speech.special_values == ["inf"]

    def test_schema_returns_a_defensive_copy(self) -> None:
        """The public schema accessor should not expose shared mutable state."""
        first = get_live_realtime_param_schema()
        second = get_live_realtime_param_schema()

        first[0].fields.append(first[0].fields[0].model_copy())

        assert len(second[0].fields) + 1 == len(first[0].fields)
