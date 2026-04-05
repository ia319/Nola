"""Subprocess entry points for model downloads."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Protocol, cast

from nola.model_hub._download_constants import DOWNLOAD_ALLOW_PATTERNS
from nola.model_hub._download_messages import DownloadWorkerMessage
from nola.model_hub._hf_api import download_snapshot, load_base_tqdm


class _MessageQueue(Protocol):
    """Describe the queue API needed by the download subprocess."""

    def put(
        self,
        item: DownloadWorkerMessage,
        block: bool = True,
        timeout: float | None = None,
    ) -> None:
        """Publish one subprocess message."""


def _build_ipc_tqdm_class(message_queue: _MessageQueue) -> type[Any]:
    """Create one tqdm subclass that reports byte deltas through IPC."""
    base_tqdm = load_base_tqdm()

    def __init__(self: Any, *args: Any, **kwargs: Any) -> None:
        kwargs["disable"] = True
        base_tqdm.__init__(self, *args, **kwargs)

    def update(self: Any, n: int = 1) -> Any:
        result = base_tqdm.update(self, n)
        total_value = self.total
        total_bytes = int(total_value) if isinstance(total_value, int | float) else None
        rate_value = self.format_dict.get("rate")
        speed_bps = float(rate_value) if isinstance(rate_value, int | float) else 0.0
        message_queue.put(
            DownloadWorkerMessage(
                kind="progress",
                downloaded_delta=int(n),
                total_bytes=total_bytes,
                speed_bps=speed_bps,
            )
        )
        return result

    return cast(
        type[Any],
        type(
            "DownloadProgressTqdm",
            (base_tqdm,),
            {
                "__doc__": "Mirror tqdm byte updates into a multiprocessing queue.",
                "__init__": __init__,
                "update": update,
            },
        ),
    )


def run_download_subprocess(
    message_queue: _MessageQueue,
    repo_id: str,
    cache_dir: str,
) -> None:
    """Run one snapshot download inside a dedicated subprocess."""
    tqdm_class = _build_ipc_tqdm_class(message_queue)
    message_queue.put(DownloadWorkerMessage(kind="started"))

    try:
        download_snapshot(
            repo_id,
            cache_dir=Path(cache_dir),
            allow_patterns=list(DOWNLOAD_ALLOW_PATTERNS),
            tqdm_class=tqdm_class,
        )
    except Exception as exc:
        message_queue.put(DownloadWorkerMessage(kind="failed", error=str(exc)))
        raise
    else:
        message_queue.put(DownloadWorkerMessage(kind="completed"))
