"""Tests for model cache path handling and storage helpers."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import pytest

from nola.model_hub.errors import InvalidModelDirectoryError, ModelNotDownloadedError
from nola.model_hub.storage import (
    ModelStorage,
    normalize_configured_model_dir,
    resolve_model_dir,
)


@dataclass(frozen=True)
class _FakeRevision:
    """Describe one cached revision for storage tests."""

    commit_hash: str


@dataclass(frozen=True)
class _FakeRepo:
    """Describe one cached repository for storage tests."""

    repo_id: str
    size_on_disk: int
    revisions: tuple[_FakeRevision, ...]


class _FakeDeleteStrategy:
    """Record whether the prepared delete strategy was executed."""

    def __init__(self) -> None:
        self.executed = False

    def execute(self) -> None:
        """Mark the delete strategy as executed."""
        self.executed = True


class _FakeCacheInfo:
    """Provide the minimal scan_cache_dir shape used by ModelStorage."""

    def __init__(self, repos: tuple[_FakeRepo, ...]) -> None:
        self.repos = repos
        self.deleted_revisions: tuple[str, ...] = ()
        self.delete_strategy = _FakeDeleteStrategy()

    def delete_revisions(self, *revisions: str) -> _FakeDeleteStrategy:
        """Record the revision hashes selected for deletion."""
        self.deleted_revisions = revisions
        return self.delete_strategy


def test_normalize_configured_model_dir_rejects_relative_paths() -> None:
    """Reject relative paths for persisted model cache settings."""
    with pytest.raises(InvalidModelDirectoryError, match="absolute path"):
        normalize_configured_model_dir("models")


def test_resolve_model_dir_prefers_env_then_db_then_default(tmp_path: Path) -> None:
    """Apply one stable precedence order across every caller."""
    default_dir = tmp_path / "default-model-cache"
    env_dir = tmp_path / "env-model-cache"
    db_dir = str(tmp_path / "db-model-cache")

    resolved_env_dir, env_source = resolve_model_dir(env_dir, db_dir, default_dir)
    resolved_db_dir, db_source = resolve_model_dir(None, db_dir, default_dir)
    resolved_default_dir, default_source = resolve_model_dir(None, None, default_dir)

    assert resolved_env_dir == env_dir.resolve(strict=False)
    assert env_source == "environment"
    assert resolved_db_dir == Path(db_dir).resolve(strict=False)
    assert db_source == "database"
    assert resolved_default_dir == default_dir.resolve(strict=False)
    assert default_source == "default"


def test_model_storage_reads_download_status_and_disk_usage(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Surface downloaded repos and cached size from scan_cache_dir metadata."""
    cache_info = _FakeCacheInfo(
        repos=(
            _FakeRepo(
                repo_id="repo/a",
                size_on_disk=10,
                revisions=(_FakeRevision("rev-a"),),
            ),
            _FakeRepo(repo_id="repo/b", size_on_disk=20, revisions=()),
            _FakeRepo(
                repo_id="repo/c",
                size_on_disk=30,
                revisions=(_FakeRevision("rev-c"),),
            ),
        )
    )
    storage = ModelStorage(tmp_path / "model-cache")
    monkeypatch.setattr(storage, "_scan_cache_info", lambda: cache_info)

    assert storage.is_downloaded("repo/a") is True
    assert storage.is_downloaded("repo/b") is False
    assert storage.get_downloaded_models() == ["repo/a", "repo/c"]
    assert storage.get_disk_usage("repo/c") == 30
    assert storage.get_disk_usage("repo/missing") is None


def test_model_storage_deletes_revisions_via_cache_metadata(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Delete cached models through delete_revisions instead of path recursion."""
    cache_info = _FakeCacheInfo(
        repos=(
            _FakeRepo(
                repo_id="repo/a",
                size_on_disk=10,
                revisions=(_FakeRevision("rev-a1"), _FakeRevision("rev-a2")),
            ),
        )
    )
    storage = ModelStorage(tmp_path / "model-cache")
    monkeypatch.setattr(storage, "_scan_cache_info", lambda: cache_info)

    assert storage.delete_model("repo/a") is True
    assert cache_info.deleted_revisions == ("rev-a1", "rev-a2")
    assert cache_info.delete_strategy.executed is True


def test_model_storage_deletes_partial_cache_and_lock_dirs(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Interrupted downloads should be removable even without tracked revisions."""
    cache_info = _FakeCacheInfo(
        repos=(
            _FakeRepo(
                repo_id="org/repo-a",
                size_on_disk=10,
                revisions=(),
            ),
        )
    )
    storage = ModelStorage(tmp_path / "model-cache")
    monkeypatch.setattr(storage, "_scan_cache_info", lambda: cache_info)

    repo_dir = storage.cache_dir / "models--org--repo-a"
    lock_dir = storage.cache_dir / ".locks" / "models--org--repo-a"
    (repo_dir / "blobs").mkdir(parents=True)
    (repo_dir / "blobs" / "etag.incomplete").write_text("partial", encoding="utf-8")
    lock_dir.mkdir(parents=True)
    (lock_dir / "etag.lock").write_text("", encoding="utf-8")

    assert storage.delete_model("org/repo-a") is True
    assert not repo_dir.exists()
    assert not lock_dir.exists()
    assert cache_info.deleted_revisions == ()


def test_model_storage_rejects_deletion_when_repo_is_missing(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Raise a domain error when delete targets a repo absent from cache."""
    storage = ModelStorage(tmp_path / "model-cache")
    monkeypatch.setattr(storage, "_scan_cache_info", lambda: _FakeCacheInfo(repos=()))

    with pytest.raises(ModelNotDownloadedError, match="repo/missing"):
        storage.delete_model("repo/missing")
