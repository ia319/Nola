"""List-models use-case."""

from pathlib import Path

from nola.application.models.contracts import SupportsModelConfig
from nola.application.models.payloads import (
    build_model_entries,
    model_matches_query,
    resolve_effective_model_dir,
    sort_model_entries,
)
from nola.application.models.types import (
    ModelListPayload,
    ModelListSortField,
    ModelListSortOrder,
    ModelStatusValue,
)
from nola.application.models.values import canonicalize_optional_model_id
from nola.model_hub import ModelDownloaderPort, ModelStoragePort


def list_models(
    *,
    config_store: SupportsModelConfig,
    storage: ModelStoragePort,
    downloader: ModelDownloaderPort,
    env_model_dir: Path | None,
    default_model_dir: Path,
    model_status: ModelStatusValue | None,
    q: str | None,
    sort_by: ModelListSortField | None,
    order: ModelListSortOrder,
) -> ModelListPayload:
    """Return all registered models with local state and query controls."""
    model_config = config_store.get_all("model.")
    worker_state = config_store.get_all("worker.")
    effective_dir, _ = resolve_effective_model_dir(
        model_config=model_config,
        env_model_dir=env_model_dir,
        default_model_dir=default_model_dir,
    )
    entries = [
        entry
        for entry in build_model_entries(
            model_config=model_config,
            worker_state=worker_state,
            storage=storage,
            downloader=downloader,
        )
        if (model_status is None or entry[0]["status"] == model_status)
        and model_matches_query(entry[1], q)
    ]

    return {
        "models": [entry[0] for entry in sort_model_entries(entries, sort_by, order)],
        "configured_model_id": canonicalize_optional_model_id(
            model_config.get("configured_model_id")
        ),
        "last_loaded_model_id": canonicalize_optional_model_id(
            worker_state.get("last_loaded_model_id")
        ),
        "effective_model_dir": str(effective_dir),
    }
