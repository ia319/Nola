"""Configuration API endpoints."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Response, status

from nola.api.deps import get_app_config_db
from nola.api.schemas import TranscriptionDefaultsUpdateRequest
from nola.config import settings
from nola.config.transcription import (
    AppConfigResponse,
    EngineConfigResponse,
    EngineDefaultsResponse,
    TranscriptionConfigResponse,
    TranscriptionDefaultsPatchResponse,
    build_file_config,
    get_effective_defaults,
    get_effective_languages,
    get_engine_defaults,
    get_transcription_param_schema,
    is_multilingual,
)
from nola.models import AppConfigDatabase

router = APIRouter(prefix="/api/config", tags=["config"])

_ALLOWED_VAD_PARAMETER_KEYS = frozenset(get_engine_defaults()["vad_parameters"].keys())


def _validate_vad_parameter_keys(vad_parameters: dict[str, Any]) -> None:
    """Reject nested VAD keys that are not supported by the engine contract."""
    invalid_keys = sorted(set(vad_parameters) - _ALLOWED_VAD_PARAMETER_KEYS)
    if invalid_keys:
        invalid_list = ", ".join(invalid_keys)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unsupported vad_parameters key(s): {invalid_list}",
        )


def _apply_override_patch(
    current_overrides: dict[str, Any],
    patch_values: dict[str, Any],
) -> dict[str, Any]:
    """Apply PATCH semantics where explicit null removes an override key."""
    merged = dict(current_overrides)

    for key, value in patch_values.items():
        if value is None:
            merged.pop(key, None)
            continue

        existing = merged.get(key)
        if isinstance(existing, dict) and isinstance(value, dict):
            nested = _apply_override_patch(existing, value)
            if nested:
                merged[key] = nested
            else:
                merged.pop(key, None)
            continue

        if isinstance(value, dict):
            nested = _apply_override_patch({}, value)
            if nested:
                merged[key] = nested
            else:
                merged.pop(key, None)
            continue

        merged[key] = value

    return merged


def _build_engine_config() -> EngineConfigResponse:
    """Project settings into the public engine-config response."""
    return EngineConfigResponse(
        model_size=settings.model_size,
        device=settings.device,
        compute_type=settings.compute_type,
        is_multilingual=is_multilingual(settings.model_size),
    )


def _build_app_config_response(config_db: AppConfigDatabase) -> AppConfigResponse:
    """Assemble the aggregated configuration payload used by the frontend."""
    return AppConfigResponse(
        engine=_build_engine_config(),
        transcription=TranscriptionConfigResponse(
            defaults=get_effective_defaults(config_db),
            schema_=get_transcription_param_schema(),
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
async def get_config() -> AppConfigResponse:
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
async def get_transcription_engine_defaults() -> EngineDefaultsResponse:
    """Return the source-of-truth engine defaults for reset and diff flows."""
    return EngineDefaultsResponse(defaults=get_engine_defaults())


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
async def patch_transcription_defaults(
    request: TranscriptionDefaultsUpdateRequest,
) -> TranscriptionDefaultsPatchResponse:
    """Persist a partial transcription-defaults update."""
    config_db = get_app_config_db()
    patch_values = request.get_options_dict()

    vad_parameters = patch_values.get("vad_parameters")
    if isinstance(vad_parameters, dict):
        _validate_vad_parameter_keys(vad_parameters)

    if patch_values:
        # This PATCH flow is a read-modify-write sequence.
        # Concurrent PATCH requests can overwrite each other's updates because
        # the merge happens in application code, not inside one locked SQL step.
        # That tradeoff is acceptable for the current low-traffic config surface.
        current_overrides = config_db.get_all("transcription.")
        next_overrides = _apply_override_patch(current_overrides, patch_values)
        config_db.replace_many("transcription.", next_overrides)

    return TranscriptionDefaultsPatchResponse(
        defaults=get_effective_defaults(config_db)
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
async def delete_transcription_defaults() -> Response:
    """Remove all persisted transcription overrides."""
    get_app_config_db().delete_all("transcription.")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
