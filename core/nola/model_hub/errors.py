"""Model-hub error types."""

from __future__ import annotations


class ModelHubError(Exception):
    """Base exception for model-management failures."""


class UnknownModelError(ModelHubError):
    """Raise when a model id is not part of the supported registry."""

    def __init__(self, model_id: str) -> None:
        """Store the missing model id and build a stable message."""
        self.model_id = model_id
        super().__init__(f"Unknown model id: {model_id}")
