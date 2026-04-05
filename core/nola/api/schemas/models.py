"""Model management request and response schemas."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

ModelStatusLiteral = Literal["not_downloaded", "downloading", "downloaded"]
ModelDirSourceLiteral = Literal["environment", "database", "default"]
DownloadStatusLiteral = Literal["downloading", "completed", "failed", "cancelled"]


class DownloadProgressResponse(BaseModel):
    """Expose one active download snapshot."""

    percent: float
    downloaded_bytes: int
    total_bytes: int
    speed_bps: int
    error: str | None = None


class ActiveModelDownloadResponse(BaseModel):
    """Expose one active model download with registry identity."""

    model_id: str
    name: str
    status: DownloadStatusLiteral
    percent: float
    downloaded_bytes: int
    total_bytes: int
    speed_bps: int
    error: str | None = None


class ActiveModelDownloadsResponse(BaseModel):
    """Expose the current active-download runtime summary."""

    downloads: list[ActiveModelDownloadResponse]
    active_count: int
    total_speed_bps: int


class ModelResponse(BaseModel):
    """Expose one model with registry info, local state, and config flags."""

    model_id: str
    name: str
    size_bytes: int
    repo_id: str
    languages: str
    speed_rank: int
    accuracy_rank: int
    description: str
    status: ModelStatusLiteral
    disk_usage: int | None = None
    is_configured: bool = False
    is_last_loaded: bool = False
    download_progress: DownloadProgressResponse | None = None


class ModelListResponse(BaseModel):
    """Return all models with global config state."""

    models: list[ModelResponse]
    configured_model_id: str | None = None
    last_loaded_model_id: str | None = None
    effective_model_dir: str


class ModelDetailResponse(ModelResponse):
    """Return one model with full detail."""


class ModelSelectResponse(BaseModel):
    """Confirm a configured-model switch."""

    configured_model_id: str
    restart_required: bool
    message: str


class ModelDeleteResponse(BaseModel):
    """Confirm a model cache deletion."""

    model_id: str
    message: str


class ModelDownloadStartedResponse(BaseModel):
    """Confirm a download was accepted."""

    model_id: str
    status: ModelStatusLiteral = "downloading"
    message: str


class ModelCancelResponse(BaseModel):
    """Confirm a download cancellation."""

    model_id: str
    message: str


class ModelSettingsResponse(BaseModel):
    """Expose model directory configuration and override state."""

    configured_model_id: str | None = None
    last_loaded_model_id: str | None = None
    configured_model_dir: str | None = None
    effective_model_dir: str
    override_source: ModelDirSourceLiteral
    restart_required: bool = False


class ModelSettingsUpdateRequest(BaseModel):
    """Accept a partial model-settings update."""

    configured_model_dir: str | None = Field(
        None,
        description="Absolute path for the model cache root directory.",
    )


class DetailResponse(BaseModel):
    """Expose one JSON error detail message."""

    detail: str


class ModelConfigResponse(BaseModel):
    """Expose model state inside the aggregated /api/config response."""

    configured_model_id: str | None = None
    last_loaded_model_id: str | None = None
    restart_required: bool = False
