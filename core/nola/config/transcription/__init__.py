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
from nola.config.transcription.schema.models import (
    OptionFieldSchema,
    OptionGroupSchema,
)
from nola.config.transcription.schema.registry import get_transcription_param_schema
from nola.config.transcription.schema.responses import (
    AppConfigResponse,
    EngineConfigResponse,
    EngineDefaultsResponse,
    FileConfigResponse,
    LiveRealtimeConfigResponse,
    ModelConfigResponse,
    TranscriptionConfigResponse,
    TranscriptionDefaultsPatchResponse,
    TranscriptionResolvedDefaultsResponse,
    VadParametersDefaultsResponse,
    build_file_config,
)

__all__ = [
    "AppConfigResponse",
    "build_file_config",
    "EngineConfigResponse",
    "EngineDefaultsResponse",
    "FileConfigResponse",
    "LiveRealtimeConfigResponse",
    "ModelConfigResponse",
    "get_effective_defaults",
    "get_effective_languages",
    "get_engine_defaults",
    "is_multilingual",
    "LanguageOptionSchema",
    "OptionFieldSchema",
    "OptionGroupSchema",
    "get_transcription_param_schema",
    "TranscriptionConfigResponse",
    "TranscriptionDefaultsPatchResponse",
    "TranscriptionResolvedDefaultsResponse",
    "VadParametersDefaultsResponse",
]
