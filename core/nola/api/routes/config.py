"""Configuration API endpoints."""

from __future__ import annotations

from collections.abc import Mapping

from fastapi import APIRouter, Response, status

from nola.api.deps import get_app_config_db
from nola.api.schemas import (
    ExportDefaultsUpdateRequest,
    TranscriptionDefaultsUpdateRequest,
)
from nola.config import settings
from nola.config.common import apply_override_patch
from nola.config.export import (
    EXPORT_CONFIG_PREFIX,
    ExportConfigResponse,
    ExportDefaultsPatchResponse,
    ExportResolvedDefaultsResponse,
)
from nola.config.export import (
    get_effective_defaults as get_effective_export_defaults,
)
from nola.config.transcription import (
    AppConfigResponse,
    EngineConfigResponse,
    EngineDefaultsResponse,
    TranscriptionConfigResponse,
    TranscriptionDefaultsPatchResponse,
    TranscriptionResolvedDefaultsResponse,
    build_file_config,
    get_effective_languages,
    get_engine_defaults,
    get_transcription_param_schema,
    is_multilingual,
)
from nola.config.transcription import (
    get_effective_defaults as get_effective_transcription_defaults,
)
from nola.models import AppConfigDatabase

router = APIRouter(prefix="/api/config", tags=["config"])


def _build_engine_config() -> EngineConfigResponse:
    """Project settings into the public engine-config response."""
    return EngineConfigResponse(
        model_size=settings.model_size,
        device=settings.device,
        compute_type=settings.compute_type,
        is_multilingual=is_multilingual(settings.model_size),
    )


def _to_resolved_defaults(
    defaults: Mapping[str, object],
) -> TranscriptionResolvedDefaultsResponse:
    """Validate defaults payloads against the typed API response contract."""
    return TranscriptionResolvedDefaultsResponse.model_validate(dict(defaults))


def _to_export_resolved_defaults(
    defaults: Mapping[str, object],
) -> ExportResolvedDefaultsResponse:
    """Validate export defaults against the typed API response contract."""
    return ExportResolvedDefaultsResponse.model_validate(dict(defaults))


def _build_app_config_response(config_db: AppConfigDatabase) -> AppConfigResponse:
    """Assemble the aggregated configuration payload used by the frontend."""
    return AppConfigResponse(
        engine=_build_engine_config(),
        transcription=TranscriptionConfigResponse(
            defaults=_to_resolved_defaults(
                get_effective_transcription_defaults(config_db)
            ),
            schema=get_transcription_param_schema(),
        ),
        file=build_file_config(),
        effective_languages=get_effective_languages(settings.model_size),
    )


@router.get(
    "",
    summary="Get aggregated application configuration",
    description=(
        "Return the frontend-facing configuration view, including engine info, "
        "effective transcription defaults, transcription field metadata, upload "
        "constraints, and model-compatible language options."
    ),
    response_model=AppConfigResponse,
    status_code=status.HTTP_200_OK,
)
def get_config() -> AppConfigResponse:
    """Return the aggregated config contract required by the frontend."""
    return _build_app_config_response(get_app_config_db())


@router.get(
    "/transcription/engine-defaults",
    summary="Get raw transcription engine defaults",
    description=(
        "Return the non-batched WhisperModel defaults expanded with the full "
        "VadOptions default set, without any persisted application overrides."
    ),
    response_model=EngineDefaultsResponse,
    status_code=status.HTTP_200_OK,
)
def get_transcription_engine_defaults() -> EngineDefaultsResponse:
    """Return the source-of-truth engine defaults for reset and diff flows."""
    return EngineDefaultsResponse(defaults=_to_resolved_defaults(get_engine_defaults()))


@router.patch(
    "/transcription/defaults",
    summary="Update persisted transcription defaults",
    description=(
        "Apply a partial update to the persisted application-level transcription "
        "defaults. Explicit null removes an override key, and nested objects are "
        "merged without replacing untouched subkeys."
    ),
    response_model=TranscriptionDefaultsPatchResponse,
    status_code=status.HTTP_200_OK,
)
def patch_transcription_defaults(
    request: TranscriptionDefaultsUpdateRequest,
) -> TranscriptionDefaultsPatchResponse:
    """Persist a partial transcription-defaults update."""
    config_db = get_app_config_db()
    patch_values = request.get_options_dict()

    if patch_values:
        # This PATCH flow is a read-modify-write sequence.
        # Concurrent PATCH requests can overwrite each other's updates because
        # the merge happens in application code, not inside one locked SQL step.
        # That tradeoff is acceptable for the current low-traffic config surface.
        current_overrides = config_db.get_all("transcription.")
        next_overrides = apply_override_patch(current_overrides, patch_values)
        config_db.replace_many("transcription.", next_overrides)

    return TranscriptionDefaultsPatchResponse(
        defaults=_to_resolved_defaults(get_effective_transcription_defaults(config_db))
    )


@router.delete(
    "/transcription/defaults",
    summary="Reset persisted transcription defaults",
    description=(
        "Delete the application-level transcription-defaults override layer and "
        "fall back to the raw engine defaults."
    ),
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_transcription_defaults() -> Response:
    """Remove all persisted transcription overrides."""
    get_app_config_db().delete_all("transcription.")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/export",
    summary="Get effective export defaults",
    description=(
        "Return export defaults after applying persisted overrides on top of "
        "the built-in server defaults."
    ),
    response_model=ExportConfigResponse,
    status_code=status.HTTP_200_OK,
)
def get_export_config() -> ExportConfigResponse:
    """Return the export-defaults contract required by export dialogs."""
    config_db = get_app_config_db()
    return ExportConfigResponse(
        defaults=_to_export_resolved_defaults(get_effective_export_defaults(config_db))
    )


@router.patch(
    "/export/defaults",
    summary="Update persisted export defaults",
    description=(
        "Apply a partial update to application-level export defaults. "
        "Explicit null removes an override key."
    ),
    response_model=ExportDefaultsPatchResponse,
    status_code=status.HTTP_200_OK,
)
def patch_export_defaults(
    request: ExportDefaultsUpdateRequest,
) -> ExportDefaultsPatchResponse:
    """Persist a partial export-defaults update."""
    config_db = get_app_config_db()
    patch_values = request.get_options_dict()

    if patch_values:
        config_db.patch_many(EXPORT_CONFIG_PREFIX, patch_values)

    return ExportDefaultsPatchResponse(
        defaults=_to_export_resolved_defaults(get_effective_export_defaults(config_db))
    )


@router.delete(
    "/export/defaults",
    summary="Reset persisted export defaults",
    description=(
        "Delete persisted export-default overrides and fall back to built-in "
        "server defaults."
    ),
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_export_defaults() -> Response:
    """Remove all persisted export-default overrides."""
    get_app_config_db().delete_all(EXPORT_CONFIG_PREFIX)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
