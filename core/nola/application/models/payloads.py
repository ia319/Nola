"""Build model-management use-case payloads."""

from pathlib import Path

from nola.application.models.types import (
    ActiveModelDownloadPayload,
    ActiveModelDownloadsPayload,
    DownloadProgressPayload,
    ModelListSortField,
    ModelListSortOrder,
    ModelPayload,
    ModelStatusValue,
)
from nola.application.models.values import canonicalize_optional_model_id
from nola.config.common.types import ConfigMap
from nola.model_hub import (
    DownloadProgress,
    ModelDirSource,
    ModelDownloaderPort,
    ModelInfo,
    ModelStoragePort,
    require_model,
    resolve_model_dir,
)
from nola.model_hub import list_models as list_registered_models

_ModelListEntry = tuple[ModelPayload, tuple[str, ...]]
_MODEL_STATUS_SORT_RANK: dict[ModelStatusValue, int] = {
    "not_downloaded": 0,
    "partial_download": 1,
    "downloading": 2,
    "downloaded": 3,
}


def resolve_effective_model_dir(
    *,
    model_config: ConfigMap,
    env_model_dir: Path | None,
    default_model_dir: Path,
) -> tuple[Path, ModelDirSource]:
    """Return the effective model dir and its override source."""
    db_model_dir = model_config.get("configured_model_dir")
    return resolve_model_dir(
        env_model_dir,
        db_model_dir if isinstance(db_model_dir, str) else None,
        default_model_dir,
    )


def to_download_progress_payload(
    progress: DownloadProgress,
) -> DownloadProgressPayload:
    """Translate one runtime download snapshot into the public payload."""
    return {
        "percent": progress.percent,
        "downloaded_bytes": progress.downloaded_bytes,
        "total_bytes": progress.total_bytes,
        "speed_bps": int(progress.speed_bps),
        "error": progress.error,
    }


def to_active_download_payload(
    progress: DownloadProgress,
) -> ActiveModelDownloadPayload:
    """Translate one runtime download snapshot into active-download payload."""
    model_info = require_model(progress.model_id)
    return {
        "model_id": model_info.model_id,
        "name": model_info.name,
        "status": progress.status,
        "percent": progress.percent,
        "downloaded_bytes": progress.downloaded_bytes,
        "total_bytes": progress.total_bytes,
        "speed_bps": int(progress.speed_bps),
        "error": progress.error,
    }


def build_active_downloads_payload(
    *,
    downloader: ModelDownloaderPort,
) -> ActiveModelDownloadsPayload:
    """Return the current active-download summary for UI polling."""
    downloads = [
        to_active_download_payload(progress) for progress in downloader.list_downloads()
    ]
    return {
        "downloads": downloads,
        "active_count": len(downloads),
        "total_speed_bps": sum(item["speed_bps"] for item in downloads),
    }


def build_model_payload(
    *,
    info: ModelInfo,
    model_config: ConfigMap,
    worker_state: ConfigMap,
    storage: ModelStoragePort,
    downloader: ModelDownloaderPort,
) -> tuple[ModelPayload, tuple[str, ...]]:
    """Assemble one model payload and its searchable values."""
    configured_id = canonicalize_optional_model_id(
        model_config.get("configured_model_id")
    )
    last_loaded_id = canonicalize_optional_model_id(
        worker_state.get("last_loaded_model_id")
    )
    download = downloader.get_download(info.model_id)
    cache_state = storage.get_cache_state(info.repo_id)
    model_status: ModelStatusValue = "downloading" if download else cache_state
    progress_payload = (
        to_download_progress_payload(download) if download is not None else None
    )

    model: ModelPayload = {
        "model_id": info.model_id,
        "name": info.name,
        "size_bytes": info.size_bytes,
        "repo_id": info.repo_id,
        "languages": info.languages,
        "speed_rank": info.speed_rank,
        "accuracy_rank": info.accuracy_rank,
        "description": info.description,
        "description_key": info.description_key,
        "status": model_status,
        "disk_usage": storage.get_disk_usage(info.repo_id),
        "is_configured": info.model_id == configured_id,
        "is_last_loaded": info.model_id == last_loaded_id,
        "download_progress": progress_payload,
    }
    search_values = (
        info.model_id,
        info.name,
        info.repo_id,
        info.languages,
        info.description,
        info.description_key,
        model_status,
        *info.aliases,
    )
    return model, search_values


def build_model_entries(
    *,
    model_config: ConfigMap,
    worker_state: ConfigMap,
    storage: ModelStoragePort,
    downloader: ModelDownloaderPort,
) -> list[_ModelListEntry]:
    """Assemble response entries for all registered models."""
    return [
        build_model_payload(
            info=info,
            model_config=model_config,
            worker_state=worker_state,
            storage=storage,
            downloader=downloader,
        )
        for info in list_registered_models()
    ]


def model_matches_query(search_values: tuple[str, ...], query: str | None) -> bool:
    """Return whether one model matches the free-text query."""
    if query is None:
        return True

    raw_query = query.strip().casefold()
    normalized_query = normalize_search_text(query)
    if not raw_query:
        return True

    for value in search_values:
        raw_value = value.casefold()
        if raw_query in raw_value or normalized_query in normalize_search_text(value):
            return True

    return False


def sort_model_entries(
    entries: list[_ModelListEntry],
    sort_by: ModelListSortField | None,
    order: ModelListSortOrder,
) -> list[_ModelListEntry]:
    """Return model entries in requested order."""
    if sort_by is None:
        return sorted(entries, key=default_model_order_key)

    reverse = order == "desc"

    def sort_key(entry: _ModelListEntry) -> str | int:
        model, _ = entry
        if sort_by == "name":
            return model["name"].casefold()
        if sort_by == "languages":
            return model["languages"].casefold()
        if sort_by == "size":
            return model["size_bytes"]
        if sort_by == "status":
            return _MODEL_STATUS_SORT_RANK[model["status"]]
        return get_model_profile_score(model)

    return sorted(entries, key=sort_key, reverse=reverse)


def normalize_search_text(value: str) -> str:
    """Return a case-insensitive search token with separator variants merged."""
    return " ".join(value.replace("_", " ").replace("-", " ").casefold().split())


def get_model_profile_score(model: ModelPayload) -> int:
    """Rank one model by accuracy first, then speed."""
    return model["accuracy_rank"] * 100 - model["speed_rank"]


def default_model_order_key(entry: _ModelListEntry) -> tuple[bool, int, int, str]:
    """Keep the configured model first, then prefer stronger compact models."""
    model, _ = entry
    return (
        not model["is_configured"],
        -model["accuracy_rank"],
        model["size_bytes"],
        model["name"].casefold(),
    )
