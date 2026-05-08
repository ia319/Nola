"""Unit tests for Live WhisperStreaming model loader boundaries."""

from collections.abc import Callable, Sequence
from pathlib import Path

import pytest

from nola.application.live.realtime.whisper_streaming import (
    WhisperStreamingFasterWhisperBackendConfig,
    WhisperStreamingInferenceBackend,
    WhisperStreamingModelOutput,
    WhisperStreamingRuntimeConfig,
    WhisperStreamingRuntimeError,
    WhisperStreamingRuntimeLoader,
    WhisperStreamingRuntimeLoaderConfig,
)
from nola.config.common.types import ConfigMap
from nola.model_hub.contracts import ModelCacheState


class _StubConfigStore:
    def __init__(self, model_config: ConfigMap) -> None:
        self._model_config = model_config

    def get_all(self, prefix: str) -> ConfigMap:
        assert prefix == "model."
        return self._model_config


class _StubModelStorage:
    def __init__(self, state: ModelCacheState) -> None:
        self.state = state
        self.repo_ids: list[str] = []

    def get_cache_state(self, repo_id: str) -> ModelCacheState:
        self.repo_ids.append(repo_id)
        return self.state


class _NoopBackend(WhisperStreamingInferenceBackend):
    separator = ""

    def transcribe(
        self,
        waveform: Sequence[float],
        *,
        prompt: str,
        config: WhisperStreamingRuntimeConfig,
    ) -> WhisperStreamingModelOutput:
        del waveform, prompt, config
        raise AssertionError("unexpected inference")

    def close(self) -> None:
        return


def test_loader_rejects_missing_configured_model(tmp_path: Path) -> None:
    """Require an explicit configured model for Live runtime loading."""
    loader = _loader(tmp_path, model_config={})

    with pytest.raises(WhisperStreamingRuntimeError) as exc_info:
        loader.resolve_model()

    assert exc_info.value.code == "runtime_model_not_configured"


def test_loader_rejects_unknown_configured_model(tmp_path: Path) -> None:
    """Reject model ids that are absent from the curated registry."""
    loader = _loader(tmp_path, model_config={"configured_model_id": "missing"})

    with pytest.raises(WhisperStreamingRuntimeError) as exc_info:
        loader.resolve_model()

    assert exc_info.value.code == "runtime_model_not_registered"


def test_loader_rejects_missing_cache(tmp_path: Path) -> None:
    """Require the configured model to be downloaded before backend loading."""
    storage = _StubModelStorage("partial_download")
    loader = _loader(
        tmp_path,
        model_config={"configured_model_id": "small"},
        storage=storage,
    )

    with pytest.raises(WhisperStreamingRuntimeError) as exc_info:
        loader.resolve_model()

    assert exc_info.value.code == "runtime_model_not_downloaded"
    assert storage.repo_ids == ["Systran/faster-whisper-small"]


def test_loader_rejects_invalid_model_directory(tmp_path: Path) -> None:
    """Map invalid model directory settings to a stable runtime config error."""
    loader = _loader(
        tmp_path,
        model_config={
            "configured_model_id": "small",
            "configured_model_dir": "relative-cache",
        },
    )

    with pytest.raises(WhisperStreamingRuntimeError) as exc_info:
        loader.resolve_model()

    assert exc_info.value.code == "runtime_config_invalid"


def test_loader_resolves_alias_and_loads_local_only_backend(tmp_path: Path) -> None:
    """Load a backend from registry, model-dir settings, and cache state only."""
    storage = _StubModelStorage("downloaded")
    backend_configs: list[WhisperStreamingFasterWhisperBackendConfig] = []
    backend = _NoopBackend()

    def backend_factory(
        config: WhisperStreamingFasterWhisperBackendConfig,
    ) -> WhisperStreamingInferenceBackend:
        backend_configs.append(config)
        return backend

    model_dir = tmp_path / "models"
    loader = _loader(
        tmp_path,
        model_config={
            "configured_model_id": "large",
            "configured_model_dir": str(model_dir),
        },
        storage=storage,
        backend_factory=backend_factory,
    )

    loaded = loader.load_backend()

    assert loaded is backend
    assert storage.repo_ids == ["Systran/faster-whisper-large-v3"]
    assert backend_configs == [
        WhisperStreamingFasterWhisperBackendConfig(
            model_size_or_path="Systran/faster-whisper-large-v3",
            device="cpu",
            compute_type="default",
            download_root=model_dir.resolve(strict=False),
            local_files_only=True,
        )
    ]


def test_loader_maps_backend_factory_failure(tmp_path: Path) -> None:
    """Hide concrete model-load errors behind the stable Live runtime code."""

    def failing_backend_factory(
        config: WhisperStreamingFasterWhisperBackendConfig,
    ) -> WhisperStreamingInferenceBackend:
        del config
        raise RuntimeError("cuda unavailable")

    loader = _loader(
        tmp_path,
        model_config={"configured_model_id": "small"},
        backend_factory=failing_backend_factory,
    )

    with pytest.raises(WhisperStreamingRuntimeError) as exc_info:
        loader.load_backend()

    assert exc_info.value.code == "runtime_model_load_failed"
    assert "cuda unavailable" not in exc_info.value.message


def _loader(
    tmp_path: Path,
    *,
    model_config: ConfigMap,
    storage: _StubModelStorage | None = None,
    backend_factory: (
        Callable[
            [WhisperStreamingFasterWhisperBackendConfig],
            WhisperStreamingInferenceBackend,
        ]
        | None
    ) = None,
) -> WhisperStreamingRuntimeLoader:
    selected_storage = storage or _StubModelStorage("downloaded")
    return WhisperStreamingRuntimeLoader(
        config_store=_StubConfigStore(model_config),
        config=WhisperStreamingRuntimeLoaderConfig(
            env_model_dir=None,
            default_model_dir=tmp_path,
            device="cpu",
            compute_type="default",
        ),
        storage_factory=lambda _path: selected_storage,
        backend_factory=backend_factory or (lambda _config: _NoopBackend()),
    )
