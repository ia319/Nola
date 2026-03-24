"""Task read-only use-cases."""

from nola.application.tasks.queries.get_task import get_task_detail
from nola.application.tasks.queries.list_tasks import list_tasks

__all__ = ["get_task_detail", "list_tasks"]
