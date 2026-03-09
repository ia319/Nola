"""Configuration module."""

from nola.config.constants import (
    ALLOWED_AUDIO_TYPES,
    ALLOWED_EXTENSIONS,
    MAX_BATCH_EXPORT_TASKS,
    SUPPORTED_LANGUAGES,
)
from nola.config.settings import Settings, settings
from nola.config.transcription import (
    TRANSCRIPTION_PARAM_SCHEMA,
    AppConfigResponse,
    EngineConfigResponse,
    EngineDefaultsResponse,
    FileConfigResponse,
    LanguageOptionSchema,
    OptionFieldSchema,
    OptionGroupSchema,
    TranscriptionConfigResponse,
    TranscriptionDefaultsPatchResponse,
    build_file_config,
    get_effective_defaults,
    get_effective_languages,
    get_engine_defaults,
    is_multilingual,
)

__all__ = [
    "ALLOWED_AUDIO_TYPES",
    "ALLOWED_EXTENSIONS",
    "AppConfigResponse",
    "build_file_config",
    "EngineConfigResponse",
    "EngineDefaultsResponse",
    "FileConfigResponse",
    "get_effective_defaults",
    "get_effective_languages",
    "get_engine_defaults",
    "is_multilingual",
    "LanguageOptionSchema",
    "MAX_BATCH_EXPORT_TASKS",
    "OptionFieldSchema",
    "OptionGroupSchema",
    "SUPPORTED_LANGUAGES",
    "Settings",
    "settings",
    "TRANSCRIPTION_PARAM_SCHEMA",
    "TranscriptionConfigResponse",
    "TranscriptionDefaultsPatchResponse",
]
