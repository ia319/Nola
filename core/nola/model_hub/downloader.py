"""Subprocess-backed model download manager."""

from __future__ import annotations

import multiprocessing
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from queue import Empty
from threading import Lock, Thread
from typing import Protocol

from nola.common.types import JsonDict
from nola.model_hub._download_messages import DownloadWorkerMessage
from nola.model_hub._download_worker import run_download_subprocess
from nola.model_hub._hf_api import plan_snapshot_download
from nola.model_hub.contracts import DownloadProgress, ModelInfo, ProgressCallback
from nola.model_hub.errors import (
    ModelAlreadyDownloadingError,
    ModelDownloadFailedError,
    ModelDownloadNotFoundError,
)

_ALLOW_PATTERNS = (
    "config.json",
    "preprocessor_config.json",
    "model.bin",
    "tokenizer.json",
    "vocabulary.*",
)
_GLOBAL_CHANNEL = "model_downloads"


class _MessageQueue(Protocol):
    """Describe the queue API used to exchange subprocess messages."""

    def get(self, block: bool = True, timeout: float | None = None) -> object:
        """Return the next subprocess message."""

    def put(
        self,
        item: DownloadWorkerMessage,
        block: bool = True,
        timeout: float | None = None,
    ) -> None:
        """Publish one subprocess message."""


class _DownloadProcess(Protocol):
    """Describe the minimal process API used by the download manager."""

    @property
    def exitcode(self) -> int | None:
        """Return the current subprocess exit code."""

    def start(self) -> None:
        """Start the subprocess."""

    def is_alive(self) -> bool:
        """Return whether the subprocess is still running."""

    def terminate(self) -> None:
        """Request graceful subprocess termination."""

    def join(self, timeout: float | None = None) -> None:
        """Wait for the subprocess to exit."""

    def kill(self) -> None:
        """Force the subprocess to exit."""


class _EventPublisher(Protocol):
    """Describe the event publisher used by model downloads."""

    def publish(self, channel: str, data: JsonDict) -> None:
        """Publish one event payload to one channel."""


@dataclass(slots=True)
class _ActiveDownload:
    """Track one running subprocess and its latest observable state."""

    model_info: ModelInfo
    process: _DownloadProcess
    message_queue: _MessageQueue
    callback: ProgressCallback | None
    progress: DownloadProgress
    cancelled: bool = False
    watcher: Thread | None = None


def _plan_download_bytes(repo_id: str, cache_dir: str) -> int:
    """Estimate the remaining download size using snapshot dry-run mode."""
    files = plan_snapshot_download(
        repo_id,
        cache_dir=cache_dir,
        allow_patterns=list(_ALLOW_PATTERNS),
    )
    total_bytes = 0
    for file_info in files:
        file_size = file_info.file_size
        if isinstance(file_size, int):
            total_bytes += file_size
    return total_bytes


def _spawn_download_process(
    message_queue: _MessageQueue,
    repo_id: str,
    cache_dir: str,
) -> _DownloadProcess:
    """Create one not-yet-started subprocess for the download worker."""
    context = multiprocessing.get_context("spawn")
    return context.Process(
        target=run_download_subprocess,
        args=(message_queue, repo_id, cache_dir),
        daemon=True,
    )


