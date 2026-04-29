"""Shared payload and value types for model use-cases."""

from pathlib import Path
from typing import Literal, TypedDict

from nola.engines.base import EngineComputeType, EngineDevice
from nola.model_hub.contracts import DownloadStatus, ModelDirSource

ModelStatusValue = Literal[
    "not_downloaded",
    "downloading",
    "partial_download",
    "downloaded",
]
ModelListSortField = Literal["name", "languages", "size", "status", "profile"]
ModelListSortOrder = Literal["asc", "desc"]


class ModelDirectoryDefaults(TypedDict):
    """Model directory defaults used to resolve the active cache root."""

    env_model_dir: Path | None
    default_model_dir: Path


class DownloadProgressPayload(TypedDict):
    """Expose one active download snapshot."""

    percent: float
    downloaded_bytes: int
    total_bytes: int
    speed_bps: int
    error: str | None


class ActiveModelDownloadPayload(TypedDict):
    """Expose one active model download with registry identity."""

    model_id: str
    name: str
    status: DownloadStatus
    percent: float
    downloaded_bytes: int
    total_bytes: int
    speed_bps: int
    error: str | None


class ActiveModelDownloadsPayload(TypedDict):
    """Expose the current active-download runtime summary."""

    downloads: list[ActiveModelDownloadPayload]
    active_count: int
    total_speed_bps: int


class ModelPayload(TypedDict):
    """Expose one model with registry info, local state, and config flags."""

    model_id: str
    name: str
    size_bytes: int
    repo_id: str
    languages: str
    speed_rank: int
    accuracy_rank: int
    description: str
    description_key: str
    status: ModelStatusValue
    disk_usage: int | None
    is_configured: bool
    is_last_loaded: bool
    download_progress: DownloadProgressPayload | None


class ModelListPayload(TypedDict):
    """Return all models with global config state."""

    models: list[ModelPayload]
    configured_model_id: str | None
    last_loaded_model_id: str | None
    effective_model_dir: str


class ModelSettingsPayload(TypedDict):
    """Expose model directory configuration and override state."""

    configured_model_id: str | None
    last_loaded_model_id: str | None
    last_loaded_device: EngineDevice | None
    last_loaded_compute_type: EngineComputeType | None
    configured_model_dir: str | None
    effective_model_dir: str
    override_source: ModelDirSource
    restart_required: bool


class ModelDownloadStartedPayload(TypedDict):
    """Confirm a download was accepted."""

    model_id: str
    status: Literal["downloading"]
    message: str


class ModelCancelPayload(TypedDict):
    """Confirm a download cancellation."""

    model_id: str
    message: str


class ModelDeletePayload(TypedDict):
    """Confirm a model cache deletion."""

    model_id: str
    message: str


class ModelSelectPayload(TypedDict):
    """Confirm a configured-model switch."""

    configured_model_id: str
    restart_required: bool
    message: str
