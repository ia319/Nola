"""Declare model use-case contracts used by the application layer."""

from collections.abc import Callable
from typing import Protocol

from nola.config.common.types import ConfigMap
from nola.model_hub import ModelDownloaderPort


class SupportsModelConfig(Protocol):
    """Expose model-related app-config reads and writes."""

    def get_all(self, prefix: str) -> ConfigMap:
        """Return all config values under one prefix."""
        ...

    def set_many(self, prefix: str, values: ConfigMap) -> list[str]:
        """Write config values under one prefix."""
        ...


ModelDirectoryCacheInvalidator = Callable[[], None]
ModelDownloaderProvider = Callable[[], ModelDownloaderPort]
