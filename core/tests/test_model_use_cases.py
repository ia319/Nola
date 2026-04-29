"""Unit tests for model application use-cases."""

from pathlib import Path

import pytest

from nola.application.models import (
    list_models,
    select_configured_model,
    start_model_download,
    update_model_settings,
)
from nola.application.models.errors import ModelUseCaseError
from nola.config.common.types import ConfigMap
from nola.model_hub import DownloadProgress, ModelNotDownloadedError, require_model
from nola.model_hub.contracts import ModelCacheState, ModelInfo


class FakeConfigStore:
    """In-memory app-config store for use-case tests."""

    def __init__(self) -> None:
        self.values_by_prefix: dict[str, ConfigMap] = {
            "model.": {},
            "worker.": {},
        }

    def get_all(self, prefix: str) -> ConfigMap:
        return dict(self.values_by_prefix.get(prefix, {}))

    def set_many(self, prefix: str, values: ConfigMap) -> list[str]:
        current = self.values_by_prefix.setdefault(prefix, {})
        current.update(values)
        return [f"{prefix}{key}" for key in values]


class FakeModelStorage:
    """In-memory model storage for use-case tests."""

    def __init__(self, states: dict[str, ModelCacheState]) -> None:
        self.states = states
        self.deleted_repo_ids: list[str] = []
        self.cache_dir = Path("model-cache")

    def get_cache_state(self, repo_id: str) -> ModelCacheState:
        return self.states.get(repo_id, "not_downloaded")

    def is_downloaded(self, repo_id: str) -> bool:
        return self.get_cache_state(repo_id) == "downloaded"

    def get_downloaded_models(self) -> list[str]:
        return sorted(
            repo_id for repo_id, state in self.states.items() if state == "downloaded"
        )

    def get_disk_usage(self, repo_id: str) -> int | None:
        return 100 if self.get_cache_state(repo_id) == "downloaded" else None

    def delete_model(self, repo_id: str) -> bool:
        if self.get_cache_state(repo_id) == "not_downloaded":
            raise ModelNotDownloadedError(repo_id)
        self.deleted_repo_ids.append(repo_id)
        self.states[repo_id] = "not_downloaded"
        return True


class FakeModelDownloader:
    """In-memory model downloader for use-case tests."""

    def __init__(
        self,
        downloads: list[DownloadProgress] | None = None,
        downloading_ids: set[str] | None = None,
    ) -> None:
        self.downloads = downloads or []
        self.downloading_ids = downloading_ids or set()
        self.started_models: list[ModelInfo] = []
        self.cache_dir = Path("model-cache")

    def start_download(
        self,
        model_info: ModelInfo,
        on_progress: object | None = None,
    ) -> DownloadProgress:
        self.started_models.append(model_info)
        progress = DownloadProgress(
            model_id=model_info.model_id,
            status="downloading",
            downloaded_bytes=0,
            total_bytes=100,
        )
        self.downloads.append(progress)
        self.downloading_ids.add(model_info.model_id)
        return progress

    def cancel_download(self, model_id: str) -> DownloadProgress:
        self.downloading_ids.discard(model_id)
        return DownloadProgress(
            model_id=model_id,
            status="cancelled",
            downloaded_bytes=0,
            total_bytes=100,
        )

    def is_downloading(self, model_id: str) -> bool:
        return model_id in self.downloading_ids

    def get_download(self, model_id: str) -> DownloadProgress | None:
        for download in self.downloads:
            if download.model_id == model_id:
                return download
        return None

    def list_downloads(self) -> list[DownloadProgress]:
        return list(self.downloads)


def test_list_models_applies_search_filter_and_sort(tmp_path: Path) -> None:
    """Apply query controls in the model list use-case."""
    small = require_model("small")
    medium = require_model("medium")
    config_store = FakeConfigStore()
    storage = FakeModelStorage(
        {
            small.repo_id: "downloaded",
            medium.repo_id: "downloaded",
        }
    )
    downloader = FakeModelDownloader()

    repo_search = list_models(
        config_store=config_store,
        storage=storage,
        downloader=downloader,
        env_model_dir=None,
        default_model_dir=tmp_path,
        model_status=None,
        q="faster-whisper-small",
        sort_by=None,
        order="asc",
    )
    filtered = list_models(
        config_store=config_store,
        storage=storage,
        downloader=downloader,
        env_model_dir=None,
        default_model_dir=tmp_path,
        model_status="downloaded",
        q=None,
        sort_by="size",
        order="desc",
    )

    assert [model["model_id"] for model in repo_search["models"]] == [
        "small.en",
        "small",
    ]
    assert [model["model_id"] for model in filtered["models"]][:2] == [
        "medium",
        "small",
    ]


def test_start_model_download_rejects_cached_model() -> None:
    """Reject download requests for models that are already cached."""
    small = require_model("small")
    storage = FakeModelStorage({small.repo_id: "downloaded"})
    downloader = FakeModelDownloader()
    downloader_requested = False

    def get_downloader() -> FakeModelDownloader:
        nonlocal downloader_requested
        downloader_requested = True
        return downloader

    with pytest.raises(ModelUseCaseError) as error:
        start_model_download(
            storage=storage,
            get_downloader=get_downloader,
            model_id="small",
        )

    assert error.value.status_code == 409
    assert error.value.detail == "Model already downloaded: small"
    assert downloader_requested is False
    assert downloader.started_models == []


def test_select_configured_model_writes_canonical_id() -> None:
    """Persist the canonical model id when selecting through an alias."""
    large = require_model("large-v3")
    config_store = FakeConfigStore()
    storage = FakeModelStorage({large.repo_id: "downloaded"})

    payload = select_configured_model(
        config_store=config_store,
        storage=storage,
        model_id="large",
    )

    assert payload["configured_model_id"] == "large-v3"
    assert config_store.get_all("model.")["configured_model_id"] == "large-v3"


def test_update_model_settings_rejects_active_downloads(tmp_path: Path) -> None:
    """Block model cache root changes while downloads are active."""
    downloader = FakeModelDownloader(
        downloads=[
            DownloadProgress(
                model_id="small",
                status="downloading",
                downloaded_bytes=0,
                total_bytes=100,
            )
        ]
    )
    invalidated = False

    def invalidate() -> None:
        nonlocal invalidated
        invalidated = True

    with pytest.raises(ModelUseCaseError) as error:
        update_model_settings(
            config_store=FakeConfigStore(),
            downloader=downloader,
            env_model_dir=None,
            default_model_dir=tmp_path,
            configured_model_dir=str(tmp_path / "next-cache"),
            invalidate_model_dir_caches=invalidate,
        )

    assert error.value.status_code == 409
    assert invalidated is False
