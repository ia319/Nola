"""Share faster-whisper model lifecycle helpers."""

from dataclasses import dataclass
from pathlib import Path
from typing import Protocol, TypedDict

from faster_whisper import WhisperModel

from nola.engines.base import EngineComputeType, EngineDevice


class FasterWhisperRuntimeModel(Protocol):
    """Expose the runtime model release operation."""

    def unload_model(self) -> None:
        """Release loaded CTranslate2 model resources."""
        ...


class FasterWhisperModelHandle(Protocol):
    """Expose the loaded faster-whisper model handle."""

    @property
    def model(self) -> FasterWhisperRuntimeModel:
        """Return the nested CTranslate2 model handle."""
        ...


class _FasterWhisperInitKwargs(TypedDict, total=False):
    device: EngineDevice
    compute_type: EngineComputeType
    download_root: str
    local_files_only: bool


@dataclass(frozen=True, slots=True)
class FasterWhisperModelConfig:
    """Configure one faster-whisper model instance."""

    model_size_or_path: str
    device: EngineDevice
    compute_type: EngineComputeType
    download_root: Path | None = None
    local_files_only: bool = False


def create_faster_whisper_model(config: FasterWhisperModelConfig) -> WhisperModel:
    """Create one faster-whisper model from a resolved runtime config."""
    init_kwargs: _FasterWhisperInitKwargs = {
        "device": config.device,
        "compute_type": config.compute_type,
    }
    if config.download_root is not None:
        init_kwargs["download_root"] = str(config.download_root)
    if config.local_files_only:
        init_kwargs["local_files_only"] = True

    return WhisperModel(config.model_size_or_path, **init_kwargs)


def close_faster_whisper_model(model: FasterWhisperModelHandle | None) -> None:
    """Release one faster-whisper model handle when present."""
    if model is None:
        return
    model.model.unload_model()


__all__ = [
    "FasterWhisperModelConfig",
    "FasterWhisperModelHandle",
    "FasterWhisperRuntimeModel",
    "close_faster_whisper_model",
    "create_faster_whisper_model",
]
