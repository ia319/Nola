"""Production-grade transcription task queue management."""

import json
import logging
import sqlite3
from contextlib import closing
from datetime import datetime, timedelta
from enum import Enum
from pathlib import Path
from typing import Any, Literal, TypedDict, cast

logger = logging.getLogger(__name__)


class TaskRowRaw(TypedDict):
    """Raw row from SQLite, segments/options are JSON strings."""

    id: str
    file_id: str
    status: str
    priority: int
    retry_count: int
    max_retries: int
    worker_id: str | None
    started_at: str | None
    last_heartbeat: str | None
    timeout_seconds: int
    options: str | None
    progress: float
    duration: float | None
    segments: str | None
    error: str | None
    created_at: str
    completed_at: str | None


class TaskRow(TypedDict):
    """Parsed task row, segments/options already deserialized."""

    id: str
    file_id: str
    status: str
    priority: int
    retry_count: int
    max_retries: int
    worker_id: str | None
    started_at: str | None
    last_heartbeat: str | None
    timeout_seconds: int
    options: dict[str, Any] | None
    progress: float
    duration: float | None
    segments: list[dict[str, Any]] | None
    error: str | None
    created_at: str
    completed_at: str | None


class TaskStatus(str, Enum):
    """Transcription task status."""

    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


TaskSortField = Literal["created_at", "completed_at", "status", "progress"]
TaskSortOrder = Literal["asc", "desc"]
DEFAULT_TASK_SORT_BY: TaskSortField = "created_at"
DEFAULT_TASK_SORT_ORDER: TaskSortOrder = "desc"
TASK_SORT_COLUMNS: dict[TaskSortField, str] = {
    "created_at": "t.created_at",
    "completed_at": "t.completed_at",
    "status": "t.status",
    "progress": "t.progress",
}
TERMINAL_TASK_STATUSES = (
    TaskStatus.COMPLETED.value,
    TaskStatus.FAILED.value,
    TaskStatus.CANCELLED.value,
)


