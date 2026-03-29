"""Shared model-hub contracts and value objects."""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass, field
from typing import Literal, Protocol

ModelLanguageCategory = Literal["english-only", "multilingual"]
ModelRuntime = Literal["faster-whisper"]


@dataclass(frozen=True, slots=True)
class ModelInfo:
    """Describe one model option exposed by the application."""

    model_id: str
    name: str
    repo_id: str
    runtime: ModelRuntime
    languages: ModelLanguageCategory
    size_bytes: int
    speed_rank: int
    accuracy_rank: int
    description: str
    aliases: tuple[str, ...] = field(default_factory=tuple)


class ModelCatalog(Protocol):
    """Expose lookup helpers over the supported model set."""

    def list_models(self) -> Sequence[ModelInfo]:
        """Return every canonical model in display order."""

    def get_model(self, model_id: str) -> ModelInfo | None:
        """Return one model by canonical id or alias."""

    def get_model_by_repo_id(self, repo_id: str) -> ModelInfo | None:
        """Return one model by the Hugging Face repository id."""
