"""Tests for session default configuration helpers."""

from collections.abc import Mapping

import pytest

from nola.config.common.types import ConfigMap
from nola.config.session.defaults import (
    EXECUTION_CONFIG_PREFIX,
    MODEL_CONFIG_PREFIX,
    SessionExecutionDefaultsPatch,
    patch_session_execution_defaults,
)


class RecordingSessionDefaultsStore:
    """Record session-default writes without touching SQLite."""

    def __init__(self) -> None:
        self.patches: list[dict[str, ConfigMap]] = []

    def patch_many_prefixes(
        self,
        patches_by_prefix: Mapping[str, ConfigMap],
    ) -> list[str]:
        self.patches.append(
            {prefix: dict(values) for prefix, values in patches_by_prefix.items()}
        )
        return [
            f"{prefix}{key}"
            for prefix, values in patches_by_prefix.items()
            for key in values
        ]


def test_patch_session_execution_defaults_patches_prefixes_together() -> None:
    """Execution defaults should use one cross-prefix patch call."""
    store = RecordingSessionDefaultsStore()
    patch_values: SessionExecutionDefaultsPatch = {
        "model_id": "large",
        "device": "cuda",
        "compute_type": "float16",
    }

    patch_session_execution_defaults(store, patch_values)

    assert store.patches == [
        {
            MODEL_CONFIG_PREFIX: {"configured_model_id": "large-v3"},
            EXECUTION_CONFIG_PREFIX: {
                "device": "cuda",
                "compute_type": "float16",
            },
        }
    ]


def test_patch_session_execution_defaults_rejects_invalid_device() -> None:
    """Direct helper calls should reject unknown execution devices."""
    store = RecordingSessionDefaultsStore()
    patch_values: SessionExecutionDefaultsPatch = {"device": "metal"}

    with pytest.raises(ValueError, match="Invalid session execution device: metal"):
        patch_session_execution_defaults(store, patch_values)

    assert store.patches == []


def test_patch_session_execution_defaults_rejects_invalid_compute_type() -> None:
    """Direct helper calls should reject unknown execution compute types."""
    store = RecordingSessionDefaultsStore()
    patch_values: SessionExecutionDefaultsPatch = {"compute_type": "float32"}

    with pytest.raises(
        ValueError,
        match="Invalid session execution compute_type: float32",
    ):
        patch_session_execution_defaults(store, patch_values)

    assert store.patches == []
