"""Configuration API request schemas."""

from typing import cast

from pydantic import BaseModel, ConfigDict, Field, field_validator

from nola.api.schemas.transcriptions import TranscriptionDefaultsUpdateRequest
from nola.config.common import ConfigMap
from nola.config.export import ExportFormat
from nola.config.session import SessionExecutionDefaultsPatch
from nola.config.transcription.schema.responses import (
    TranscriptionResolvedDefaultsResponse,
)
from nola.engines.base import EngineComputeType, EngineDevice
from nola.model_hub import get_model


class ExportDefaultsUpdateRequest(BaseModel):
    """Partial update payload for application-level export defaults."""

    model_config = ConfigDict(
        extra="forbid",
        json_schema_extra={"example": {"format": "vtt", "include_timestamps": False}},
    )

    format: ExportFormat | None = Field(None, description="Default export format")
    include_timestamps: bool | None = Field(
        None,
        description="Whether TXT export includes timestamp prefixes by default",
    )

    def get_options_dict(self) -> ConfigMap:
        """Return explicitly provided keys, preserving nulls for field resets."""
        return cast(ConfigMap, self.model_dump(exclude_unset=True))


class SessionExecutionDefaultsResponse(BaseModel):
    """Expose resolved execution defaults for new session tasks."""

    model_id: str
    device: EngineDevice
    compute_type: EngineComputeType


class SessionDefaultsResponse(BaseModel):
    """Expose Workbench defaults split by execution and transcription scope."""

    execution: SessionExecutionDefaultsResponse
    transcription: TranscriptionResolvedDefaultsResponse


class SessionExecutionDefaultsUpdateRequest(BaseModel):
    """Partial update payload for session execution defaults."""

    model_config = ConfigDict(
        extra="forbid",
        json_schema_extra={
            "example": {
                "model_id": "small",
                "device": "auto",
                "compute_type": "default",
            }
        },
    )

    model_id: str | None = Field(None, description="Default model id for new tasks")
    device: EngineDevice | None = Field(
        None,
        description="Default engine device for new tasks",
    )
    compute_type: EngineComputeType | None = Field(
        None,
        description="Default engine compute type for new tasks",
    )

    @field_validator("model_id")
    @classmethod
    def check_model_id(cls, value: str | None) -> str | None:
        """Reject unknown model ids and normalize aliases to canonical ids."""
        if value is None:
            return None

        model = get_model(value)
        if model is None:
            raise ValueError(f"Unknown model id: {value}")
        return model.model_id

    def get_options_dict(self) -> SessionExecutionDefaultsPatch:
        """Return explicitly provided keys, preserving nulls for field resets."""
        raw_values = self.model_dump(exclude_unset=True)
        patch: SessionExecutionDefaultsPatch = {}

        if "model_id" in raw_values:
            patch["model_id"] = cast(str | None, raw_values["model_id"])
        if "device" in raw_values:
            patch["device"] = cast(str | None, raw_values["device"])
        if "compute_type" in raw_values:
            patch["compute_type"] = cast(str | None, raw_values["compute_type"])

        return patch


class SessionDefaultsUpdateRequest(BaseModel):
    """Partial update payload for session defaults."""

    model_config = ConfigDict(
        extra="forbid",
        json_schema_extra={
            "example": {
                "execution": {
                    "model_id": "small",
                    "device": "auto",
                    "compute_type": "default",
                },
                "transcription": {
                    "vad_filter": True,
                    "vad_parameters": {"threshold": 0.1},
                },
            }
        },
    )

    execution: SessionExecutionDefaultsUpdateRequest | None = None
    transcription: TranscriptionDefaultsUpdateRequest | None = None
