"""Get-model-settings use-case."""

from pathlib import Path

from nola.application.models.contracts import SupportsModelConfig
from nola.application.models.payloads import resolve_effective_model_dir
from nola.application.models.types import ModelSettingsPayload
from nola.application.models.values import (
    canonicalize_optional_engine_compute_type,
    canonicalize_optional_engine_device,
    canonicalize_optional_model_id,
)


def get_model_settings(
    *,
    config_store: SupportsModelConfig,
    env_model_dir: Path | None,
    default_model_dir: Path,
) -> ModelSettingsPayload:
    """Return model directory configuration and worker runtime state."""
    model_config = config_store.get_all("model.")
    worker_state = config_store.get_all("worker.")
    effective_dir, source = resolve_effective_model_dir(
        model_config=model_config,
        env_model_dir=env_model_dir,
        default_model_dir=default_model_dir,
    )
    db_model_dir = model_config.get("configured_model_dir")

    return {
        "configured_model_id": canonicalize_optional_model_id(
            model_config.get("configured_model_id")
        ),
        "last_loaded_model_id": canonicalize_optional_model_id(
            worker_state.get("last_loaded_model_id")
        ),
        "last_loaded_device": canonicalize_optional_engine_device(
            worker_state.get("last_loaded_device")
        ),
        "last_loaded_compute_type": canonicalize_optional_engine_compute_type(
            worker_state.get("last_loaded_compute_type")
        ),
        "configured_model_dir": db_model_dir if isinstance(db_model_dir, str) else None,
        "effective_model_dir": str(effective_dir),
        "override_source": source,
        "restart_required": False,
    }
