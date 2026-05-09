"""Declare task use-case contracts used by the application layer."""

from typing import Protocol

from nola.application.tasks.types import TaskOptions, TaskRuntimeConfig
from nola.models.files import FileRow
from nola.models.tasks import TaskRow, TaskRowRaw, TaskSortField, TaskSortOrder


class SupportsFileQueries(Protocol):
    """Expose file lookups required by task use-cases."""

    def get_file(self, file_id: str) -> FileRow | None:
        """Return a file row by id."""
        ...


class SupportsTaskQueries(Protocol):
    """Expose task reads required by task use-cases."""

    def get_task(self, task_id: str) -> TaskRow | None:
        """Return task details by id."""
        ...

    def list_tasks(
        self,
        status: str | None = None,
        limit: int = 50,
        offset: int = 0,
        q: str | None = None,
        sort_by: TaskSortField = "created_at",
        order: TaskSortOrder = "desc",
    ) -> list[TaskRowRaw]:
        """Return paged task rows."""
        ...

    def count_tasks(self, status: str | None = None, q: str | None = None) -> int:
        """Return total task count for a filter."""
        ...


class SupportsTaskMutations(Protocol):
    """Expose task writes required by task use-cases."""

    def enqueue(
        self,
        task_id: str,
        file_id: str,
        priority: int = 0,
        max_retries: int = 3,
        options: TaskOptions | None = None,
        model_id: str | None = None,
        engine_device: str | None = None,
        engine_compute_type: str | None = None,
        runtime_config: TaskRuntimeConfig | None = None,
    ) -> None:
        """Insert a pending task."""
        ...

    def cancel_with_snapshot(self, task_id: str) -> TaskRowRaw | None:
        """Cancel a task and return the updated snapshot."""
        ...

    def delete_task_record(self, task_id: str) -> bool:
        """Delete a terminal task row."""
        ...


class SupportsTaskActions(SupportsTaskQueries, SupportsTaskMutations, Protocol):
    """Aggregate task protocol for route-oriented use-cases."""
