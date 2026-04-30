"""Read/store-focused task repository operations."""

from contextlib import closing
from datetime import datetime
from typing import cast

from nola.models.query_helpers import build_contains_like_pattern
from nola.models.taskdb.base import TaskRepositoryBase
from nola.models.taskdb.query_helpers import parse_task_row
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


def _build_task_filter_sql(
    *,
    status: str | None,
    q: str | None,
) -> tuple[str, list[str]]:
    """Build safe task list filters."""
    where_clauses: list[str] = []
    params: list[str] = []

    if q:
        pattern = build_contains_like_pattern(q)
        where_clauses.append(
            "("
            "LOWER(t.id) LIKE ? ESCAPE '\\' OR "
            "LOWER(COALESCE(f.filename, '')) LIKE ? ESCAPE '\\'"
            ")"
        )
        params.extend([pattern, pattern])

    if status:
        where_clauses.append("t.status = ?")
        params.append(status)

    where_sql = f" WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
    return where_sql, params


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
        where_sql, filter_params = _build_task_filter_sql(status=status, q=q)
        params: list[str | int] = [*filter_params]
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
        from_sql = "FROM transcription_tasks t LEFT JOIN files f ON f.id = t.file_id"
        where_sql, params = _build_task_filter_sql(status=status, q=q)
        query = f"SELECT COUNT(*) {from_sql}{where_sql}"

        with closing(self._connect()) as conn:
            cursor = conn.execute(query, tuple(params))
            return int(cursor.fetchone()[0])
