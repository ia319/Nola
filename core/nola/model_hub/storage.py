"""Storage helpers for model cache resolution and safe cache deletion."""

from __future__ import annotations

import shutil
from pathlib import Path

from nola.model_hub._hf_api import (
    CacheInfo,
    CacheRepoInfo,
    scan_cache_dir,
    serialize_repo_folder_name,
)
from nola.model_hub.contracts import ModelCacheState, ModelDirSource
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

    def get_cache_state(self, repo_id: str) -> ModelCacheState:
        """Return one repository cache state for model-management decisions."""
        repo = self._get_repo(repo_id)
        has_revisions = repo is not None and bool(repo.revisions)
        has_partial_artifacts = self._has_partial_artifacts(repo_id, repo)

        # Treat one repo with tracked revisions as downloaded even when stale
        # lock or incomplete artifacts remain from an older interrupted run.
        if has_revisions:
            return "downloaded"

        if has_partial_artifacts:
            return "partial_download"

        return "not_downloaded"

    def is_downloaded(self, repo_id: str) -> bool:
        """Return whether one repository is fully cached locally."""
        return self.get_cache_state(repo_id) == "downloaded"

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
        deleted = False

        if cache_info is not None:
            repo = self._find_repo(cache_info, repo_id)
            if repo is not None:
                revision_hashes = [
                    revision.commit_hash
                    for revision in repo.revisions
                    if isinstance(revision.commit_hash, str)
                ]
                if revision_hashes:
                    delete_strategy = cache_info.delete_revisions(*revision_hashes)
                    delete_strategy.execute()
                    deleted = True

        # Metadata-driven deletion does not clean repo-local .incomplete files or
        # stale lock directories left behind by interrupted downloads.
        deleted_partial = self._delete_repo_artifacts(repo_id)
        if deleted or deleted_partial:
            return True

        raise ModelNotDownloadedError(repo_id)

    def cleanup_stale_artifacts(self, repo_id: str) -> bool:
        """Delete stale lock and incomplete files without touching cached revisions."""
        removed_locks = self._delete_tree_if_present(self._repo_lock_dir(repo_id))
        removed_incomplete = False

        for incomplete_file in self._iter_incomplete_files(repo_id):
            self._assert_within_cache_dir(incomplete_file)
            incomplete_file.unlink(missing_ok=True)
            removed_incomplete = True

        return removed_locks or removed_incomplete

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

    def _delete_repo_artifacts(self, repo_id: str) -> bool:
        """Delete repo-local leftovers that cache metadata does not track."""
        removed_cache = self._delete_tree_if_present(self._repo_cache_dir(repo_id))
        removed_locks = self._delete_tree_if_present(self._repo_lock_dir(repo_id))
        return removed_cache or removed_locks

    def _iter_incomplete_files(self, repo_id: str) -> list[Path]:
        """Return repo-scoped incomplete files left by interrupted downloads."""
        repo_cache_dir = self._repo_cache_dir(repo_id)
        if not repo_cache_dir.exists():
            return []
        return list(repo_cache_dir.rglob("*.incomplete"))

    def _has_partial_artifacts(
        self,
        repo_id: str,
        repo: CacheRepoInfo | None,
    ) -> bool:
        """Return whether one repo still has incomplete or lock artifacts."""
        repo_cache_dir = self._repo_cache_dir(repo_id)
        if self._repo_lock_dir(repo_id).exists():
            return True

        if not repo_cache_dir.exists():
            return False

        # Treat unfinished files or metadata-only repo directories as partial
        # cache states until the downloader finishes or cleanup runs.
        if next(iter(self._iter_incomplete_files(repo_id)), None) is not None:
            return True

        return repo is None or not bool(repo.revisions)

    def _repo_cache_dir(self, repo_id: str) -> Path:
        """Return the on-disk cache directory for one model repo."""
        folder_name = serialize_repo_folder_name(repo_id, repo_type="model")
        return (self.cache_dir / folder_name).resolve(strict=False)

    def _repo_lock_dir(self, repo_id: str) -> Path:
        """Return the lock directory for one model repo download."""
        folder_name = serialize_repo_folder_name(repo_id, repo_type="model")
        return (self.cache_dir / ".locks" / folder_name).resolve(strict=False)

    def _delete_tree_if_present(self, path: Path) -> bool:
        """Recursively delete one repo-scoped directory inside the cache root."""
        resolved_path = path.resolve(strict=False)
        self._assert_within_cache_dir(resolved_path)
        if not resolved_path.exists():
            return False
        shutil.rmtree(resolved_path)
        return True

    def _assert_within_cache_dir(self, path: Path) -> None:
        """Reject cache deletions that escape the configured cache root."""
        cache_root = self.cache_dir.resolve(strict=False)
        try:
            path.relative_to(cache_root)
        except ValueError as exc:
            raise InvalidModelDirectoryError(
                "resolved model cache path escaped cache root"
            ) from exc

    @staticmethod
    def _find_repo(cache_info: CacheInfo, repo_id: str) -> CacheRepoInfo | None:
        """Find one repo entry by repository id."""
        for repo in cache_info.repos:
            if repo.repo_id == repo_id:
                return repo
        return None
