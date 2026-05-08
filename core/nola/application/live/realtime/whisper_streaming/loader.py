"""Resolve and load Live WhisperStreaming model backends."""

from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from nola.application.live.realtime.whisper_streaming.backend import (
    WhisperStreamingFasterWhisperBackend,
    WhisperStreamingFasterWhisperBackendConfig,
)
from nola.application.live.realtime.whisper_streaming.errors import (
    WhisperStreamingRuntimeConfigError,
    WhisperStreamingRuntimeError,
)
from nola.application.live.realtime.whisper_streaming.types import (
    WhisperStreamingInferenceBackend,
)
from nola.config.common.types import ConfigMap
from nola.engines.base import EngineComputeType, EngineDevice
from nola.model_hub import (
    InvalidModelDirectoryError,
    ModelInfo,
    ModelStorage,
    UnknownModelError,
    require_model,
    resolve_model_dir,
)
from nola.model_hub.contracts import ModelCacheState


class SupportsWhisperStreamingModelConfig(Protocol):
    """Expose model configuration reads required by Live runtime loading."""

    def get_all(self, prefix: str) -> ConfigMap:
        """Return all config values under one prefix."""
        ...


class SupportsWhisperStreamingModelStorage(Protocol):
    """Expose model cache reads required by Live runtime loading."""

    def get_cache_state(self, repo_id: str) -> ModelCacheState:
        """Return the local cache state for one model repository."""
        ...


ModelStorageFactory = Callable[[Path], SupportsWhisperStreamingModelStorage]
BackendFactory = Callable[
    [WhisperStreamingFasterWhisperBackendConfig],
    WhisperStreamingInferenceBackend,
]


@dataclass(frozen=True, slots=True)
class WhisperStreamingRuntimeLoaderConfig:
    """Configure Live runtime model resolution."""

    env_model_dir: Path | None
    default_model_dir: Path
    device: EngineDevice
    compute_type: EngineComputeType


@dataclass(frozen=True, slots=True)
class WhisperStreamingResolvedModel:
    """Describe one resolved Live runtime model."""

    model_id: str
    repo_id: str
    model_dir: Path
    device: EngineDevice
    compute_type: EngineComputeType


class WhisperStreamingRuntimeLoader:
    """Load a Live faster-whisper backend through model-management boundaries."""

    def __init__(
        self,
        *,
        config_store: SupportsWhisperStreamingModelConfig,
        config: WhisperStreamingRuntimeLoaderConfig,
        storage_factory: ModelStorageFactory = ModelStorage,
        backend_factory: BackendFactory = (
            WhisperStreamingFasterWhisperBackend.from_config
        ),
    ) -> None:
        self._config_store = config_store
        self._config = config
        self._storage_factory = storage_factory
        self._backend_factory = backend_factory

    def resolve_model(self) -> WhisperStreamingResolvedModel:
        """Return the configured, registered, and downloaded Live model."""
        model_config = self._config_store.get_all("model.")
        configured_model_id = _require_configured_model_id(model_config)
        model_info = _require_registered_model(configured_model_id)
        model_dir = _resolve_configured_model_dir(
            model_config=model_config,
            env_model_dir=self._config.env_model_dir,
            default_model_dir=self._config.default_model_dir,
        )
        _require_downloaded_model(
            storage=self._storage_factory(model_dir),
            model_info=model_info,
        )
        return WhisperStreamingResolvedModel(
            model_id=model_info.model_id,
            repo_id=model_info.repo_id,
            model_dir=model_dir,
            device=self._config.device,
            compute_type=self._config.compute_type,
        )

    def load_backend(self) -> WhisperStreamingInferenceBackend:
        """Load and return a Live inference backend for one transcriber instance."""
        resolved = self.resolve_model()
        backend_config = WhisperStreamingFasterWhisperBackendConfig(
            model_size_or_path=resolved.repo_id,
            device=resolved.device,
            compute_type=resolved.compute_type,
            download_root=resolved.model_dir,
            local_files_only=True,
        )
        try:
            return self._backend_factory(backend_config)
        except WhisperStreamingRuntimeError:
            raise
        except Exception as error:
            raise WhisperStreamingRuntimeError(
                code="runtime_model_load_failed",
                message="Live realtime model could not be loaded",
            ) from error


def _require_configured_model_id(model_config: ConfigMap) -> str:
    configured = model_config.get("configured_model_id")
    if not isinstance(configured, str) or not configured.strip():
        raise WhisperStreamingRuntimeError(
            code="runtime_model_not_configured",
            message="Live realtime model is not configured",
        )
    return configured.strip()


def _require_registered_model(model_id: str) -> ModelInfo:
    try:
        return require_model(model_id)
    except UnknownModelError as error:
        raise WhisperStreamingRuntimeError(
            code="runtime_model_not_registered",
            message="Live realtime model is not registered",
        ) from error


def _resolve_configured_model_dir(
    *,
    model_config: ConfigMap,
    env_model_dir: Path | None,
    default_model_dir: Path,
) -> Path:
    db_model_dir = model_config.get("configured_model_dir")
    try:
        model_dir, _source = resolve_model_dir(
            env_model_dir,
            db_model_dir if isinstance(db_model_dir, str) else None,
            default_model_dir,
        )
    except InvalidModelDirectoryError as error:
        raise WhisperStreamingRuntimeConfigError(
            "Live realtime model directory is invalid"
        ) from error
    return model_dir


def _require_downloaded_model(
    *,
    storage: SupportsWhisperStreamingModelStorage,
    model_info: ModelInfo,
) -> None:
    if storage.get_cache_state(model_info.repo_id) == "downloaded":
        return
    raise WhisperStreamingRuntimeError(
        code="runtime_model_not_downloaded",
        message="Live realtime model is not downloaded",
    )


__all__ = [
    "BackendFactory",
    "ModelStorageFactory",
    "SupportsWhisperStreamingModelConfig",
    "SupportsWhisperStreamingModelStorage",
    "WhisperStreamingResolvedModel",
    "WhisperStreamingRuntimeLoader",
    "WhisperStreamingRuntimeLoaderConfig",
]
