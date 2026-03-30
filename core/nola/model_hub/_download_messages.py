"""IPC message types for model download subprocesses."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

DownloadWorkerMessageKind = Literal["started", "progress", "completed", "failed"]


@dataclass(frozen=True, slots=True)
class DownloadWorkerMessage:
    """Carry subprocess progress and terminal state back to the parent."""

    kind: DownloadWorkerMessageKind
    downloaded_delta: int = 0
    total_bytes: int | None = None
    speed_bps: float = 0.0
    error: str | None = None
