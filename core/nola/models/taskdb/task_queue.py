"""Queue-focused task repository operations."""

import json
import logging
from contextlib import closing
from datetime import datetime, timedelta
from typing import Any, cast

from nola.models.taskdb.base import TaskRepositoryBase
from nola.models.taskdb.types import TaskRowRaw, TaskStatus

logger = logging.getLogger(__name__)


class TaskQueueRepository(TaskRepositoryBase):
    """Handle queue lifecycle and worker-state updates."""

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
        with closing(self._connect()) as conn:
            with conn:
                conn.execute(
                    """
                    INSERT INTO transcription_tasks
                    (id, file_id, status, priority, max_retries, options, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        task_id,
                        file_id,
                        TaskStatus.PENDING.value,
                        priority,
                        max_retries,
                        json.dumps(options) if options else None,
                        datetime.now().isoformat(),
                    ),
                )

    def dequeue(self, worker_id: str) -> TaskRowRaw | None:
        """Atomically get and lock next pending task.

        Args:
            worker_id: Worker identifier claiming the task

        Returns:
            Task dict or None if queue is empty
        """
        with closing(self._connect()) as conn:
            with conn:
                now_iso = datetime.now().isoformat()
                cursor = conn.execute(
                    """
                    UPDATE transcription_tasks
                    SET status = ?, worker_id = ?, started_at = ?, last_heartbeat = ?
                    WHERE id IN (
                        SELECT id FROM transcription_tasks
                        WHERE status = ?
                        ORDER BY priority DESC, created_at ASC
                        LIMIT 1
                    )
                    RETURNING *
                    """,
                    (
                        TaskStatus.PROCESSING.value,
                        worker_id,
                        now_iso,
                        now_iso,
                        TaskStatus.PENDING.value,
                    ),
                )
                row = cursor.fetchone()

        if row is None:
            return None
        return cast(TaskRowRaw, dict(row))

    def heartbeat(self, task_id: str, progress: float = 0.0) -> None:
        """Update worker heartbeat and progress.

        Args:
            task_id: Task identifier
            progress: Current progress (0-100)
        """
        with closing(self._connect()) as conn:
            with conn:
                conn.execute(
                    """
                    UPDATE transcription_tasks
                    SET last_heartbeat = ?, progress = ?
                    WHERE id = ? AND status = ?
                    """,
                    (
                        datetime.now().isoformat(),
                        progress,
                        task_id,
                        TaskStatus.PROCESSING.value,
                    ),
                )

    def complete(
        self, task_id: str, segments: list[dict[str, Any]], duration: float
    ) -> bool:
        """Mark task as completed with results.

        Args:
            task_id: Task identifier
            segments: Transcription segments
            duration: Audio duration in seconds

        Returns:
            True if updated, False if task was cancelled or not found
        """
        with closing(self._connect()) as conn:
            with conn:
                cursor = conn.execute(
                    """
                    UPDATE transcription_tasks
                    SET status = ?, segments = ?, duration = ?,
                        progress = 100.0, error = NULL, completed_at = ?
                    WHERE id = ? AND status = ?
                    """,
                    (
                        TaskStatus.COMPLETED.value,
                        json.dumps(segments),
                        duration,
                        datetime.now().isoformat(),
                        task_id,
                        TaskStatus.PROCESSING.value,
                    ),
                )
                return cursor.rowcount > 0

    def fail(self, task_id: str, error: str, should_retry: bool = True) -> bool:
        """Mark task as failed with optional retry.

        Args:
            task_id: Task identifier
            error: Error message
            should_retry: If True, requeue if retries available

        Returns:
            True if task was updated, False if task not found
        """
        with closing(self._connect()) as conn:
            with conn:
                # Atomic conditional update:
                # 1. Try to requeue if retries available.
                if should_retry:
                    cursor = conn.execute(
                        """
                        UPDATE transcription_tasks
                        SET status = ?, retry_count = retry_count + 1,
                            error = ?, worker_id = NULL, started_at = NULL,
                            last_heartbeat = NULL, progress = 0.0
                        WHERE id = ? AND retry_count < max_retries AND status = ?
                        """,
                        (
                            TaskStatus.PENDING.value,
                            error,
                            task_id,
                            TaskStatus.PROCESSING.value,
                        ),
                    )
                    if cursor.rowcount > 0:
                        return True

                # 2. If we reached here, either:
                #    - should_retry is False
                #    - OR retry_count >= max_retries (atomic check failed)
                # So mark as permanently failed.
                cursor = conn.execute(
                    """
                    UPDATE transcription_tasks
                    SET status = ?, error = ?, completed_at = ?
                    WHERE id = ? AND status = ?
                    """,
                    (
                        TaskStatus.FAILED.value,
                        error,
                        datetime.now().isoformat(),
                        task_id,
                        TaskStatus.PROCESSING.value,
                    ),
                )
                if cursor.rowcount == 0:
                    logger.warning("Attempted to fail non-existent task: %s", task_id)
                    return False
                return True

    def requeue_timeout_tasks(self, timeout_seconds: int = 3600) -> int:
        """Requeue tasks that exceeded timeout.

        Tasks with retries available are requeued to PENDING.
        Tasks that exhausted retries are marked as FAILED.

        Args:
            timeout_seconds: Timeout threshold

        Returns:
            Number of tasks requeued (not including failed ones)
        """
        with closing(self._connect()) as conn:
            with conn:
                timeout_at = datetime.now() - timedelta(seconds=timeout_seconds)

                cursor = conn.execute(
                    """
                    UPDATE transcription_tasks
                    SET status = ?, worker_id = NULL, started_at = NULL,
                        retry_count = retry_count + 1,
                        error = 'Task timeout - requeued',
                        last_heartbeat = NULL, progress = 0.0
                    WHERE status = ?
                      AND started_at < ?
                      AND retry_count < max_retries
                    """,
                    (
                        TaskStatus.PENDING.value,
                        TaskStatus.PROCESSING.value,
                        timeout_at.isoformat(),
                    ),
                )
                requeued_count = cursor.rowcount

                conn.execute(
                    """
                    UPDATE transcription_tasks
                    SET status = ?,
                        error = 'Task timeout - max retries exceeded',
                        completed_at = ?
                    WHERE status = ?
                      AND started_at < ?
                      AND retry_count >= max_retries
                    """,
                    (
                        TaskStatus.FAILED.value,
                        datetime.now().isoformat(),
                        TaskStatus.PROCESSING.value,
                        timeout_at.isoformat(),
                    ),
                )
                return requeued_count

    def requeue_dead_workers(self, heartbeat_timeout: int = 300) -> int:
        """Requeue tasks from workers with stale heartbeat.

        Tasks with retries available are requeued to PENDING.
        Tasks that exhausted retries are marked as FAILED.

        Args:
            heartbeat_timeout: Heartbeat timeout in seconds

        Returns:
            Number of tasks requeued (not including failed ones)
        """
        with closing(self._connect()) as conn:
            with conn:
                timeout_at = datetime.now() - timedelta(seconds=heartbeat_timeout)

                cursor = conn.execute(
                    """
                    UPDATE transcription_tasks
                    SET status = ?, worker_id = NULL, started_at = NULL,
                        retry_count = retry_count + 1,
                        error = 'Worker heartbeat timeout - requeued',
                        last_heartbeat = NULL, progress = 0.0
                    WHERE status = ?
                      AND last_heartbeat < ?
                      AND retry_count < max_retries
                    """,
                    (
                        TaskStatus.PENDING.value,
                        TaskStatus.PROCESSING.value,
                        timeout_at.isoformat(),
                    ),
                )
                requeued_count = cursor.rowcount

                conn.execute(
                    """
                    UPDATE transcription_tasks
                    SET status = ?,
                        error = 'Worker heartbeat timeout - max retries exceeded',
                        completed_at = ?
                    WHERE status = ?
                      AND last_heartbeat < ?
                      AND retry_count >= max_retries
                    """,
                    (
                        TaskStatus.FAILED.value,
                        datetime.now().isoformat(),
                        TaskStatus.PROCESSING.value,
                        timeout_at.isoformat(),
                    ),
                )
                return requeued_count
