"""Facade over split task repositories for compatibility."""

import sqlite3
import warnings
from pathlib import Path
from typing import Any

from nola.models.taskdb import (
    CANCELLABLE_TASK_STATUSES,
    DEFAULT_TASK_SORT_BY,
    DEFAULT_TASK_SORT_ORDER,
    RETRYABLE_TASK_STATUSES,
    TASK_SORT_COLUMNS,
    TERMINAL_TASK_STATUSES,
    TaskQueueRepository,
    TaskRow,
    TaskRowRaw,
    TaskSortField,
    TaskSortOrder,
    TaskStatus,
    TaskStoreRepository,
)


class TaskDatabase:
    """Manage transcription tasks with production-grade queue operations."""

    def __init__(self, db_path: str | Path = "data/nola.db") -> None:
        """Initialize task database.

        Args:
            db_path: Path to SQLite database file
        """
        self._queue = TaskQueueRepository(db_path)
        self._store = TaskStoreRepository(db_path)

    @property
    def db_path(self) -> Path:
        """Return SQLite database path used by both repositories."""
        return self._queue.db_path

    def _connect(self) -> sqlite3.Connection:
        """Expose the historical private connection helper for compatibility."""
        return self._queue._connect()

    def enqueue(
        self,
        task_id: str,
        file_id: str,
        priority: int = 0,
        max_retries: int = 3,
        options: dict[str, Any] | None = None,
    ) -> None:
        """Add task to queue.

        Args:
            task_id: Unique task identifier
            file_id: Associated file ID
            priority: Task priority (higher = sooner)
            max_retries: Maximum retry attempts
            options: Transcription options (non-None values only)
        """
        self._queue.enqueue(
            task_id=task_id,
            file_id=file_id,
            priority=priority,
            max_retries=max_retries,
            options=options,
        )

    def dequeue(self, worker_id: str) -> TaskRowRaw | None:
        """Atomically get and lock next pending task.

        Args:
            worker_id: Worker identifier claiming the task

        Returns:
            Task dict or None if queue is empty
        """
        return self._queue.dequeue(worker_id)

    def heartbeat(self, task_id: str, progress: float = 0.0) -> None:
        """Update worker heartbeat and progress.

        Args:
            task_id: Task identifier
            progress: Current progress (0-100)
        """
        self._queue.heartbeat(task_id, progress)

    def complete(
        self,
        task_id: str,
        segments: list[dict[str, Any]],
        duration: float,
    ) -> bool:
        """Mark task as completed with results.

        Args:
            task_id: Task identifier
            segments: Transcription segments
            duration: Audio duration in seconds

        Returns:
            True if updated, False if task was cancelled or not found
        """
        return self._queue.complete(task_id, segments, duration)

    def fail(self, task_id: str, error: str, should_retry: bool = True) -> bool:
        """Mark task as failed with optional retry.

        Args:
            task_id: Task identifier
            error: Error message
            should_retry: If True, requeue if retries available

        Returns:
            True if task was updated, False if task not found
        """
        return self._queue.fail(task_id, error, should_retry)

    def cancel(self, task_id: str) -> bool:
        """Cancel a task.

        Args:
            task_id: Task identifier

        Returns:
            True if cancelled, False if not found or already completed
        """
        return self.cancel_with_snapshot(task_id) is not None

    def cancel_with_snapshot(self, task_id: str) -> TaskRowRaw | None:
        """Cancel a pending/processing task and return the updated row snapshot.

        Args:
            task_id: Task identifier

        Returns:
            Updated task row when cancellation succeeds, otherwise None
        """
        return self._store.cancel_with_snapshot(task_id)

    def requeue_timeout_tasks(self, timeout_seconds: int = 3600) -> int:
        """Requeue tasks that exceeded timeout.

        Tasks with retries available are requeued to PENDING.
        Tasks that exhausted retries are marked as FAILED.

        Args:
            timeout_seconds: Timeout threshold

        Returns:
            Number of tasks requeued (not including failed ones)
        """
        return self._queue.requeue_timeout_tasks(timeout_seconds)

    def requeue_dead_workers(self, heartbeat_timeout: int = 300) -> int:
        """Requeue tasks from workers with stale heartbeat.

        Tasks with retries available are requeued to PENDING.
        Tasks that exhausted retries are marked as FAILED.

        Args:
            heartbeat_timeout: Heartbeat timeout in seconds

        Returns:
            Number of tasks requeued (not including failed ones)
        """
        return self._queue.requeue_dead_workers(heartbeat_timeout)

    def get_task(self, task_id: str) -> TaskRow | None:
        """Get task details by ID.

        Args:
            task_id: Task identifier

        Returns:
            Task dictionary or None if not found
        """
        return self._store.get_task(task_id)

    def delete_task_record(self, task_id: str) -> bool:
        """Delete a task record by ID.

        Args:
            task_id: Task identifier

        Returns:
            True if deleted, False if task is missing or non-terminal
        """
        return self._store.delete_task_record(task_id)

    def list_tasks(
        self,
        status: str | None = None,
        limit: int = 50,
        offset: int = 0,
        q: str | None = None,
        sort_by: TaskSortField = DEFAULT_TASK_SORT_BY,
        order: TaskSortOrder = DEFAULT_TASK_SORT_ORDER,
    ) -> list[TaskRowRaw]:
        """List tasks with optional status/search filters and sorting."""
        return self._store.list_tasks(
            status=status,
            limit=limit,
            offset=offset,
            q=q,
            sort_by=sort_by,
            order=order,
        )

    def count_tasks(self, status: str | None = None, q: str | None = None) -> int:
        """Count tasks with optional status/search filters."""
        return self._store.count_tasks(status=status, q=q)

    def _warn_deprecated(self, method_name: str, replacement: str) -> None:
        """Emit a deprecation warning for legacy TaskDatabase methods."""
        warnings.warn(
            f"TaskDatabase.{method_name}() is deprecated; use {replacement}().",
            DeprecationWarning,
            stacklevel=2,
        )

    # Legacy methods kept for compatibility; remove at M5 cleanup.
    def create_task(self, task_id: str, file_id: str) -> None:
        """Legacy: Create task (use enqueue instead)."""
        self._warn_deprecated("create_task", "enqueue")
        self.enqueue(task_id, file_id)

    def get_next_pending_task(self) -> TaskRowRaw | None:
        """Legacy: Get next pending task (use dequeue instead)."""
        self._warn_deprecated("get_next_pending_task", "dequeue")
        return self._store.get_next_pending_task()

    def update_status(
        self,
        task_id: str,
        status: TaskStatus,
        error: str | None = None,
    ) -> bool:
        """Legacy: Update task status (use specific methods instead).

        Warning:
            This method is deprecated. Use complete(), fail(), or cancel() instead.

        Returns:
            True if updated, False if task is in terminal state
        """
        self._warn_deprecated("update_status", "complete/fail/cancel")
        return self._store.update_status(task_id, status, error)

    def update_progress(self, task_id: str, progress: float) -> None:
        """Legacy: Update progress (use heartbeat instead)."""
        self._warn_deprecated("update_progress", "heartbeat")
        self.heartbeat(task_id, progress)

    def update_result(
        self,
        task_id: str,
        segments: list[dict[str, Any]],
        duration: float,
    ) -> None:
        """Legacy: Update result (use complete instead)."""
        self._warn_deprecated("update_result", "complete")
        self.complete(task_id, segments, duration)


__all__ = [
    "CANCELLABLE_TASK_STATUSES",
    "DEFAULT_TASK_SORT_BY",
    "DEFAULT_TASK_SORT_ORDER",
    "RETRYABLE_TASK_STATUSES",
    "TERMINAL_TASK_STATUSES",
    "TASK_SORT_COLUMNS",
    "TaskDatabase",
    "TaskRow",
    "TaskRowRaw",
    "TaskSortField",
    "TaskSortOrder",
    "TaskStatus",
]
