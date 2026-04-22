"""Model management API endpoints."""

from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import AsyncGenerator
from contextlib import suppress
from pathlib import Path

from fastapi import APIRouter, Request, Response, status
from fastapi.responses import StreamingResponse

from nola.api.deps import (
    get_app_config_db,
    get_event_bus,
    get_model_downloader,
    get_model_storage,
    invalidate_model_dir_caches,
)
from nola.api.routes._model_helpers import (
    canonicalize_model_id,
    canonicalize_optional_model_id,
    compute_restart_required,
)
from nola.api.schemas.models import (
    ActiveModelDownloadResponse,
    ActiveModelDownloadsResponse,
    DetailResponse,
    DownloadProgressResponse,
    ModelCancelResponse,
    ModelDeleteResponse,
    ModelDetailResponse,
    ModelDownloadStartedResponse,
    ModelListResponse,
    ModelResponse,
    ModelSelectResponse,
    ModelSettingsResponse,
    ModelSettingsUpdateRequest,
    ModelStatusLiteral,
)
from nola.config import settings
from nola.config.common.types import ConfigMap
from nola.model_hub import (
    DownloadProgress,
    ModelAlreadyDownloadingError,
    ModelDirSource,
    ModelDownloadNotFoundError,
    ModelNotDownloadedError,
    UnknownModelError,
    list_models,
    normalize_configured_model_dir,
    require_model,
    resolve_model_dir,
)
from nola.model_hub.errors import InvalidModelDirectoryError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/models", tags=["models"])
_SSE_KEEPALIVE_INTERVAL_SECONDS = 20.0


def _read_model_config() -> ConfigMap:
    """Read model.* config from database."""
    return get_app_config_db().get_all("model.")


def _read_worker_state() -> ConfigMap:
    """Read worker.* state from database."""
    return get_app_config_db().get_all("worker.")


def _resolve_effective_dir(
    model_config: ConfigMap,
) -> tuple[Path, ModelDirSource]:
    """Return the effective model dir and its override source."""
    db_model_dir = model_config.get("configured_model_dir")
    effective_dir, source = resolve_model_dir(
        settings.model_dir,
        db_model_dir if isinstance(db_model_dir, str) else None,
        settings.default_model_dir,
    )
    return effective_dir, source


def _to_download_progress_response(
    progress: DownloadProgress,
) -> DownloadProgressResponse:
    """Translate one runtime download snapshot into the public schema."""
    return DownloadProgressResponse(
        percent=progress.percent,
        downloaded_bytes=progress.downloaded_bytes,
        total_bytes=progress.total_bytes,
        speed_bps=int(progress.speed_bps),
        error=progress.error,
    )


def _build_active_downloads_response() -> ActiveModelDownloadsResponse:
    """Return the current active-download summary for UI polling."""
    downloader = get_model_downloader()
    runtime_downloads = downloader.list_downloads()
    items: list[ActiveModelDownloadResponse] = []

    for progress in runtime_downloads:
        model_info = require_model(progress.model_id)
        items.append(
            ActiveModelDownloadResponse(
                model_id=model_info.model_id,
                name=model_info.name,
                status=progress.status,
                percent=progress.percent,
                downloaded_bytes=progress.downloaded_bytes,
                total_bytes=progress.total_bytes,
                speed_bps=int(progress.speed_bps),
                error=progress.error,
            )
        )

    return ActiveModelDownloadsResponse(
        downloads=items,
        active_count=len(items),
        total_speed_bps=sum(item.speed_bps for item in items),
    )


def _build_model_response(
    model_config: ConfigMap,
    worker_state: ConfigMap,
) -> list[ModelResponse]:
    """Assemble response items for all registered models."""
    configured_id = canonicalize_optional_model_id(
        model_config.get("configured_model_id")
    )
    last_loaded_id = canonicalize_optional_model_id(
        worker_state.get("last_loaded_model_id")
    )

    storage = get_model_storage()
    downloader = get_model_downloader()
    items: list[ModelResponse] = []

    for info in list_models():
        download = downloader.get_download(info.model_id)
        cache_state = storage.get_cache_state(info.repo_id)
        model_status: ModelStatusLiteral
        if download is not None:
            model_status = "downloading"
        else:
            model_status = cache_state

        progress_resp = None
        if download is not None:
            progress_resp = _to_download_progress_response(download)

        items.append(
            ModelResponse(
                model_id=info.model_id,
                name=info.name,
                size_bytes=info.size_bytes,
                repo_id=info.repo_id,
                languages=info.languages,
                speed_rank=info.speed_rank,
                accuracy_rank=info.accuracy_rank,
                description=info.description,
                description_key=info.description_key,
                status=model_status,
                disk_usage=storage.get_disk_usage(info.repo_id),
                is_configured=(info.model_id == configured_id),
                is_last_loaded=(info.model_id == last_loaded_id),
                download_progress=progress_resp,
            )
        )

    return items


