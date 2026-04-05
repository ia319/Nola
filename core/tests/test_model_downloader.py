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


class _ExitDrainQueue:
    """Script queue reads to simulate a terminal message racing with exit."""

    def __init__(self) -> None:
        self._reads = 0

    def get(self, block: bool = True, timeout: float | None = None) -> object:
        """Raise once, then expose the terminal message during drain."""
        self._reads += 1
        if self._reads == 1:
            raise queue.Empty()
        if self._reads == 2:
            return DownloadWorkerMessage(kind="completed")
        raise queue.Empty()


class _GateTerminalQueue:
    """Hold one terminal message until cancellation requests process exit."""

    def __init__(self, release_terminal: threading.Event) -> None:
        self._release_terminal = release_terminal
        self._reads = 0

    def get(self, block: bool = True, timeout: float | None = None) -> object:
        """Return one completed message only after the release gate opens."""
        self._reads += 1
        if self._reads > 1:
            raise queue.Empty()
        if not self._release_terminal.wait(timeout=2.0):
            raise AssertionError("Timed out waiting for terminal release")
        return DownloadWorkerMessage(kind="completed")


class _TerminalOnTerminateProcess(_FakeProcess):
    """Release one queued terminal message as soon as termination starts."""

    def __init__(self, release_terminal: threading.Event) -> None:
        super().__init__()
        self._release_terminal = release_terminal

    def terminate(self) -> None:
        """Make the completed message visible before the watcher drains it."""
        super().terminate()
        self._release_terminal.set()


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
    assert any(
        channel == "model_downloads" and payload["status"] == "completed"
        for channel, payload in event_bus.published
    )
    assert any(
        channel == "model_downloads.small" and payload["status"] == "completed"
        for channel, payload in event_bus.published
    )


def test_model_downloader_drains_terminal_message_after_process_exit(
    tmp_path: Path,
) -> None:
    """Handle a trailing terminal IPC message that arrives after exit is observed."""
    progress_updates: list[DownloadProgress] = []
    cache_dir = tmp_path / "model-cache"

    downloader = ModelDownloader(
        cache_dir,
        queue_factory=_ExitDrainQueue,
        process_factory=lambda *_args: _FakeProcess(
            on_start=lambda process: (
                setattr(process, "_alive", False),
                setattr(process, "exitcode", 0),
            ),
        ),
        planner=lambda _repo_id, _cache_dir: 100,
    )

    downloader.start_download(_make_model(), progress_updates.append)

    _wait_for(lambda: any(update.status == "completed" for update in progress_updates))

    statuses = [update.status for update in progress_updates]
    assert "completed" in statuses
    assert "failed" not in statuses
    assert downloader.get_download("small") is None


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


def test_model_downloader_preserves_terminal_state_when_cancel_races(
    tmp_path: Path,
) -> None:
    """Keep a completed terminal state when cancellation races with watcher drain."""
    progress_updates: list[DownloadProgress] = []
    release_terminal = threading.Event()
    cache_dir = tmp_path / "model-cache"

    downloader = ModelDownloader(
        cache_dir,
        queue_factory=lambda: _GateTerminalQueue(release_terminal),
        process_factory=lambda *_args: _TerminalOnTerminateProcess(release_terminal),
        planner=lambda _repo_id, _cache_dir: 100,
    )

    downloader.start_download(_make_model(), progress_updates.append)
    terminal = downloader.cancel_download("small")

    _wait_for(lambda: downloader.is_downloading("small") is False)
    assert terminal.status == "completed"
    assert progress_updates[-1].status == "completed"


