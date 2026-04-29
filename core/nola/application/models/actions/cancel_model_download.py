"""Cancel-model-download use-case."""

from nola.application.models.errors import ModelUseCaseError
from nola.application.models.types import ModelCancelPayload
from nola.application.models.values import canonicalize_model_id
from nola.model_hub import ModelDownloaderPort, ModelDownloadNotFoundError


def cancel_model_download(
    *,
    downloader: ModelDownloaderPort,
    model_id: str,
) -> ModelCancelPayload:
    """Cancel one active model download."""
    canonical_id = canonicalize_model_id(model_id)
    try:
        downloader.cancel_download(canonical_id)
    except ModelDownloadNotFoundError as exc:
        raise ModelUseCaseError(
            status_code=404,
            detail=f"No active download: {model_id}",
        ) from exc

    return {
        "model_id": canonical_id,
        "message": f"Download cancelled for {model_id}",
    }
