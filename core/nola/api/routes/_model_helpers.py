"""Shared helpers for model-related API route state."""

from __future__ import annotations

from pathlib import Path

from nola.config.common.types import ConfigMap
from nola.model_hub import get_model


def canonicalize_model_id(raw_model_id: str) -> str:
    """Resolve one alias to its canonical model id when known."""
    model = get_model(raw_model_id)
    return model.model_id if model is not None else raw_model_id


def canonicalize_optional_model_id(raw_model_id: object) -> str | None:
    """Resolve one optional model-id value to a canonical id when possible."""
    return (
        canonicalize_model_id(raw_model_id) if isinstance(raw_model_id, str) else None
    )


def compute_restart_required(
    configured_model_id: str,
    effective_model_dir: Path,
    worker_state: ConfigMap,
) -> bool:
    """Compare configured model state against the last loaded Worker state."""
    last_loaded_raw = worker_state.get("last_loaded_model_id")
    last_loaded_dir = worker_state.get("last_loaded_model_dir")
    if not isinstance(last_loaded_raw, str) or not isinstance(last_loaded_dir, str):
        return False
    return (
        configured_model_id != canonicalize_model_id(last_loaded_raw)
        or str(effective_model_dir) != last_loaded_dir
    )
