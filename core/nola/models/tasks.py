"""Production-grade transcription task queue management."""

import json
import sqlite3
from datetime import datetime, timedelta
from enum import Enum
from pathlib import Path
from typing import Any


class TaskStatus(str, Enum):
    """Transcription task status."""

    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class TaskDatabase:
    """Manage transcription tasks with production-grade queue operations."""

    def __init__(self, db_path: str | Path = "data/nola.db") -> None:
        """Initialize task database.

        Args:
            db_path: Path to SQLite database file
        """
        self.db_path = Path(db_path)

    # === Queue Operations ===

    def enqueue(
        self, task_id: str, file_id: str, priority: int = 0, max_retries: int = 3
    ) -> None:
        """Add task to queue.

        Args:
            task_id: Unique task identifier
            file_id: Associated file ID
            priority: Task priority (higher = sooner)
            max_retries: Maximum retry attempts
        """
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """
                INSERT INTO transcription_tasks 
                (id, file_id, status, priority, max_retries, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    task_id,
                    file_id,
                    TaskStatus.PENDING.value,
                    priority,
                    max_retries,
                    datetime.now().isoformat(),
                ),
            )
            conn.commit()

    def dequeue(self, worker_id: str) -> dict[str, Any] | None:
        """Atomically get and lock next pending task.

        Args:
            worker_id: Worker identifier claiming the task

        Returns:
            Task dict or None if queue is empty
        """
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row

            # Atomic get + lock operation
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
                    datetime.now().isoformat(),
                    datetime.now().isoformat(),
                    TaskStatus.PENDING.value,
                ),
            )

            row = cursor.fetchone()
            conn.commit()

        if row is None:
            return None

        return dict(row)

    # === State Management ===

    def heartbeat(self, task_id: str, progress: float = 0.0) -> None:
        """Update worker heartbeat and progress.

        Args:
            task_id: Task identifier
            progress: Current progress (0-100)
        """
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """
                UPDATE transcription_tasks
                SET last_heartbeat = ?, progress = ?
                WHERE id = ?
                """,
                (datetime.now().isoformat(), progress, task_id),
            )
            conn.commit()

    def complete(
        self, task_id: str, segments: list[dict[str, Any]], duration: float
    ) -> None:
        """Mark task as completed with results.

        Args:
            task_id: Task identifier
            segments: Transcription segments
            duration: Audio duration in seconds
        """
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """
                UPDATE transcription_tasks
                SET status = ?, segments = ?, duration = ?, 
                    progress = 100.0, completed_at = ?
                WHERE id = ?
                """,
                (
                    TaskStatus.COMPLETED.value,
                    json.dumps(segments),
                    duration,
                    datetime.now().isoformat(),
                    task_id,
                ),
            )
            conn.commit()

    def fail(self, task_id: str, error: str, should_retry: bool = True) -> None:
        """Mark task as failed with optional retry.

        Args:
            task_id: Task identifier
            error: Error message
            should_retry: If True, requeue if retries available
        """
        with sqlite3.connect(self.db_path) as conn:
            # Atomic conditional update:
            # 1. Try to requeue if retries available
            if should_retry:
                cursor = conn.execute(
                    """
                    UPDATE transcription_tasks
                    SET status = ?, retry_count = retry_count + 1, 
                        error = ?, worker_id = NULL, started_at = NULL
                    WHERE id = ? AND retry_count < max_retries
                    """,
                    (TaskStatus.PENDING.value, error, task_id),
                )

                # If updated, return successfully
                if cursor.rowcount > 0:
                    conn.commit()
                    return

            # 2. If we reached here, either:
            #    - should_retry is False
            #    - OR retry_count >= max_retries (atomic check failed)
            # So mark as permanently failed
            conn.execute(
                """
                UPDATE transcription_tasks
                SET status = ?, error = ?, completed_at = ?
                WHERE id = ?
                """,
                (
                    TaskStatus.FAILED.value,
                    error,
                    datetime.now().isoformat(),
                    task_id,
                ),
            )

            conn.commit()

    def cancel(self, task_id: str) -> bool:
        """Cancel a task.

        Args:
            task_id: Task identifier

        Returns:
            True if cancelled, False if not found or already completed
        """
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                """
                UPDATE transcription_tasks
                SET status = ?, completed_at = ?
                WHERE id = ? AND status IN (?, ?)
                """,
                (
                    TaskStatus.CANCELLED.value,
                    datetime.now().isoformat(),
                    task_id,
                    TaskStatus.PENDING.value,
                    TaskStatus.PROCESSING.value,
                ),
            )

            cancelled = cursor.rowcount > 0
            conn.commit()

            return cancelled

    # === Maintenance Operations ===

    def requeue_timeout_tasks(self, timeout_seconds: int = 3600) -> int:
        """Requeue tasks that exceeded timeout.

        Args:
            timeout_seconds: Timeout threshold

        Returns:
            Number of tasks requeued
        """
        with sqlite3.connect(self.db_path) as conn:
            timeout_at = datetime.now() - timedelta(seconds=timeout_seconds)

            cursor = conn.execute(
                """
                UPDATE transcription_tasks
                SET status = ?, worker_id = NULL, started_at = NULL,
                    retry_count = retry_count + 1,
                    error = 'Task timeout - requeued'
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

            count = cursor.rowcount
            conn.commit()

            return count

    def requeue_dead_workers(self, heartbeat_timeout: int = 300) -> int:
        """Requeue tasks from workers with stale heartbeat.

        Args:
            heartbeat_timeout: Heartbeat timeout in seconds

        Returns:
            Number of tasks requeued
        """
        with sqlite3.connect(self.db_path) as conn:
            timeout_at = datetime.now() - timedelta(seconds=heartbeat_timeout)

            cursor = conn.execute(
                """
                UPDATE transcription_tasks
                SET status = ?, worker_id = NULL, started_at = NULL,
                    retry_count = retry_count + 1,
                    error = 'Worker heartbeat timeout - requeued'
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

            count = cursor.rowcount
            conn.commit()

            return count

    # === Query Operations ===

    def get_task(self, task_id: str) -> dict[str, Any] | None:
        """Get task details by ID.

        Args:
            task_id: Task identifier

        Returns:
            Task dictionary or None if not found
        """
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute(
                "SELECT * FROM transcription_tasks WHERE id = ?", (task_id,)
            )
            row = cursor.fetchone()

        if row is None:
            return None

        task = dict(row)
        # Parse JSON segments
        if task["segments"]:
            task["segments"] = json.loads(task["segments"])
        return task

    # Legacy method for compatibility
    def create_task(self, task_id: str, file_id: str) -> None:
        """Legacy: Create task (use enqueue instead)."""
        self.enqueue(task_id, file_id)

    def get_next_pending_task(self) -> dict[str, Any] | None:
        """Legacy: Get next pending task (use dequeue instead)."""
        # Note: This doesn't lock the task, for testing only
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute(
                """
                SELECT * FROM transcription_tasks
                WHERE status = ?
                ORDER BY priority DESC, created_at ASC
                LIMIT 1
                """,
                (TaskStatus.PENDING.value,),
            )
            row = cursor.fetchone()

        return dict(row) if row else None

    def update_status(
        self, task_id: str, status: TaskStatus, error: str | None = None
    ) -> None:
        """Legacy: Update task status (use specific methods instead)."""
        with sqlite3.connect(self.db_path) as conn:
            if status in (
                TaskStatus.COMPLETED,
                TaskStatus.FAILED,
                TaskStatus.CANCELLED,
            ):
                conn.execute(
                    """
                    UPDATE transcription_tasks
                    SET status = ?, error = ?, completed_at = ?
                    WHERE id = ?
                    """,
                    (status.value, error, datetime.now().isoformat(), task_id),
                )
            else:
                conn.execute(
                    """
                    UPDATE transcription_tasks
                    SET status = ?, error = ?
                    WHERE id = ?
                    """,
                    (status.value, error, task_id),
                )

            conn.commit()

    def update_progress(self, task_id: str, progress: float) -> None:
        """Legacy: Update progress (use heartbeat instead)."""
        self.heartbeat(task_id, progress)

    def update_result(
        self, task_id: str, segments: list[dict[str, Any]], duration: float
    ) -> None:
        """Legacy: Update result (use complete instead)."""
        self.complete(task_id, segments, duration)

    def list_tasks(
        self,
        status: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[dict[str, Any]]:
        """List tasks with optional filtering."""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            if status:
                cursor = conn.execute(
                    "SELECT * FROM transcription_tasks WHERE status = ? "
                    "ORDER BY created_at DESC LIMIT ? OFFSET ?",
                    (status, limit, offset),
                )
            else:
                cursor = conn.execute(
                    "SELECT * FROM transcription_tasks "
                    "ORDER BY created_at DESC LIMIT ? OFFSET ?",
                    (limit, offset),
                )
            return [dict(row) for row in cursor.fetchall()]

    def count_tasks(self, status: str | None = None) -> int:
        """Count tasks with optional filtering."""
        with sqlite3.connect(self.db_path) as conn:
            if status:
                cursor = conn.execute(
                    "SELECT COUNT(*) FROM transcription_tasks WHERE status = ?",
                    (status,),
                )
            else:
                cursor = conn.execute("SELECT COUNT(*) FROM transcription_tasks")
            return int(cursor.fetchone()[0])
