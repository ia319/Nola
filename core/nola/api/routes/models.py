"""Model management API endpoints."""

from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncGenerator
from contextlib import suppress
from pathlib import Path
from typing import NoReturn

from fastapi import APIRouter, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse

from nola.api.deps import (
    get_app_config_db,
    get_event_bus,
    get_model_downloader,
    get_model_operation_locks,
    get_model_storage,
    invalidate_model_dir_caches,
)
from nola.api.schemas.models import (
    ActiveModelDownloadsResponse,
    DetailResponse,
    ModelCancelResponse,
    ModelDeleteResponse,
    ModelDetailResponse,
    ModelDownloadStartedResponse,
    ModelListResponse,
    ModelListSortField,
    ModelListSortOrder,
    ModelSelectResponse,
    ModelSettingsResponse,
    ModelSettingsUpdateRequest,
    ModelStatusLiteral,
)
from nola.application.models import (
    cancel_model_download,
    delete_model_cache,
    get_model_detail,
    get_model_settings,
    list_active_downloads,
    list_models,
    select_configured_model,
    start_model_download,
    update_model_settings,
)
from nola.application.models.errors import ModelUseCaseError
from nola.application.models.types import (
    ActiveModelDownloadsPayload,
    ModelCancelPayload,
    ModelDeletePayload,
    ModelDownloadStartedPayload,
    ModelListPayload,
    ModelPayload,
    ModelSelectPayload,
    ModelSettingsPayload,
)
from nola.config import settings

router = APIRouter(prefix="/api/models", tags=["models"])
_SSE_KEEPALIVE_INTERVAL_SECONDS = 20.0


def _raise_model_http_error(error: ModelUseCaseError) -> NoReturn:
    """Raise an HTTPException from a model use-case error."""
    raise HTTPException(status_code=error.status_code, detail=error.detail) from error


def _model_dir_inputs() -> tuple[Path | None, Path]:
    """Return the configured model-dir inputs for use-cases."""
    return settings.model_dir, settings.default_model_dir


@router.get(
    "",
    summary="List all models",
    response_model=ModelListResponse,
    status_code=status.HTTP_200_OK,
)
def list_all_models(
    model_status: ModelStatusLiteral | None = Query(
        None,
        alias="status",
        description="Filter by model cache/download status",
    ),
    q: str | None = Query(
        None,
        description=(
            "Search by model id, alias, name, repo id, language, status, or description"
        ),
    ),
    sort_by: ModelListSortField | None = Query(None, description="Sort field"),
    order: ModelListSortOrder = Query("asc", description="Sort order"),
) -> ModelListPayload:
    """Return all registered models with local state and download progress."""
    env_model_dir, default_model_dir = _model_dir_inputs()
    return list_models(
        config_store=get_app_config_db(),
        storage=get_model_storage(),
        downloader=get_model_downloader(),
        env_model_dir=env_model_dir,
        default_model_dir=default_model_dir,
        model_status=model_status,
        q=q,
        sort_by=sort_by,
        order=order,
    )


@router.get(
    "/downloads",
    summary="List active model downloads",
    response_model=ActiveModelDownloadsResponse,
    status_code=status.HTTP_200_OK,
)
def list_active_model_downloads() -> ActiveModelDownloadsPayload:
    """Return active model downloads with real current speed snapshots."""
    return list_active_downloads(downloader=get_model_downloader())


@router.get(
    "/settings",
    summary="Get model settings",
    response_model=ModelSettingsResponse,
    status_code=status.HTTP_200_OK,
)
def read_model_settings() -> ModelSettingsPayload:
    """Return model directory configuration and worker runtime state."""
    env_model_dir, default_model_dir = _model_dir_inputs()
    return get_model_settings(
        config_store=get_app_config_db(),
        env_model_dir=env_model_dir,
        default_model_dir=default_model_dir,
    )


