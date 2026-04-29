"""Read-only task endpoints."""

from typing import Literal

from fastapi import APIRouter, Query

from nola.api.deps import get_file_db, get_task_db
from nola.api.routes.tasks._errors import raise_http_error
from nola.api.schemas import TaskDetailResponse, TaskListResponse
from nola.application.tasks.errors import TaskUseCaseError
from nola.application.tasks.queries import get_task_detail, list_tasks
from nola.application.tasks.types import TaskDetailPayload, TaskListPayload
from nola.models.tasks import (
    DEFAULT_TASK_SORT_BY,
    DEFAULT_TASK_SORT_ORDER,
    TaskSortField,
    TaskSortOrder,
)

router = APIRouter()

# Valid status values for filtering.
StatusFilter = Literal["pending", "processing", "completed", "failed", "cancelled"]


@router.get("/", response_model=TaskListResponse)
def list_transcriptions(
    status: StatusFilter | None = Query(None, description="Filter by status"),
    limit: int = Query(50, ge=1, le=100, description="Max results"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    q: str | None = Query(
        None,
        description="Search keyword for task id or filename",
    ),
    sort_by: TaskSortField = Query(DEFAULT_TASK_SORT_BY, description="Sort field"),
    order: TaskSortOrder = Query(DEFAULT_TASK_SORT_ORDER, description="Sort order"),
) -> TaskListPayload:
    """List all transcription tasks.

    Args:
        status: Optional status filter
            (pending, processing, completed, failed, cancelled)
        limit: Maximum number of results
        offset: Pagination offset
        q: Optional task id or filename search keyword
        sort_by: Sort field
        order: Sort order (asc or desc)

    Returns:
        List of tasks with pagination info.
    """
    try:
        return list_tasks(
            task_store=get_task_db(),
            status=status,
            limit=limit,
            offset=offset,
            q=q,
            sort_by=sort_by,
            order=order,
        )
    except TaskUseCaseError as error:
        raise_http_error(error)


@router.get("/{task_id}", response_model=TaskDetailResponse)
def get_transcription(task_id: str) -> TaskDetailPayload:
    """Get transcription task status and result.

    Args:
        task_id: Task identifier

    Returns:
        Task status and result.
    """
    try:
        return get_task_detail(
            task_store=get_task_db(),
            file_store=get_file_db(),
            task_id=task_id,
        )
    except TaskUseCaseError as error:
        raise_http_error(error)
