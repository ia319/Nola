"""Get-model-detail use-case."""

from nola.application.models.contracts import SupportsModelConfig
from nola.application.models.errors import ModelUseCaseError
from nola.application.models.payloads import build_model_payload
from nola.application.models.types import ModelPayload
from nola.model_hub import (
    ModelDownloaderPort,
    ModelStoragePort,
    UnknownModelError,
    require_model,
)


def get_model_detail(
    *,
    config_store: SupportsModelConfig,
    storage: ModelStoragePort,
    downloader: ModelDownloaderPort,
    model_id: str,
) -> ModelPayload:
    """Return one model with full detail."""
    try:
        info = require_model(model_id)
    except UnknownModelError as exc:
        raise ModelUseCaseError(
            status_code=404,
            detail=f"Unknown model id: {model_id}",
        ) from exc

    model, _ = build_model_payload(
        info=info,
        model_config=config_store.get_all("model."),
        worker_state=config_store.get_all("worker."),
        storage=storage,
        downloader=downloader,
    )
    return model
