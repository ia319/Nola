"""Model management contracts and registry helpers."""

from nola.model_hub.contracts import (
    DownloadProgress,
    DownloadStatus,
    ModelCatalog,
    ModelDirSource,
    ModelDownloaderPort,
    ModelInfo,
    ModelLanguageCategory,
    ModelStoragePort,
    ProgressCallback,
)
from nola.model_hub.downloader import ModelDownloader
from nola.model_hub.errors import (
    InvalidModelDirectoryError,
    ModelAlreadyDownloadingError,
    ModelDownloadFailedError,
    ModelDownloadNotFoundError,
    ModelHubDependencyError,
    ModelHubError,
    ModelNotDownloadedError,
    UnknownModelError,
)
from nola.model_hub.registry import (
    get_model,
    get_model_by_repo_id,
    is_supported_model,
    list_model_ids,
    list_models,
    require_model,
)
from nola.model_hub.storage import (
    ModelStorage,
    normalize_configured_model_dir,
    resolve_model_dir,
)

__all__ = [
    "DownloadProgress",
    "DownloadStatus",
    "get_model",
    "get_model_by_repo_id",
    "is_supported_model",
    "list_model_ids",
    "list_models",
    "InvalidModelDirectoryError",
    "ModelAlreadyDownloadingError",
    "ModelCatalog",
    "ModelDirSource",
    "ModelDownloader",
    "ModelDownloaderPort",
    "ModelDownloadFailedError",
    "ModelDownloadNotFoundError",
    "ModelHubDependencyError",
    "ModelHubError",
    "ModelInfo",
    "ModelLanguageCategory",
    "ModelNotDownloadedError",
    "ModelStorage",
    "ModelStoragePort",
    "normalize_configured_model_dir",
    "ProgressCallback",
    "require_model",
    "resolve_model_dir",
    "UnknownModelError",
]
