"""Configuration API endpoints."""

from __future__ import annotations

from collections.abc import Mapping

from fastapi import APIRouter, Response, status

from nola.api.deps import get_app_config_db
from nola.api.routes._model_helpers import (
    canonicalize_model_id,
    canonicalize_optional_engine_compute_type,
    canonicalize_optional_engine_device,
    canonicalize_optional_model_id,
    legacy_restart_required,
)
from nola.api.schemas import (
    ExportDefaultsUpdateRequest,
    SessionDefaultsResponse,
    SessionDefaultsUpdateRequest,
    SessionExecutionDefaultsResponse,
    TranscriptionDefaultsUpdateRequest,
)
from nola.api.schemas.models import ModelConfigResponse
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
from nola.config.session import (
    get_session_defaults,
    patch_session_execution_defaults,
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
from nola.engines.base import (
    DEFAULT_ENGINE_COMPUTE_TYPE,
    DEFAULT_ENGINE_DEVICE,
    EngineComputeType,
    EngineDevice,
)
from nola.model_hub import get_model
from nola.models import AppConfigDatabase

router = APIRouter(prefix="/api/config", tags=["config"])


def _resolve_runtime_model_id(config_db: AppConfigDatabase) -> str:
    """Return the canonical model id reflected by runtime config APIs."""
    worker_state = config_db.get_all("worker.")
    last_loaded = worker_state.get("last_loaded_model_id")
    if isinstance(last_loaded, str):
        model = get_model(last_loaded)
        if model is not None:
            return model.model_id
    return canonicalize_model_id(settings.model_size)


def _resolve_configured_model_id(config_db: AppConfigDatabase) -> str:
    """Return the canonical user-configured model id for next startup."""
    model_config = config_db.get_all("model.")
    configured = model_config.get("configured_model_id")
    if isinstance(configured, str):
        model = get_model(configured)
        if model is not None:
            return model.model_id
    return canonicalize_model_id(settings.model_size)


def _resolve_runtime_device(worker_state: Mapping[str, object]) -> EngineDevice:
    """Return the last loaded device, falling back to settings."""
    return (
        canonicalize_optional_engine_device(worker_state.get("last_loaded_device"))
        or canonicalize_optional_engine_device(settings.device)
        or DEFAULT_ENGINE_DEVICE
    )


def _resolve_runtime_compute_type(
    worker_state: Mapping[str, object],
) -> EngineComputeType:
    """Return the last loaded compute type, falling back to settings."""
    return (
        canonicalize_optional_engine_compute_type(
            worker_state.get("last_loaded_compute_type")
        )
        or canonicalize_optional_engine_compute_type(settings.compute_type)
        or DEFAULT_ENGINE_COMPUTE_TYPE
    )


def _build_engine_config(
    runtime_model_id: str,
    worker_state: Mapping[str, object],
) -> EngineConfigResponse:
    """Project settings into the public engine-config response."""
    return EngineConfigResponse(
        model_size=runtime_model_id,
        device=_resolve_runtime_device(worker_state),
        compute_type=_resolve_runtime_compute_type(worker_state),
        is_multilingual=is_multilingual(runtime_model_id),
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


def _build_session_defaults_response(
    config_db: AppConfigDatabase,
) -> SessionDefaultsResponse:
    """Assemble the Workbench session-defaults response."""
    defaults = get_session_defaults(config_db)
    return SessionDefaultsResponse(
        execution=SessionExecutionDefaultsResponse(
            model_id=defaults.execution.model_id,
            device=defaults.execution.device,
            compute_type=defaults.execution.compute_type,
        ),
        transcription=_to_resolved_defaults(defaults.transcription),
    )


def _apply_transcription_defaults_patch(
    config_db: AppConfigDatabase,
    request: TranscriptionDefaultsUpdateRequest,
) -> None:
    """Apply existing transcription-defaults PATCH semantics."""
    patch_values = request.get_options_dict()

    if patch_values:
        # This PATCH flow is a read-modify-write sequence.
        # Concurrent PATCH requests can overwrite each other's updates because
        # the merge happens in application code, not inside one locked SQL step.
        # That tradeoff is acceptable for the current low-traffic config surface.
        current_overrides = config_db.get_all("transcription.")
        next_overrides = apply_override_patch(current_overrides, patch_values)
        config_db.replace_many("transcription.", next_overrides)


def _build_model_config(config_db: AppConfigDatabase) -> ModelConfigResponse:
    """Assemble the model sub-field for the aggregated config response."""
    configured_model_id = _resolve_configured_model_id(config_db)
    worker_state = config_db.get_all("worker.")
    last_loaded = worker_state.get("last_loaded_model_id")
    last_loaded_model_id = canonicalize_optional_model_id(last_loaded)
    last_loaded_device = canonicalize_optional_engine_device(
        worker_state.get("last_loaded_device")
    )
    last_loaded_compute_type = canonicalize_optional_engine_compute_type(
        worker_state.get("last_loaded_compute_type")
    )

    return ModelConfigResponse(
        configured_model_id=configured_model_id,
        last_loaded_model_id=last_loaded_model_id,
        last_loaded_device=last_loaded_device,
        last_loaded_compute_type=last_loaded_compute_type,
        restart_required=legacy_restart_required(),
    )


def _build_app_config_response(config_db: AppConfigDatabase) -> AppConfigResponse:
    """Assemble the aggregated configuration payload used by the frontend."""
    worker_state = config_db.get_all("worker.")
    runtime_model_id = _resolve_runtime_model_id(config_db)
    return AppConfigResponse(
        engine=_build_engine_config(runtime_model_id, worker_state),
        transcription=TranscriptionConfigResponse(
            defaults=_to_resolved_defaults(
                get_effective_transcription_defaults(config_db)
            ),
            schema=get_transcription_param_schema(),
        ),
        file=build_file_config(),
        effective_languages=get_effective_languages(runtime_model_id),
        model=_build_model_config(config_db),
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
    _apply_transcription_defaults_patch(config_db, request)

    return TranscriptionDefaultsPatchResponse(
        defaults=_to_resolved_defaults(get_effective_transcription_defaults(config_db))
    )


@router.get(
    "/session-defaults",
    summary="Get Workbench session defaults",
    description=(
        "Return execution defaults and transcription defaults used when creating "
        "new Workbench transcription tasks."
    ),
    response_model=SessionDefaultsResponse,
    status_code=status.HTTP_200_OK,
)
def get_session_default_config() -> SessionDefaultsResponse:
    """Return defaults for Workbench session creation."""
    return _build_session_defaults_response(get_app_config_db())


@router.patch(
    "/session-defaults",
    summary="Update Workbench session defaults",
    description=(
        "Apply a partial update to execution defaults and transcription defaults. "
        "Explicit null removes execution overrides and falls back to settings."
    ),
    response_model=SessionDefaultsResponse,
    status_code=status.HTTP_200_OK,
)
def patch_session_default_config(
    request: SessionDefaultsUpdateRequest,
) -> SessionDefaultsResponse:
    """Persist partial session-defaults updates."""
    config_db = get_app_config_db()

    if request.execution is not None:
        patch_session_execution_defaults(
            config_db,
            request.execution.get_options_dict(),
        )

    if request.transcription is not None:
        _apply_transcription_defaults_patch(config_db, request.transcription)

    return _build_session_defaults_response(config_db)


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