def test_model_downloader_ignores_observer_failures(tmp_path: Path) -> None:
    """Let download cleanup finish even if callbacks or event publishes fail."""
    message_queue: queue.Queue[DownloadWorkerMessage] = queue.Queue()
    cache_dir = tmp_path / "model-cache"
    callback_calls: list[str] = []
    publish_channels: list[str] = []

    class _ExplodingEventBus:
        def publish(self, channel: str, data: JsonDict) -> None:
            publish_channels.append(channel)
            raise RuntimeError(f"publish failed on {channel}")

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
                message_queue.put(DownloadWorkerMessage(kind="completed"))
                process._alive = False
                process.exitcode = 0

            threading.Thread(target=publish_messages, daemon=True).start()

        return _FakeProcess(on_start=on_start)

    def exploding_callback(progress: DownloadProgress) -> None:
        callback_calls.append(progress.status)
        raise RuntimeError(f"callback failed for {progress.model_id}")

    cache_dir_path = cache_dir.resolve(strict=False)
    downloader = ModelDownloader(
        cache_dir,
        event_bus=_ExplodingEventBus(),
        queue_factory=lambda: message_queue,
        process_factory=process_factory,
        planner=lambda _repo_id, _cache_dir: 100,
    )

    downloader.start_download(_make_model(), exploding_callback)

    _wait_for(lambda: downloader.is_downloading("small") is False)
    assert callback_calls
    assert "completed" in callback_calls
    assert "model_downloads" in publish_channels
    assert "model_downloads.small" in publish_channels
    assert downloader.get_download("small") is None


def test_model_downloader_does_not_hold_lock_while_planning(tmp_path: Path) -> None:
    """Allow read-side queries to proceed while the dry-run planner is blocked."""
    planning_started = threading.Event()
    release_planner = threading.Event()
    list_returned = threading.Event()
    thread_errors: list[BaseException] = []
    cache_dir = tmp_path / "model-cache"

    def blocking_planner(_repo_id: str, _cache_dir: str) -> int:
        planning_started.set()
        if not release_planner.wait(timeout=2.0):
            raise AssertionError("Planner was not released in time")
        return 100

    downloader = ModelDownloader(
        cache_dir,
        queue_factory=queue.Queue,
        process_factory=lambda *_args: _FakeProcess(),
        planner=blocking_planner,
    )

    def start_download() -> None:
        try:
            downloader.start_download(_make_model())
        except BaseException as exc:
            thread_errors.append(exc)

    def read_downloads() -> None:
        try:
            assert_downloads_empty(downloader)
            list_returned.set()
        except BaseException as exc:
            thread_errors.append(exc)

    start_thread = threading.Thread(target=start_download, daemon=True)
    read_thread = threading.Thread(target=read_downloads, daemon=True)

    try:
        start_thread.start()
        _wait_for(planning_started.is_set)
        read_thread.start()
        _wait_for(list_returned.is_set)
    finally:
        release_planner.set()
        start_thread.join(timeout=2.0)
        read_thread.join(timeout=2.0)
        if downloader.is_downloading("small"):
            downloader.cancel_download("small")
            _wait_for(lambda: downloader.is_downloading("small") is False)

    assert not start_thread.is_alive()
    assert not read_thread.is_alive()
    assert thread_errors == []


def assert_downloads_empty(downloader: ModelDownloader) -> None:
    """Keep the read-side assertion reusable inside the planning test."""
    assert downloader.list_downloads() == []


def test_model_downloader_rejects_duplicate_active_tasks(tmp_path: Path) -> None:
    """Fail fast when the same model already has one active subprocess."""
    cache_dir = tmp_path / "model-cache"
    downloader = ModelDownloader(
        cache_dir,
        queue_factory=queue.Queue,
        process_factory=lambda *_args: _FakeProcess(),
        planner=lambda _repo_id, _cache_dir: 100,
    )

    try:
        downloader.start_download(_make_model())

        with pytest.raises(ModelAlreadyDownloadingError, match="small"):
            downloader.start_download(_make_model())
    finally:
        if downloader.is_downloading("small"):
            downloader.cancel_download("small")
            _wait_for(lambda: downloader.is_downloading("small") is False)


def test_model_downloader_rejects_cancelling_unknown_task(tmp_path: Path) -> None:
    """Raise a domain error when cancelling a non-existent download."""
    downloader = ModelDownloader(tmp_path / "model-cache")

    with pytest.raises(ModelDownloadNotFoundError, match="missing"):
        downloader.cancel_download("missing")
