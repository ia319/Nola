"""Shared model-hub contracts and value objects."""

from __future__ import annotations

from collections.abc import Callable, Sequence
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal, Protocol

ModelLanguageCategory = Literal["english-only", "multilingual"]
ModelRuntime = Literal["faster-whisper"]
ModelDirSource = Literal["environment", "database", "default"]
DownloadStatus = Literal["downloading", "completed", "failed", "cancelled"]


@dataclass(frozen=True, slots=True)
class DownloadProgress:
    """Describe the observable state of one model download."""

    model_id: str
    status: DownloadStatus
    downloaded_bytes: int
    total_bytes: int
    speed_bps: float = 0.0
    error: str | None = None

    @property
    def percent(self) -> float:
        """Return one bounded percentage for UI and API consumers."""
        if self.total_bytes <= 0:
            return 100.0 if self.status == "completed" else 0.0
        return min(100.0, max(0.0, (self.downloaded_bytes / self.total_bytes) * 100.0))


@dataclass(frozen=True, slots=True)
class ModelInfo:
    """Describe one model option exposed by the application."""

    model_id: str
    name: str
    repo_id: str
    runtime: ModelRuntime
    languages: ModelLanguageCategory
    size_bytes: int
    speed_rank: int
    accuracy_rank: int
    description: str
    aliases: tuple[str, ...] = field(default_factory=tuple)


class ModelCatalog(Protocol):
    """Expose lookup helpers over the supported model set."""

    def list_models(self) -> Sequence[ModelInfo]:
        """Return every canonical model in display order."""

    def get_model(self, model_id: str) -> ModelInfo | None:
        """Return one model by canonical id or alias."""

    def get_model_by_repo_id(self, repo_id: str) -> ModelInfo | None:
        """Return one model by the Hugging Face repository id."""


ProgressCallback = Callable[[DownloadProgress], None]


class ModelStoragePort(Protocol):
    """Expose storage operations over one resolved cache root."""

    cache_dir: Path

    def is_downloaded(self, repo_id: str) -> bool:
        """Return whether one repository is cached locally."""

    def get_downloaded_models(self) -> list[str]:
        """Return cached repository ids."""

    def get_disk_usage(self, repo_id: str) -> int | None:
        """Return cached disk usage for one repository."""

    def delete_model(self, repo_id: str) -> bool:
        """Delete one cached repository."""


class ModelDownloaderPort(Protocol):
    """Expose asynchronous download lifecycle operations."""

    cache_dir: Path

    def start_download(
        self,
        model_info: ModelInfo,
        on_progress: ProgressCallback | None = None,
    ) -> DownloadProgress:
        """Start one model download and return the initial snapshot."""

    def cancel_download(self, model_id: str) -> DownloadProgress:
        """Cancel one active model download."""

    def is_downloading(self, model_id: str) -> bool:
        """Return whether one model is currently downloading."""

    def get_download(self, model_id: str) -> DownloadProgress | None:
        """Return the active snapshot for one model."""

    def list_downloads(self) -> list[DownloadProgress]:
        """Return all active download snapshots."""
