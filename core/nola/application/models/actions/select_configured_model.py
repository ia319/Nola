"""Select-configured-model use-case."""

from nola.application.models.contracts import SupportsModelConfig
from nola.application.models.errors import ModelUseCaseError
from nola.application.models.types import ModelSelectPayload
from nola.model_hub import (
    ModelStoragePort,
    UnknownModelError,
    require_model,
)


def select_configured_model(
    *,
    config_store: SupportsModelConfig,
    storage: ModelStoragePort,
    model_id: str,
) -> ModelSelectPayload:
    """Set the default model used by future tasks."""
    try:
        info = require_model(model_id)
    except UnknownModelError as exc:
        raise ModelUseCaseError(
            status_code=404,
            detail=f"Unknown model id: {model_id}",
        ) from exc

    if storage.get_cache_state(info.repo_id) != "downloaded":
        raise ModelUseCaseError(
            status_code=409,
            detail=f"Model not downloaded: {model_id}",
        )

    config_store.set_many("model.", {"configured_model_id": info.model_id})

    return {
        "configured_model_id": info.model_id,
        "restart_required": False,
        "message": f"Configured model set to {info.name}",
    }