@router.get(
    "/events",
    summary="Model download SSE stream",
    response_class=StreamingResponse,
    response_model=None,
    status_code=status.HTTP_200_OK,
    responses={200: {"content": {"text/event-stream": {}}}},
)
async def model_events(request: Request) -> StreamingResponse:
    """Stream model download progress events via SSE."""
    bus = get_event_bus()

    async def event_generator() -> AsyncGenerator[str]:
        subscription = bus.subscribe("model_downloads")
        pending_event: asyncio.Task[object] | None = asyncio.create_task(
            anext(subscription)
        )

        try:
            while pending_event is not None:
                if await request.is_disconnected():
                    break

                done, _ = await asyncio.wait(
                    {pending_event},
                    timeout=_SSE_KEEPALIVE_INTERVAL_SECONDS,
                )
                if not done:
                    if await request.is_disconnected():
                        break
                    yield ": keepalive\n\n"
                    continue

                try:
                    payload = pending_event.result()
                except StopAsyncIteration:
                    break

                pending_event = asyncio.create_task(anext(subscription))
                yield f"event: progress\ndata: {json.dumps(payload)}\n\n"
        finally:
            if pending_event is not None:
                pending_event.cancel()
                with suppress(asyncio.CancelledError, StopAsyncIteration):
                    await pending_event
            await subscription.aclose()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get(
    "/{model_id}",
    summary="Get model detail",
    response_model=ModelDetailResponse,
    status_code=status.HTTP_200_OK,
    responses={404: {"description": "Unknown model id"}},
)
def read_model_detail(model_id: str) -> ModelPayload:
    """Return one model with full detail."""
    try:
        return get_model_detail(
            config_store=get_app_config_db(),
            storage=get_model_storage(),
            downloader=get_model_downloader(),
            model_id=model_id,
        )
    except ModelUseCaseError as error:
        _raise_model_http_error(error)


@router.post(
    "/{model_id}/download",
    summary="Start model download",
    response_model=ModelDownloadStartedResponse,
    status_code=status.HTTP_202_ACCEPTED,
    responses={
        404: {"description": "Unknown model id"},
        409: {
            "description": "Download already in progress or model already downloaded"
        },
    },
)
def start_download(model_id: str) -> ModelDownloadStartedPayload:
    """Accept a download request and start background download."""
    try:
        return start_model_download(
            storage=get_model_storage(),
            get_downloader=get_model_downloader,
            operation_locks=get_model_operation_locks(),
            model_id=model_id,
        )
    except ModelUseCaseError as error:
        _raise_model_http_error(error)


@router.post(
    "/{model_id}/cancel",
    summary="Cancel model download",
    response_model=ModelCancelResponse,
    status_code=status.HTTP_200_OK,
    responses={
        404: {"description": "No active download for this model"},
    },
)
def cancel_download(model_id: str) -> ModelCancelPayload:
    """Cancel one active download."""
    try:
        return cancel_model_download(
            downloader=get_model_downloader(),
            model_id=model_id,
        )
    except ModelUseCaseError as error:
        _raise_model_http_error(error)


@router.delete(
    "/{model_id}",
    summary="Delete model cache",
    response_model=ModelDeleteResponse,
    status_code=status.HTTP_200_OK,
    responses={
        404: {"description": "Unknown model id or not downloaded"},
        409: {"description": "Model is downloading or is configured model"},
    },
)
def delete_model(model_id: str) -> ModelDeletePayload:
    """Delete local model cache (full or partial)."""
    try:
        return delete_model_cache(
            config_store=get_app_config_db(),
            storage=get_model_storage(),
            downloader=get_model_downloader(),
            operation_locks=get_model_operation_locks(),
            model_id=model_id,
        )
    except ModelUseCaseError as error:
        _raise_model_http_error(error)


@router.post(
    "/{model_id}/select",
    summary="Select configured model",
    response_model=ModelSelectResponse,
    status_code=status.HTTP_200_OK,
    responses={
        404: {"description": "Unknown model id"},
        409: {"description": "Model not downloaded"},
    },
)
def select_model(model_id: str) -> ModelSelectPayload:
    """Set the default model used by future tasks."""
    try:
        return select_configured_model(
            config_store=get_app_config_db(),
            storage=get_model_storage(),
            model_id=model_id,
        )
    except ModelUseCaseError as error:
        _raise_model_http_error(error)


@router.patch(
    "/settings",
    summary="Update model settings",
    response_model=ModelSettingsResponse,
    status_code=status.HTTP_200_OK,
    responses={
        409: {
            "model": DetailResponse,
            "description": "Downloads active for current model directory",
        },
    },
)
def patch_model_settings(
    request: ModelSettingsUpdateRequest,
) -> ModelSettingsPayload:
    """Persist model directory configuration."""
    env_model_dir, default_model_dir = _model_dir_inputs()
    try:
        return update_model_settings(
            config_store=get_app_config_db(),
            downloader=get_model_downloader(),
            env_model_dir=env_model_dir,
            default_model_dir=default_model_dir,
            configured_model_dir=request.configured_model_dir,
            invalidate_model_dir_caches=invalidate_model_dir_caches,
        )
    except ModelUseCaseError as error:
        _raise_model_http_error(error)