# --- Endpoints ---


@router.get(
    "",
    summary="List all models",
    response_model=ModelListResponse,
    status_code=status.HTTP_200_OK,
)
def list_all_models() -> ModelListResponse:
    """Return all registered models with local state and download progress."""
    model_config = _read_model_config()
    worker_state = _read_worker_state()
    effective_dir, _ = _resolve_effective_dir(model_config)

    return ModelListResponse(
        models=_build_model_response(model_config, worker_state),
        configured_model_id=canonicalize_optional_model_id(
            model_config.get("configured_model_id")
        ),
        last_loaded_model_id=canonicalize_optional_model_id(
            worker_state.get("last_loaded_model_id")
        ),
        effective_model_dir=str(effective_dir),
    )


@router.get(
    "/downloads",
    summary="List active model downloads",
    response_model=ActiveModelDownloadsResponse,
    status_code=status.HTTP_200_OK,
)
def list_active_downloads() -> ActiveModelDownloadsResponse:
    """Return active model downloads with real current speed snapshots."""
    return _build_active_downloads_response()


@router.get(
    "/settings",
    summary="Get model settings",
    response_model=ModelSettingsResponse,
    status_code=status.HTTP_200_OK,
)
def get_model_settings() -> ModelSettingsResponse:
    """Return model directory configuration and override state."""
    config_db = get_app_config_db()
    model_config = config_db.get_all("model.")
    worker_state = _read_worker_state()
    effective_dir, source = _resolve_effective_dir(model_config)

    configured_id = canonicalize_optional_model_id(
        model_config.get("configured_model_id")
    )
    last_loaded_id = canonicalize_optional_model_id(
        worker_state.get("last_loaded_model_id")
    )
    db_model_dir = model_config.get("configured_model_dir")

    return ModelSettingsResponse(
        configured_model_id=configured_id,
        last_loaded_model_id=last_loaded_id,
        configured_model_dir=db_model_dir if isinstance(db_model_dir, str) else None,
        effective_model_dir=str(effective_dir),
        override_source=source,
        restart_required=compute_restart_required(
            configured_id or canonicalize_model_id(settings.model_size),
            effective_dir,
            worker_state,
        ),
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
def get_model_detail(model_id: str) -> ModelDetailResponse:
    """Return one model with full detail."""
    try:
        info = require_model(model_id)
    except UnknownModelError:
        return Response(  # type: ignore[return-value]
            content=json.dumps({"detail": f"Unknown model id: {model_id}"}),
            status_code=status.HTTP_404_NOT_FOUND,
            media_type="application/json",
        )

    model_config = _read_model_config()
    worker_state = _read_worker_state()
    configured_id = canonicalize_optional_model_id(
        model_config.get("configured_model_id")
    )
    last_loaded_id = canonicalize_optional_model_id(
        worker_state.get("last_loaded_model_id")
    )

    storage = get_model_storage()
    downloader = get_model_downloader()
    download = downloader.get_download(info.model_id)
    cache_state = storage.get_cache_state(info.repo_id)

    model_status: ModelStatusLiteral
    if download is not None:
        model_status = "downloading"
    else:
        model_status = cache_state

    progress_resp = None
    if download is not None:
        progress_resp = _to_download_progress_response(download)

    return ModelDetailResponse(
        model_id=info.model_id,
        name=info.name,
        size_bytes=info.size_bytes,
        repo_id=info.repo_id,
        languages=info.languages,
        speed_rank=info.speed_rank,
        accuracy_rank=info.accuracy_rank,
        description=info.description,
        description_key=info.description_key,
        status=model_status,
        disk_usage=storage.get_disk_usage(info.repo_id),
        is_configured=(info.model_id == configured_id),
        is_last_loaded=(info.model_id == last_loaded_id),
        download_progress=progress_resp,
    )


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
def start_download(model_id: str) -> ModelDownloadStartedResponse | Response:
    """Accept a download request and start background download."""
    try:
        info = require_model(model_id)
    except UnknownModelError:
        return Response(
            content=json.dumps({"detail": f"Unknown model id: {model_id}"}),
            status_code=status.HTTP_404_NOT_FOUND,
            media_type="application/json",
        )

    storage = get_model_storage()
    if storage.get_cache_state(info.repo_id) == "downloaded":
        return Response(
            content=json.dumps({"detail": f"Model already downloaded: {model_id}"}),
            status_code=status.HTTP_409_CONFLICT,
            media_type="application/json",
        )

    downloader = get_model_downloader()
    try:
        downloader.start_download(info)
    except ModelAlreadyDownloadingError:
        return Response(
            content=json.dumps({"detail": f"Download already in progress: {model_id}"}),
            status_code=status.HTTP_409_CONFLICT,
            media_type="application/json",
        )

    return ModelDownloadStartedResponse(
        model_id=info.model_id,
        message=f"Download started for {info.name}",
    )


@router.post(
    "/{model_id}/cancel",
    summary="Cancel model download",
    response_model=ModelCancelResponse,
    status_code=status.HTTP_200_OK,
    responses={
        404: {"description": "No active download for this model"},
    },
)
def cancel_download(model_id: str) -> ModelCancelResponse | Response:
    """Cancel one active download."""
    canonical_id = canonicalize_model_id(model_id)
    downloader = get_model_downloader()
    try:
        downloader.cancel_download(canonical_id)
    except ModelDownloadNotFoundError:
        return Response(
            content=json.dumps({"detail": f"No active download: {model_id}"}),
            status_code=status.HTTP_404_NOT_FOUND,
            media_type="application/json",
        )

    return ModelCancelResponse(
        model_id=canonical_id,
        message=f"Download cancelled for {model_id}",
    )


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
def delete_model(model_id: str) -> ModelDeleteResponse | Response:
    """Delete local model cache (full or partial)."""
    try:
        info = require_model(model_id)
    except UnknownModelError:
        return Response(
            content=json.dumps({"detail": f"Unknown model id: {model_id}"}),
            status_code=status.HTTP_404_NOT_FOUND,
            media_type="application/json",
        )

    downloader = get_model_downloader()
    if downloader.is_downloading(info.model_id):
        return Response(
            content=json.dumps(
                {
                    "detail": (
                        f"Model is currently downloading: {model_id}. Cancel first."
                    ),
                }
            ),
            status_code=status.HTTP_409_CONFLICT,
            media_type="application/json",
        )

    model_config = _read_model_config()
    configured_raw = model_config.get("configured_model_id")
    if (
        isinstance(configured_raw, str)
        and canonicalize_model_id(configured_raw) == info.model_id
    ):
        return Response(
            content=json.dumps(
                {
                    "detail": f"Cannot delete configured model: {model_id}",
                }
            ),
            status_code=status.HTTP_409_CONFLICT,
            media_type="application/json",
        )

    storage = get_model_storage()
    try:
        storage.delete_model(info.repo_id)
    except ModelNotDownloadedError:
        return Response(
            content=json.dumps({"detail": f"Model not downloaded: {model_id}"}),
            status_code=status.HTTP_404_NOT_FOUND,
            media_type="application/json",
        )

    return ModelDeleteResponse(
        model_id=info.model_id,
        message=f"Model cache deleted for {info.name}",
    )


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
def select_model(model_id: str) -> ModelSelectResponse | Response:
    """Set the configured model for next Worker startup."""
    try:
        info = require_model(model_id)
    except UnknownModelError:
        return Response(
            content=json.dumps({"detail": f"Unknown model id: {model_id}"}),
            status_code=status.HTTP_404_NOT_FOUND,
            media_type="application/json",
        )

    storage = get_model_storage()
    if storage.get_cache_state(info.repo_id) != "downloaded":
        return Response(
            content=json.dumps({"detail": f"Model not downloaded: {model_id}"}),
            status_code=status.HTTP_409_CONFLICT,
            media_type="application/json",
        )

    config_db = get_app_config_db()
    config_db.set_many("model.", {"configured_model_id": info.model_id})

    model_config = _read_model_config()
    worker_state = _read_worker_state()
    effective_dir, _ = _resolve_effective_dir(model_config)
    restart = compute_restart_required(info.model_id, effective_dir, worker_state)

    return ModelSelectResponse(
        configured_model_id=info.model_id,
        restart_required=restart,
        message=f"Configured model set to {info.name}",
    )


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
) -> ModelSettingsResponse | Response:
    """Persist model directory configuration."""
    config_db = get_app_config_db()

    if request.configured_model_dir is not None:
        # Reject dir change while downloads are running to avoid orphaning
        # subprocesses tracked by the current ModelDownloader singleton.
        downloader = get_model_downloader()
        if downloader.list_downloads():
            return Response(
                content=json.dumps(
                    {
                        "detail": (
                            "Cannot change model directory while downloads are "
                            "active. Cancel all downloads first."
                        ),
                    }
                ),
                status_code=status.HTTP_409_CONFLICT,
                media_type="application/json",
            )

        try:
            normalized = normalize_configured_model_dir(request.configured_model_dir)
        except InvalidModelDirectoryError as exc:
            return Response(
                content=json.dumps({"detail": str(exc)}),
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                media_type="application/json",
            )
        config_db.set_many("model.", {"configured_model_dir": str(normalized)})
        invalidate_model_dir_caches()

    return get_model_settings()
