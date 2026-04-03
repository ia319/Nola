"""Tests for subprocess-backed model downloads."""

from __future__ import annotations

import queue
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

import pytest

from nola.common.types import JsonDict
from nola.model_hub._download_constants import DOWNLOAD_ALLOW_PATTERNS
from nola.model_hub._download_messages import DownloadWorkerMessage
from nola.model_hub._download_worker import run_download_subprocess
from nola.model_hub.contracts import DownloadProgress, ModelInfo
from nola.model_hub.downloader import ModelDownloader, _plan_download_bytes
from nola.model_hub.errors import (
    ModelAlreadyDownloadingError,
    ModelDownloadNotFoundError,
)


def _make_model(model_id: str = "small") -> ModelInfo:
    """Create one minimal model entry for downloader tests."""
    return ModelInfo(
        model_id=model_id,
        name=model_id,
        repo_id=f"repo/{model_id}",
        runtime="faster-whisper",
        languages="multilingual",
        size_bytes=100,
        speed_rank=1,
        accuracy_rank=1,
        description="test entry",
    )


def _wait_for(predicate: Callable[[], bool], *, timeout: float = 2.0) -> None:
    """Poll one predicate until it succeeds or time runs out."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        if predicate():
            return
        time.sleep(0.01)
    raise AssertionError("Timed out waiting for condition")


def test_download_components_share_allow_patterns(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Use one shared file-set definition for planning and actual downloads."""
    captured_plan: dict[str, tuple[str, ...]] = {}
    captured_worker: dict[str, tuple[str, ...]] = {}

    class _QueueRecorder:
        def put(
            self,
            item: DownloadWorkerMessage,
            block: bool = True,
            timeout: float | None = None,
        ) -> None:
            return None

    def fake_plan_snapshot_download(
        repo_id: str,
        *,
        cache_dir: str,
        allow_patterns: list[str],
    ) -> list[object]:
        captured_plan["allow_patterns"] = tuple(allow_patterns)
        return []

    def fake_download_snapshot(
        repo_id: str,
        *,
        cache_dir: Path,
        allow_patterns: list[str],
        tqdm_class: type[object],
    ) -> None:
        captured_worker["allow_patterns"] = tuple(allow_patterns)

    monkeypatch.setattr(
        "nola.model_hub.downloader.plan_snapshot_download",
        fake_plan_snapshot_download,
    )
    monkeypatch.setattr(
        "nola.model_hub._download_worker.download_snapshot",
        fake_download_snapshot,
    )

    _plan_download_bytes("repo/small", "cache-root")
    run_download_subprocess(_QueueRecorder(), "repo/small", "cache-root")

    assert captured_plan["allow_patterns"] == DOWNLOAD_ALLOW_PATTERNS
    assert captured_worker["allow_patterns"] == DOWNLOAD_ALLOW_PATTERNS


@dataclass
class _FakeEventBus:
    """Collect publish calls without requiring async subscribers."""

    published: list[tuple[str, JsonDict]]

    def publish(self, channel: str, data: JsonDict) -> None:
        """Record one published event."""
        self.published.append((channel, data))


class _FakeProcess:
    """Provide the minimal process interface used by ModelDownloader."""

    def __init__(
        self,
        on_start: Callable[[_FakeProcess], None] | None = None,
    ) -> None:
        self.pid = 4242
        self.exitcode: int | None = None
        self._alive = False
        self._on_start = on_start
        self.terminated = False
        self.killed = False

    def start(self) -> None:
        """Mark the process alive and run the provided start hook."""
        self._alive = True
        if self._on_start is not None:
            self._on_start(self)

    def is_alive(self) -> bool:
        """Return whether the fake process is still running."""
        return self._alive

    def terminate(self) -> None:
        """Simulate terminating the process."""
        self.terminated = True
        self._alive = False
        self.exitcode = -15

    def kill(self) -> None:
        """Simulate killing the process after a failed terminate."""
        self.killed = True
        self._alive = False
        self.exitcode = -9

    def join(self, timeout: float | None = None) -> None:
        """Match the multiprocessing API without extra behavior."""


