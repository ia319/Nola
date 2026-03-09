"""Transcription configuration subpackage."""

from nola.config.transcription.defaults import (
    get_effective_defaults,
    get_engine_defaults,
)
from nola.config.transcription.languages import (
    LanguageOptionSchema,
    get_effective_languages,
    is_multilingual,
)
from nola.config.transcription.metadata import (
    TRANSCRIPTION_PARAM_SCHEMA,
    AppConfigResponse,
    EngineConfigResponse,
    EngineDefaultsResponse,
    FileConfigResponse,
    OptionFieldSchema,
    OptionGroupSchema,
    TranscriptionConfigResponse,
    TranscriptionDefaultsPatchResponse,
    build_file_config,
)

__all__ = [
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
    "OptionFieldSchema",
    "OptionGroupSchema",
    "TRANSCRIPTION_PARAM_SCHEMA",
    "TranscriptionConfigResponse",
    "TranscriptionDefaultsPatchResponse",
]
