"""Export configuration response models."""

from pydantic import BaseModel

from nola.config.export.types import ExportFormat


class ExportResolvedDefaultsResponse(BaseModel):
    """Expose fully resolved export defaults used at runtime."""

    format: ExportFormat
    include_timestamps: bool


class ExportConfigResponse(BaseModel):
    """Expose effective export defaults required by frontend clients."""

    defaults: ExportResolvedDefaultsResponse


class ExportDefaultsPatchResponse(BaseModel):
    """Return effective export defaults after a PATCH update."""

    defaults: ExportResolvedDefaultsResponse