def test_model_downloader_emits_progress_and_completion(tmp_path: Path) -> None:
    """Aggregate subprocess byte deltas into stable progress snapshots."""
    progress_updates: list[DownloadProgress] = []
    event_bus = _FakeEventBus(published=[])
    message_queue: queue.Queue[DownloadWorkerMessage] = queue.Queue()
    cache_dir = tmp_path / "model-cache"

    def process_factory(
        task_queue: object,
        repo_id: str,
        cache_dir: str,
    ) -> _FakeProcess:
        assert task_queue is message_queue
        assert repo_id == "repo/small"
        assert Path(cache_dir) == cache_dir_path

        def on_start(process: _FakeProcess) -> None:
            def publish_messages() -> None:
                message_queue.put(DownloadWorkerMessage(kind="started"))
                message_queue.put(
                    DownloadWorkerMessage(
                        kind="progress",
                        downloaded_delta=40,
                        total_bytes=100,
                        speed_bps=10.0,
                    )
                )
                message_queue.put(
                    DownloadWorkerMessage(
                        kind="progress",
                        downloaded_delta=60,
                        total_bytes=100,
                        speed_bps=20.0,
                    )
                )
                message_queue.put(DownloadWorkerMessage(kind="completed"))
                process._alive = False
                process.exitcode = 0

            threading.Thread(target=publish_messages, daemon=True).start()

        return _FakeProcess(on_start=on_start)

    cache_dir_path = cache_dir.resolve(strict=False)
    downloader = ModelDownloader(
        cache_dir,
        event_bus=event_bus,
        queue_factory=lambda: message_queue,
        process_factory=process_factory,
        planner=lambda _repo_id, _cache_dir: 100,
    )

    initial = downloader.start_download(_make_model(), progress_updates.append)

    assert initial.status == "downloading"
    _wait_for(lambda: any(update.status == "completed" for update in progress_updates))

    completed_updates = [
        update for update in progress_updates if update.status == "completed"
    ]

    assert any(update.status == "downloading" for update in progress_updates)
    assert completed_updates
    assert completed_updates[-1].downloaded_bytes == 100
    assert completed_updates[-1].percent == 100.0
    assert downloader.get_download("small") is None
    assert any(channel == "model_downloads" for channel, _ in event_bus.published)
    assert any(channel == "model_downloads.small" for channel, _ in event_bus.published)


def test_model_downloader_cancel_terminates_active_process(tmp_path: Path) -> None:
    """Cancel one active download by terminating the subprocess."""
    progress_updates: list[DownloadProgress] = []
    message_queue: queue.Queue[DownloadWorkerMessage] = queue.Queue()
    process = _FakeProcess()
    cache_dir = tmp_path / "model-cache"

    downloader = ModelDownloader(
        cache_dir,
        queue_factory=lambda: message_queue,
        process_factory=lambda *_args: process,
        planner=lambda _repo_id, _cache_dir: 100,
    )

    downloader.start_download(_make_model(), progress_updates.append)
    cancelled = downloader.cancel_download("small")

    assert cancelled.status == "cancelled"
    assert process.terminated is True
    _wait_for(lambda: downloader.is_downloading("small") is False)
    assert progress_updates[-1].status == "cancelled"


def test_model_downloader_rejects_duplicate_active_tasks(tmp_path: Path) -> None:
    """Fail fast when the same model already has one active subprocess."""
    cache_dir = tmp_path / "model-cache"
    downloader = ModelDownloader(
        cache_dir,
        queue_factory=queue.Queue,
        process_factory=lambda *_args: _FakeProcess(),
        planner=lambda _repo_id, _cache_dir: 100,
    )
    downloader.start_download(_make_model())

    with pytest.raises(ModelAlreadyDownloadingError, match="small"):
        downloader.start_download(_make_model())


def test_model_downloader_rejects_cancelling_unknown_task(tmp_path: Path) -> None:
    """Raise a domain error when cancelling a non-existent download."""
    downloader = ModelDownloader(tmp_path / "model-cache")

    with pytest.raises(ModelDownloadNotFoundError, match="missing"):
        downloader.cancel_download("missing")
