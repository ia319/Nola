"""Read/store-focused task repository operations."""

from contextlib import closing
from datetime import datetime
from typing import cast

from nola.models.taskdb.base import TaskRepositoryBase
from nola.models.taskdb.query_helpers import escape_like_fragment, parse_task_row
from nola.models.taskdb.types import (
    CANCELLABLE_TASK_STATUSES,
    DEFAULT_TASK_SORT_BY,
    DEFAULT_TASK_SORT_ORDER,
    TASK_SORT_COLUMNS,
    TERMINAL_TASK_STATUSES,
    TaskRow,
    TaskRowRaw,
    TaskSortField,
    TaskSortOrder,
    TaskStatus,
)


class TaskStoreRepository(TaskRepositoryBase):
    """Handle task reads and non-queue mutations."""

    def get_task(self, task_id: str) -> TaskRow | None:
        """Get task details by ID.

        Args:
            task_id: Task identifier

        Returns:
            Task dictionary or None if not found
        """
        with closing(self._connect()) as conn:
            cursor = conn.execute(
                "SELECT * FROM transcription_tasks WHERE id = ?",
                (task_id,),
            )
            row = cursor.fetchone()

        if row is None:
            return None
        return parse_task_row(row, task_id)

    def cancel_with_snapshot(self, task_id: str) -> TaskRowRaw | None:
        """Cancel a pending/processing task and return the updated row snapshot.

        Args:
            task_id: Task identifier

        Returns:
            Updated task row when cancellation succeeds, otherwise None
        """
        with closing(self._connect()) as conn:
            with conn:
                cursor = conn.execute(
                    """
                    UPDATE transcription_tasks
                    SET status = ?, completed_at = ?
                    WHERE id = ? AND status IN (?, ?)
                    RETURNING *
                    """,
                    (
                        TaskStatus.CANCELLED.value,
                        datetime.now().isoformat(),
                        task_id,
                        *CANCELLABLE_TASK_STATUSES,
                    ),
                )
                row = cursor.fetchone()
                if row is None:
                    return None
                return cast(TaskRowRaw, dict(row))

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

        from_sql = "FROM transcription_tasks t LEFT JOIN files f ON f.id = t.file_id"
        where_clauses: list[str] = []
        params: list[str | int] = []

        if q:
            # Keep contains search semantics (%keyword%) for UX consistency.
            # This may full-scan on SQLite; move to FTS when data volume grows.
            escaped_q = escape_like_fragment(q.lower())
            where_clauses.append("LOWER(f.filename) LIKE ? ESCAPE '\\'")
            params.append(f"%{escaped_q}%")

        if status:
            where_clauses.append("t.status = ?")
            params.append(status)

        where_sql = f" WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
        query = (
            "SELECT t.*, f.filename AS filename "
            f"{from_sql}{where_sql} "
            f"ORDER BY {sort_column} {sort_order}, t.id DESC "
            "LIMIT ? OFFSET ?"
        )
        params.extend([limit, offset])

        with closing(self._connect()) as conn:
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
            escaped_q = escape_like_fragment(q.lower())
            where_clauses.append("LOWER(f.filename) LIKE ? ESCAPE '\\'")
            params.append(f"%{escaped_q}%")

        if status:
            where_clauses.append("t.status = ?")
            params.append(status)

        where_sql = f" WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
        query = f"SELECT COUNT(*) {from_sql}{where_sql}"

        with closing(self._connect()) as conn:
            cursor = conn.execute(query, tuple(params))
            return int(cursor.fetchone()[0])

    def get_next_pending_task(self) -> TaskRowRaw | None:
        """Legacy: Get next pending task without locking (testing only)."""
        with closing(self._connect()) as conn:
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
        terminal_states = (
            TaskStatus.COMPLETED.value,
            TaskStatus.FAILED.value,
            TaskStatus.CANCELLED.value,
        )
        with closing(self._connect()) as conn:
            with conn:
                # Check current status to avoid overwriting terminal states.
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