class TaskDatabase:
    """Manage transcription tasks with production-grade queue operations."""

    def __init__(self, db_path: str | Path = "data/nola.db") -> None:
        """Initialize task database.

        Args:
            db_path: Path to SQLite database file
        """
        self.db_path = Path(db_path)

    def _connect(self) -> sqlite3.Connection:
        """Create connection with foreign key enforcement."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    # === Queue Operations ===

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

        if row is None:
            return None

        return cast(TaskRowRaw, dict(row))

    # === State Management ===

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
                        progress = 100.0, completed_at = ?
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
                # 1. Try to requeue if retries available
                if should_retry:
                    cursor = conn.execute(
                        """
                        UPDATE transcription_tasks
                        SET status = ?, retry_count = retry_count + 1, 
                            error = ?, worker_id = NULL, started_at = NULL
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
                # So mark as permanently failed
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
                    logger.warning(f"Attempted to fail non-existent task: {task_id}")
                    return False
                return True

    def cancel(self, task_id: str) -> bool:
        """Cancel a task.

        Args:
            task_id: Task identifier

        Returns:
            True if cancelled, False if not found or already completed
        """
        with closing(self._connect()) as conn:
            with conn:
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

                return cancelled

    # === Maintenance Operations ===

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

    # === Query Operations ===

    def get_task(self, task_id: str) -> TaskRow | None:
        """Get task details by ID.

        Args:
            task_id: Task identifier

        Returns:
            Task dictionary or None if not found
        """
        with closing(self._connect()) as conn:
            cursor = conn.execute(
                "SELECT * FROM transcription_tasks WHERE id = ?", (task_id,)
            )
            row = cursor.fetchone()

        if row is None:
            return None

        task = dict(row)
        # Parse JSON fields
        if task["segments"]:
            try:
                task["segments"] = json.loads(task["segments"])
            except json.JSONDecodeError:
                logger.warning("Corrupted segments JSON for task %s", task_id)
                task["segments"] = None
        if task["options"]:
            try:
                task["options"] = json.loads(task["options"])
            except json.JSONDecodeError:
                logger.warning("Corrupted options JSON for task %s", task_id)
                task["options"] = None
        return cast(TaskRow, task)

    def delete_task_record(self, task_id: str) -> bool:
        """Delete a task record by ID.

        Args:
            task_id: Task identifier

        Returns:
            True if deleted, False if task is missing or non-terminal
        """
        with closing(self._connect()) as conn:
            with conn:
                # Enforce terminal-only deletion at the data layer so direct model
                # callers cannot bypass route-level status checks.
                cursor = conn.execute(
                    """
                    DELETE FROM transcription_tasks
                    WHERE id = ? AND status IN (?, ?, ?)
                    """,
                    (task_id, *TERMINAL_TASK_STATUSES),
                )
                return cursor.rowcount > 0

    # Legacy method for compatibility
    def create_task(self, task_id: str, file_id: str) -> None:
        """Legacy: Create task (use enqueue instead)."""
        self.enqueue(task_id, file_id)

    def get_next_pending_task(self) -> TaskRowRaw | None:
        """Legacy: Get next pending task (use dequeue instead)."""
        # Note: This doesn't lock the task, for testing only
        with closing(self._connect()) as conn:
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

        return cast(TaskRowRaw, dict(row)) if row else None

    def update_status(
        self, task_id: str, status: TaskStatus, error: str | None = None
    ) -> bool:
        """Legacy: Update task status (use specific methods instead).

        Warning:
            This method is deprecated. Use complete(), fail(), or cancel() instead.

        Returns:
            True if updated, False if task is in terminal state
        """
        terminal_states = (
            TaskStatus.COMPLETED.value,
            TaskStatus.FAILED.value,
            TaskStatus.CANCELLED.value,
        )

        with closing(self._connect()) as conn:
            with conn:
                # Check current status to avoid overwriting terminal states
                if status in (
                    TaskStatus.COMPLETED,
                    TaskStatus.FAILED,
                    TaskStatus.CANCELLED,
                ):
                    cursor = conn.execute(
                        """
                        UPDATE transcription_tasks
                        SET status = ?, error = ?, completed_at = ?
                        WHERE id = ? AND status NOT IN (?, ?, ?)
                        """,
                        (
                            status.value,
                            error,
                            datetime.now().isoformat(),
                            task_id,
                            *terminal_states,
                        ),
                    )
                else:
                    cursor = conn.execute(
                        """
                        UPDATE transcription_tasks
                        SET status = ?, error = ?
                        WHERE id = ? AND status NOT IN (?, ?, ?)
                        """,
                        (status.value, error, task_id, *terminal_states),
                    )

                return cursor.rowcount > 0

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
        q: str | None = None,
        sort_by: TaskSortField = DEFAULT_TASK_SORT_BY,
        order: TaskSortOrder = DEFAULT_TASK_SORT_ORDER,
    ) -> list[TaskRowRaw]:
        """List tasks with optional status/search filters and sorting."""
        sort_column = TASK_SORT_COLUMNS[sort_by]
        sort_order = "ASC" if order == "asc" else "DESC"

        from_sql = "FROM transcription_tasks t"
        where_clauses: list[str] = []
        params: list[str | int] = []

        if q:
            from_sql += " JOIN files f ON f.id = t.file_id"
            # Keep contains search semantics (%keyword%) for UX consistency.
            # This may full-scan on SQLite; move to FTS when data volume grows.
            where_clauses.append("LOWER(f.filename) LIKE ?")
            params.append(f"%{q.lower()}%")

        if status:
            where_clauses.append("t.status = ?")
            params.append(status)

        where_sql = f" WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
        query = (
            "SELECT t.* "
            f"{from_sql}{where_sql} "
            f"ORDER BY {sort_column} {sort_order}, t.id DESC "
            "LIMIT ? OFFSET ?"
        )
        params.extend([limit, offset])

        with closing(self._connect()) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute(query, tuple(params))
            return [cast(TaskRowRaw, dict(row)) for row in cursor.fetchall()]

    def count_tasks(self, status: str | None = None, q: str | None = None) -> int:
        """Count tasks with optional status/search filters."""
        from_sql = "FROM transcription_tasks t"
        where_clauses: list[str] = []
        params: list[str] = []

        if q:
            from_sql += " JOIN files f ON f.id = t.file_id"
            # Keep contains search semantics (%keyword%) for UX consistency.
            # This may full-scan on SQLite; move to FTS when data volume grows.
            where_clauses.append("LOWER(f.filename) LIKE ?")
            params.append(f"%{q.lower()}%")

        if status:
            where_clauses.append("t.status = ?")
            params.append(status)

        where_sql = f" WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
        query = f"SELECT COUNT(*) {from_sql}{where_sql}"

        with closing(self._connect()) as conn:
            cursor = conn.execute(query, tuple(params))
            return int(cursor.fetchone()[0])
