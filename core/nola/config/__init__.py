"""Configuration module."""

from nola.config.constants import (
    ALLOWED_AUDIO_TYPES,
    ALLOWED_EXTENSIONS,
    SUPPORTED_LANGUAGES,
)
from nola.config.settings import Settings, settings

__all__ = [
    "ALLOWED_AUDIO_TYPES",
    "ALLOWED_EXTENSIONS",
    "SUPPORTED_LANGUAGES",
    "Settings",
    "settings",
]