class ModelDownloader:
    """Manage one set of active model downloads under one cache root."""

    def __init__(
        self,
        cache_dir: str | Path,
        *,
        event_bus: _EventPublisher | None = None,
        queue_factory: Callable[[], _MessageQueue] | None = None,
        process_factory: Callable[[_MessageQueue, str, str], _DownloadProcess]
        | None = None,
        planner: Callable[[str, str], int] | None = None,
    ) -> None:
        """Initialize one download manager with injectable test seams."""
        self.cache_dir = Path(cache_dir).expanduser().resolve(strict=False)
        self._event_bus = event_bus
        self._queue_factory = queue_factory or self._default_queue_factory
        self._process_factory = process_factory or _spawn_download_process
        self._planner = planner or _plan_download_bytes
        self._lock = Lock()
        self._active_downloads: dict[str, _ActiveDownload] = {}

    def start_download(
        self,
        model_info: ModelInfo,
        on_progress: ProgressCallback | None = None,
    ) -> DownloadProgress:
        """Start one model download in a dedicated subprocess."""
        with self._lock:
            if model_info.model_id in self._active_downloads:
                raise ModelAlreadyDownloadingError(model_info.model_id)

            total_bytes = self._planner(model_info.repo_id, str(self.cache_dir))
            message_queue = self._queue_factory()
            process = self._process_factory(
                message_queue,
                model_info.repo_id,
                str(self.cache_dir),
            )
            progress = DownloadProgress(
                model_id=model_info.model_id,
                status="downloading",
                downloaded_bytes=0,
                total_bytes=total_bytes,
            )
            active = _ActiveDownload(
                model_info=model_info,
                process=process,
                message_queue=message_queue,
                callback=on_progress,
                progress=progress,
            )
            watcher = Thread(
                target=self._watch_download,
                args=(active,),
                daemon=True,
                name=f"model-download-{model_info.model_id}",
            )
            active.watcher = watcher
            self._active_downloads[model_info.model_id] = active

        try:
            process.start()
        except Exception:
            with self._lock:
                self._active_downloads.pop(model_info.model_id, None)
            raise

        watcher.start()
        self._emit_progress(progress, on_progress)
        return progress

    def cancel_download(self, model_id: str) -> DownloadProgress:
        """Terminate one active download subprocess and mark it cancelled."""
        with self._lock:
            active = self._active_downloads.get(model_id)
            if active is None:
                raise ModelDownloadNotFoundError(model_id)

            active.cancelled = True
            cancelled_progress = DownloadProgress(
                model_id=model_id,
                status="cancelled",
                downloaded_bytes=active.progress.downloaded_bytes,
                total_bytes=active.progress.total_bytes,
                speed_bps=0.0,
            )
            active.progress = cancelled_progress

        self._terminate_process(active.process)
        self._emit_progress(cancelled_progress, active.callback)
        self._finalize_download(active, remove_from_registry=True)
        return cancelled_progress

    def is_downloading(self, model_id: str) -> bool:
        """Return whether one model id currently has an active download."""
        with self._lock:
            return model_id in self._active_downloads

    def get_download(self, model_id: str) -> DownloadProgress | None:
        """Return one active download snapshot when present."""
        with self._lock:
            active = self._active_downloads.get(model_id)
            return None if active is None else active.progress

    def list_downloads(self) -> list[DownloadProgress]:
        """Return active download snapshots in stable model-id order."""
        with self._lock:
            return [
                self._active_downloads[model_id].progress
                for model_id in sorted(self._active_downloads)
            ]

    @staticmethod
    def _default_queue_factory() -> _MessageQueue:
        """Create the default multiprocessing queue."""
        return multiprocessing.get_context("spawn").Queue()

    def _watch_download(self, active: _ActiveDownload) -> None:
        """Consume subprocess IPC messages until one terminal state is reached."""
        process = active.process
        model_id = active.model_info.model_id

        try:
            while True:
                try:
                    raw_message = active.message_queue.get(timeout=0.1)
                except Empty:
                    if not process.is_alive():
                        break
                    continue

                if not isinstance(raw_message, DownloadWorkerMessage):
                    continue

                message = raw_message
                terminal_progress = self._handle_message(active, message)
                if terminal_progress is not None:
                    self._emit_progress(terminal_progress, active.callback)
                    self._finalize_download(active)
                    return

            if active.cancelled:
                return

            if getattr(process, "exitcode", None) == 0:
                completed_progress = DownloadProgress(
                    model_id=model_id,
                    status="completed",
                    downloaded_bytes=active.progress.total_bytes,
                    total_bytes=active.progress.total_bytes,
                    speed_bps=0.0,
                )
                self._emit_progress(completed_progress, active.callback)
                self._finalize_download(active)
                return

            failure = ModelDownloadFailedError(
                model_id,
                "Download subprocess exited unexpectedly.",
            )
            failed_progress = DownloadProgress(
                model_id=model_id,
                status="failed",
                downloaded_bytes=active.progress.downloaded_bytes,
                total_bytes=active.progress.total_bytes,
                speed_bps=0.0,
                error=failure.detail,
            )
            self._emit_progress(failed_progress, active.callback)
            self._finalize_download(active)
        finally:
            queue_close = getattr(active.message_queue, "close", None)
            if callable(queue_close):
                queue_close()

    def _handle_message(
        self,
        active: _ActiveDownload,
        message: DownloadWorkerMessage,
    ) -> DownloadProgress | None:
        """Update one active task from one subprocess message."""
        if active.cancelled:
            return None

        if message.kind == "started":
            return None

        if message.kind == "progress":
            downloaded_bytes = (
                active.progress.downloaded_bytes + message.downloaded_delta
            )
            total_bytes = (
                message.total_bytes
                if isinstance(message.total_bytes, int)
                else active.progress.total_bytes
            )
            if total_bytes > 0:
                downloaded_bytes = min(downloaded_bytes, total_bytes)
            active.progress = DownloadProgress(
                model_id=active.model_info.model_id,
                status="downloading",
                downloaded_bytes=downloaded_bytes,
                total_bytes=total_bytes,
                speed_bps=message.speed_bps,
            )
            self._emit_progress(active.progress, active.callback)
            return None

        if message.kind == "completed":
            return DownloadProgress(
                model_id=active.model_info.model_id,
                status="completed",
                downloaded_bytes=active.progress.total_bytes,
                total_bytes=active.progress.total_bytes,
                speed_bps=0.0,
            )

        if message.kind == "failed":
            return DownloadProgress(
                model_id=active.model_info.model_id,
                status="failed",
                downloaded_bytes=active.progress.downloaded_bytes,
                total_bytes=active.progress.total_bytes,
                speed_bps=0.0,
                error=message.error or "Download subprocess failed.",
            )

        return None

    def _emit_progress(
        self,
        progress: DownloadProgress,
        callback: ProgressCallback | None,
    ) -> None:
        """Publish one progress snapshot to the callback and event bus."""
        if callback is not None:
            callback(progress)

        if self._event_bus is None:
            return

        payload = self._serialize_progress(progress)
        self._event_bus.publish(_GLOBAL_CHANNEL, payload)
        self._event_bus.publish(f"{_GLOBAL_CHANNEL}.{progress.model_id}", payload)

    def _serialize_progress(self, progress: DownloadProgress) -> JsonDict:
        """Serialize one progress snapshot into an event payload."""
        payload: JsonDict = {
            "model_id": progress.model_id,
            "status": progress.status,
            "downloaded_bytes": progress.downloaded_bytes,
            "total_bytes": progress.total_bytes,
            "percent": progress.percent,
            "speed_bps": int(progress.speed_bps),
        }
        if progress.error is not None:
            payload["error"] = progress.error
        return payload

    def _finalize_download(
        self,
        active: _ActiveDownload,
        *,
        remove_from_registry: bool = True,
    ) -> None:
        """Remove one active task once no further progress can arrive."""
        if not remove_from_registry:
            return

        with self._lock:
            current = self._active_downloads.get(active.model_info.model_id)
            if current is active:
                self._active_downloads.pop(active.model_info.model_id, None)

    @staticmethod
    def _terminate_process(process: _DownloadProcess) -> None:
        """Terminate one download subprocess and wait briefly for exit."""
        if not process.is_alive():
            return

        process.terminate()
        process.join(timeout=2.0)

        if process.is_alive() and hasattr(process, "kill"):
            process.kill()
            process.join(timeout=2.0)
