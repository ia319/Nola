"""Configuration API request schemas."""

from typing import cast

from pydantic import BaseModel, ConfigDict, Field

from nola.config.common import ConfigMap
from nola.services.formatters import ExportFormat


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
