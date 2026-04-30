"""Delete-model-cache use-case."""

from nola.application.models.contracts import SupportsModelConfig
from nola.application.models.errors import ModelUseCaseError
from nola.application.models.operation_locks import ModelOperationLocks
from nola.application.models.types import ModelDeletePayload
from nola.application.models.values import canonicalize_model_id
from nola.model_hub import (
    ModelDownloaderPort,
    ModelNotDownloadedError,
    ModelStoragePort,
    UnknownModelError,
    require_model,
)


def delete_model_cache(
    *,
    config_store: SupportsModelConfig,
    storage: ModelStoragePort,
    downloader: ModelDownloaderPort,
    operation_locks: ModelOperationLocks,
    model_id: str,
) -> ModelDeletePayload:
    """Delete local model cache when no runtime state blocks deletion."""
    try:
        info = require_model(model_id)
    except UnknownModelError as exc:
        raise ModelUseCaseError(
            status_code=404,
            detail=f"Unknown model id: {model_id}",
        ) from exc

    with operation_locks.model(info.model_id):
        if downloader.is_downloading(info.model_id):
            raise ModelUseCaseError(
                status_code=409,
                detail=f"Model is currently downloading: {model_id}. Cancel first.",
            )

        configured_raw = config_store.get_all("model.").get("configured_model_id")
        if (
            isinstance(configured_raw, str)
            and canonicalize_model_id(configured_raw) == info.model_id
        ):
            raise ModelUseCaseError(
                status_code=409,
                detail=f"Cannot delete configured model: {model_id}",
            )

        try:
            storage.delete_model(info.repo_id)
        except ModelNotDownloadedError as exc:
            raise ModelUseCaseError(
                status_code=404,
                detail=f"Model not downloaded: {model_id}",
            ) from exc

    return {
        "model_id": info.model_id,
        "message": f"Model cache deleted for {info.name}",
    }
