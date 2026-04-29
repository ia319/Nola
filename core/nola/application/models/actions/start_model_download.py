"""Start-model-download use-case."""

from nola.application.models.contracts import ModelDownloaderProvider
from nola.application.models.errors import ModelUseCaseError
from nola.application.models.types import ModelDownloadStartedPayload
from nola.model_hub import (
    ModelAlreadyDownloadingError,
    ModelStoragePort,
    UnknownModelError,
    require_model,
)


def start_model_download(
    *,
    storage: ModelStoragePort,
    get_downloader: ModelDownloaderProvider,
    model_id: str,
) -> ModelDownloadStartedPayload:
    """Accept a download request and start a background download."""
    try:
        info = require_model(model_id)
    except UnknownModelError as exc:
        raise ModelUseCaseError(
            status_code=404,
            detail=f"Unknown model id: {model_id}",
        ) from exc

    if storage.get_cache_state(info.repo_id) == "downloaded":
        raise ModelUseCaseError(
            status_code=409,
            detail=f"Model already downloaded: {model_id}",
        )

    downloader = get_downloader()
    try:
        downloader.start_download(info)
    except ModelAlreadyDownloadingError as exc:
        raise ModelUseCaseError(
            status_code=409,
            detail=f"Download already in progress: {model_id}",
        ) from exc

    return {
        "model_id": info.model_id,
        "status": "downloading",
        "message": f"Download started for {info.name}",
    }
