"""Update-model-settings use-case."""

from pathlib import Path

from nola.application.models.contracts import (
    ModelDirectoryCacheInvalidator,
    SupportsModelConfig,
)
from nola.application.models.errors import ModelUseCaseError
from nola.application.models.queries.get_model_settings import get_model_settings
from nola.application.models.types import ModelSettingsPayload
from nola.model_hub import (
    InvalidModelDirectoryError,
    ModelDownloaderPort,
    normalize_configured_model_dir,
)


def update_model_settings(
    *,
    config_store: SupportsModelConfig,
    downloader: ModelDownloaderPort,
    env_model_dir: Path | None,
    default_model_dir: Path,
    configured_model_dir: str | None,
    invalidate_model_dir_caches: ModelDirectoryCacheInvalidator,
) -> ModelSettingsPayload:
    """Persist model directory configuration."""
    if configured_model_dir is not None:
        if downloader.list_downloads():
            raise ModelUseCaseError(
                status_code=409,
                detail=(
                    "Cannot change model directory while downloads are active. "
                    "Cancel all downloads first."
                ),
            )

        try:
            normalized = normalize_configured_model_dir(configured_model_dir)
        except InvalidModelDirectoryError as exc:
            raise ModelUseCaseError(status_code=422, detail=str(exc)) from exc

        config_store.set_many("model.", {"configured_model_dir": str(normalized)})
        invalidate_model_dir_caches()

    return get_model_settings(
        config_store=config_store,
        env_model_dir=env_model_dir,
        default_model_dir=default_model_dir,
    )
