"""Tests for Live realtime runtime config resolution."""

from pathlib import Path

import pytest

from nola.application.live.errors import LiveUseCaseError
from nola.application.live.realtime.whisper_streaming.config import (
    whisper_streaming_runtime_snapshot_from_live_snapshot,
)
from nola.application.live.runtime_config import (
    LIVE_REALTIME_AUDIO_FORMAT,
    LIVE_RUNTIME_CONFIG_SCHEMA_VERSION,
    build_live_runtime_config,
)
from nola.config.common.types import ConfigMap
from nola.model_hub import get_model
from nola.model_hub.contracts import ModelCacheState


class FakeConfigStore:
    """In-memory config store for runtime resolver tests."""

    def __init__(
        self,
        values_by_prefix: dict[str, ConfigMap] | None = None,
    ) -> None:
        self.values_by_prefix = values_by_prefix or {}

    def get_all(self, prefix: str) -> ConfigMap:
        """Return values under one prefix."""
        return dict(self.values_by_prefix.get(prefix, {}))

    def set_prefix(self, prefix: str, values: ConfigMap) -> None:
        """Replace values under one prefix."""
        self.values_by_prefix[prefix] = values


class FakeModelStorage:
    """Expose deterministic model cache state."""

    cache_dir = Path("D:/fake-model-cache")

    def __init__(self, state: ModelCacheState = "downloaded") -> None:
        self.state = state

    def get_cache_state(self, repo_id: str) -> ModelCacheState:
        """Return one configured cache state."""
        assert repo_id
        return self.state


def test_build_live_runtime_config_merges_three_layers() -> None:
    """Session overrides should win over persisted and built-in defaults."""
    config_store = FakeConfigStore(
        {
            "live_realtime.": {
                "language": "zh",
                "beam_size": 2,
                "context_prompt": "persisted prompt",
                "vad_parameters": {"threshold": 0.4},
            }
        }
    )

    resolved = build_live_runtime_config(
        runtime_adapter="whisper_streaming",
        request_model_id="small",
        language_hint="zh",
        runtime_overrides={
            "language": "en",
            "beam_size": 3,
            "context_prompt": None,
            "vad_parameters": {"threshold": 0.6},
        },
        config_store=config_store,
        model_storage=FakeModelStorage(),
    )

    assert resolved.runtime == "whisper_streaming"
    assert resolved.model_id == "small"
    assert resolved.audio_format == LIVE_REALTIME_AUDIO_FORMAT
    assert resolved.snapshot["schema_version"] == LIVE_RUNTIME_CONFIG_SCHEMA_VERSION
    assert resolved.snapshot["runtime"] == "whisper_streaming"
    assert resolved.snapshot["model_id"] == "small"
    assert resolved.snapshot["language"] == "en"
    assert resolved.snapshot["context_prompt"] is None
    assert resolved.snapshot["faster_whisper"]["beam_size"] == 3
    assert resolved.snapshot["vad"]["vad_parameters"]["threshold"] == 0.6
    assert resolved.snapshot["session_overrides"] == {
        "language": "en",
        "beam_size": 3,
        "context_prompt": None,
        "vad_parameters": {"threshold": 0.6},
    }


def test_live_runtime_snapshot_does_not_drift_with_later_defaults() -> None:
    """Resolved snapshots should stay independent from later config changes."""
    config_store = FakeConfigStore({"live_realtime.": {"beam_size": 4}})
    resolved = build_live_runtime_config(
        runtime_adapter="whisper_streaming",
        request_model_id="small",
        language_hint=None,
        runtime_overrides=None,
        config_store=config_store,
        model_storage=FakeModelStorage(),
    )

    config_store.set_prefix("live_realtime.", {"beam_size": 1})

    assert resolved.snapshot["faster_whisper"]["beam_size"] == 4


def test_live_runtime_config_uses_configured_model_when_request_omits_model() -> None:
    """Configured model should fill the runtime model when no request model is set."""
    config_store = FakeConfigStore({"model.": {"configured_model_id": "small.en"}})
    model = get_model("small.en")
    assert model is not None

    resolved = build_live_runtime_config(
        runtime_adapter="whisper_streaming",
        request_model_id=None,
        language_hint=None,
        runtime_overrides=None,
        config_store=config_store,
        model_storage=FakeModelStorage(),
    )

    assert resolved.model_id == model.model_id
    assert resolved.snapshot["model_id"] == model.model_id


def test_live_runtime_config_rejects_missing_configured_model() -> None:
    """WhisperStreaming should require a configured or request model."""
    with pytest.raises(LiveUseCaseError) as error:
        build_live_runtime_config(
            runtime_adapter="whisper_streaming",
            request_model_id=None,
            language_hint=None,
            runtime_overrides=None,
            config_store=FakeConfigStore(),
            model_storage=FakeModelStorage(),
        )

    assert error.value.status_code == 409
    assert error.value.detail == {
        "code": "runtime_model_not_configured",
        "message": "Live realtime model is not configured",
    }


def test_live_runtime_config_rejects_undownloaded_model() -> None:
    """WhisperStreaming should not start downloads during session creation."""
    with pytest.raises(LiveUseCaseError) as error:
        build_live_runtime_config(
            runtime_adapter="whisper_streaming",
            request_model_id="small",
            language_hint=None,
            runtime_overrides=None,
            config_store=FakeConfigStore(),
            model_storage=FakeModelStorage("not_downloaded"),
        )

    assert error.value.status_code == 409
    assert error.value.detail == {
        "code": "runtime_model_not_downloaded",
        "message": "Live realtime model is not downloaded",
    }


def test_mock_runtime_ignores_persisted_live_realtime_defaults() -> None:
    """Mock runtime should not be blocked by WhisperStreaming app defaults."""
    resolved = build_live_runtime_config(
        runtime_adapter="mock",
        request_model_id=None,
        language_hint=None,
        runtime_overrides=None,
        config_store=FakeConfigStore({"live_realtime.": {"beam_size": 3}}),
        model_storage=None,
    )

    assert resolved.runtime == "mock"
    assert resolved.model_id is None
    assert resolved.snapshot == {
        "schema_version": LIVE_RUNTIME_CONFIG_SCHEMA_VERSION,
        "runtime": "mock",
        "model_id": None,
        "audio_format": LIVE_REALTIME_AUDIO_FORMAT,
    }


def test_mock_runtime_rejects_explicit_live_realtime_overrides() -> None:
    """Mock runtime should not accept WhisperStreaming option overrides."""
    with pytest.raises(LiveUseCaseError) as error:
        build_live_runtime_config(
            runtime_adapter="mock",
            request_model_id="small",
            language_hint="en",
            runtime_overrides={"beam_size": 3},
            config_store=FakeConfigStore(),
            model_storage=None,
        )

    assert error.value.status_code == 422
    assert error.value.detail == {
        "code": "runtime_config_invalid",
        "message": "Mock Live realtime does not support runtime option overrides",
    }


def test_whisper_streaming_snapshot_normalizes_blank_language() -> None:
    """Snapshot parsing should not pass blank language values to inference."""
    resolved = build_live_runtime_config(
        runtime_adapter="whisper_streaming",
        request_model_id="small",
        language_hint=None,
        runtime_overrides=None,
        config_store=FakeConfigStore(),
        model_storage=FakeModelStorage(),
    )
    faster_whisper = resolved.snapshot["faster_whisper"]
    assert isinstance(faster_whisper, dict)
    faster_whisper["language"] = "   "

    snapshot = whisper_streaming_runtime_snapshot_from_live_snapshot(resolved.snapshot)

    assert snapshot.config.language is None
