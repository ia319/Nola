"""Lazy wrappers around Hugging Face Hub entry points."""

from __future__ import annotations

from collections.abc import Sequence
from importlib import import_module
from pathlib import Path
from types import ModuleType
from typing import Any, Protocol, cast

from nola.model_hub.errors import ModelHubDependencyError


class SnapshotPlanEntry(Protocol):
    """Describe one dry-run file returned by snapshot_download."""

    file_size: int | None


class CacheRevisionInfo(Protocol):
    """Describe one cached revision entry."""

    commit_hash: str | None


class CacheRepoInfo(Protocol):
    """Describe one cached repository entry."""

    repo_id: str
    revisions: Sequence[CacheRevisionInfo]
    size_on_disk: int


class CacheDeleteStrategy(Protocol):
    """Describe one deferred delete operation returned by the cache API."""

    def execute(self) -> None:
        """Apply the planned cache deletion."""


class CacheInfo(Protocol):
    """Describe the subset of cache metadata used by model_hub."""

    repos: Sequence[CacheRepoInfo]

    def delete_revisions(self, *commit_hashes: str) -> CacheDeleteStrategy:
        """Build one deletion strategy for cached revisions."""


def _load_huggingface_hub() -> ModuleType:
    """Import huggingface_hub on demand."""
    try:
        return import_module("huggingface_hub")
    except ModuleNotFoundError as exc:
        raise ModelHubDependencyError("huggingface_hub") from exc


def plan_snapshot_download(
    repo_id: str,
    *,
    cache_dir: str | Path,
    allow_patterns: Sequence[str],
) -> Sequence[SnapshotPlanEntry]:
    """Return dry-run file metadata for one snapshot download."""
    module = _load_huggingface_hub()
    return cast(
        Sequence[SnapshotPlanEntry],
        module.snapshot_download(
            repo_id,
            cache_dir=cache_dir,
            allow_patterns=list(allow_patterns),
            dry_run=True,
        ),
    )


def download_snapshot(
    repo_id: str,
    *,
    cache_dir: str | Path,
    allow_patterns: Sequence[str],
    tqdm_class: type[Any] | None = None,
) -> str:
    """Download one snapshot into the cache root and return its local path."""
    module = _load_huggingface_hub()
    snapshot_kwargs: dict[str, object] = {
        "cache_dir": cache_dir,
        "allow_patterns": list(allow_patterns),
    }
    if tqdm_class is not None:
        snapshot_kwargs["tqdm_class"] = tqdm_class
    return cast(str, module.snapshot_download(repo_id, **snapshot_kwargs))


def scan_cache_dir(cache_dir: str | Path | None = None) -> CacheInfo:
    """Proxy one scan_cache_dir call through the optional dependency."""
    module = _load_huggingface_hub()
    return cast(CacheInfo, module.scan_cache_dir(cache_dir))


def load_base_tqdm() -> type[Any]:
    """Load the tqdm base class used by huggingface_hub."""
    try:
        module = import_module("tqdm.auto")
    except ModuleNotFoundError as exc:
        raise ModelHubDependencyError("tqdm") from exc
    return cast(type[Any], module.tqdm)
