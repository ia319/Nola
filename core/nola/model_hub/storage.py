"""Storage helpers for model cache resolution and safe cache deletion."""

from __future__ import annotations

from pathlib import Path

from nola.model_hub._hf_api import CacheInfo, CacheRepoInfo, scan_cache_dir
from nola.model_hub.contracts import ModelDirSource
from nola.model_hub.errors import InvalidModelDirectoryError, ModelNotDownloadedError


def normalize_configured_model_dir(raw_value: str | Path) -> Path:
    """Normalize one user-provided cache root and reject relative paths."""
    path = Path(raw_value).expanduser()
    if not path.is_absolute():
        raise InvalidModelDirectoryError("model_dir must be an absolute path")
    return path.resolve(strict=False)


def resolve_model_dir(
    env_model_dir: Path | None,
    db_model_dir: str | None,
    default_dir: Path,
) -> tuple[Path, ModelDirSource]:
    """Resolve the effective cache root and the source that won."""
    if env_model_dir is not None:
        return env_model_dir.expanduser().resolve(strict=False), "environment"

    if isinstance(db_model_dir, str) and db_model_dir.strip():
        return normalize_configured_model_dir(db_model_dir), "database"

    return default_dir.expanduser().resolve(strict=False), "default"


class ModelStorage:
    """Inspect and mutate one Hugging Face cache root."""

    def __init__(self, cache_dir: str | Path) -> None:
        """Resolve and store one cache root path."""
        self.cache_dir = Path(cache_dir).expanduser().resolve(strict=False)

    def is_downloaded(self, repo_id: str) -> bool:
        """Return whether one repository has at least one cached revision."""
        repo = self._get_repo(repo_id)
        return repo is not None and bool(repo.revisions)

    def get_downloaded_models(self) -> list[str]:
        """Return cached repository ids in stable order."""
        cache_info = self._scan_cache_info()
        if cache_info is None:
            return []

        repo_ids = [repo.repo_id for repo in cache_info.repos if repo.revisions]
        return sorted(repo_ids)

    def get_disk_usage(self, repo_id: str) -> int | None:
        """Return cached disk usage for one repository when present."""
        repo = self._get_repo(repo_id)
        if repo is None:
            return None
        return int(repo.size_on_disk)

    def delete_model(self, repo_id: str) -> bool:
        """Delete one cached repository through Hugging Face cache metadata."""
        cache_info = self._scan_cache_info()
        if cache_info is None:
            raise ModelNotDownloadedError(repo_id)

        repo = self._find_repo(cache_info, repo_id)
        if repo is None:
            raise ModelNotDownloadedError(repo_id)

        revision_hashes = [
            revision.commit_hash
            for revision in repo.revisions
            if isinstance(revision.commit_hash, str)
        ]
        if not revision_hashes:
            raise ModelNotDownloadedError(repo_id)

        delete_strategy = cache_info.delete_revisions(*revision_hashes)
        delete_strategy.execute()
        return True

    def _get_repo(self, repo_id: str) -> CacheRepoInfo | None:
        """Return one cached repo entry when present."""
        cache_info = self._scan_cache_info()
        if cache_info is None:
            return None
        return self._find_repo(cache_info, repo_id)

    def _scan_cache_info(self) -> CacheInfo | None:
        """Scan the cache root unless it does not exist yet."""
        if not self.cache_dir.exists():
            return None
        return scan_cache_dir(self.cache_dir)

    @staticmethod
    def _find_repo(cache_info: CacheInfo, repo_id: str) -> CacheRepoInfo | None:
        """Find one repo entry by repository id."""
        for repo in cache_info.repos:
            if repo.repo_id == repo_id:
                return repo
        return None
