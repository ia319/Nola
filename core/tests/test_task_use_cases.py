"""Unit tests for task application use-cases."""

from collections import deque

import pytest

from nola.application.tasks import batch_cancel_tasks, batch_retry_tasks, create_task
from nola.application.tasks.errors import TaskUseCaseError


class FakeFileStore:
    """In-memory file store for use-case tests."""

    def __init__(self, files: dict[str, dict[str, object]]) -> None:
        self.files = files

    def get_file(self, file_id: str) -> dict[str, object] | None:
        return self.files.get(file_id)


class FakeTaskStore:
    """In-memory task store for use-case tests."""

    def __init__(self, tasks: dict[str, dict[str, object]]) -> None:
        self.tasks = tasks
        self.enqueued: list[dict[str, object]] = []

    def get_task(self, task_id: str) -> dict[str, object] | None:
        task = self.tasks.get(task_id)
        return dict(task) if task else None

    def cancel_with_snapshot(self, task_id: str) -> dict[str, object] | None:
        task = self.tasks.get(task_id)
        if task is None:
            return None
        if task["status"] not in {"pending", "processing"}:
            return None
        task["status"] = "cancelled"
        task["completed_at"] = "2026-01-01T00:00:00"
        return dict(task)

    def enqueue(
        self,
        task_id: str,
        file_id: str,
        priority: int = 0,
        max_retries: int = 3,
        options: dict[str, object] | None = None,
    ) -> None:
        task = {
            "id": task_id,
            "file_id": file_id,
            "status": "pending",
            "progress": 0.0,
            "created_at": "2026-01-01T00:00:00",
            "completed_at": None,
            "options": options,
        }
        self.tasks[task_id] = task
        self.enqueued.append(
            {
                "task_id": task_id,
                "file_id": file_id,
                "priority": priority,
                "max_retries": max_retries,
                "options": options,
            }
        )

    def delete_task_record(self, task_id: str) -> bool:
        if task_id not in self.tasks:
            return False
        self.tasks.pop(task_id)
        return True


class FailingEnqueueTaskStore(FakeTaskStore):
    """In-memory task store that can fail selected enqueue calls."""

    def __init__(
        self,
        tasks: dict[str, dict[str, object]],
        fail_enqueue_task_ids: set[str],
    ) -> None:
        super().__init__(tasks)
        self.fail_enqueue_task_ids = fail_enqueue_task_ids

    def enqueue(
        self,
        task_id: str,
        file_id: str,
        priority: int = 0,
        max_retries: int = 3,
        options: dict[str, object] | None = None,
    ) -> None:
        if task_id in self.fail_enqueue_task_ids:
            raise RuntimeError("sqlite busy")
        super().enqueue(
            task_id=task_id,
            file_id=file_id,
            priority=priority,
            max_retries=max_retries,
            options=options,
        )


def _base_task(*, task_id: str, file_id: str, status: str) -> dict[str, object]:
    return {
        "id": task_id,
        "file_id": file_id,
        "status": status,
        "progress": 0.0,
        "created_at": "2026-01-01T00:00:00",
        "completed_at": None,
        "options": None,
    }


def test_batch_cancel_tasks_returns_mixed_outcomes() -> None:
    file_store = FakeFileStore(
        files={
            "f1": {"id": "f1", "filename": "pending.mp3"},
            "f2": {"id": "f2", "filename": "completed.mp3"},
        }
    )
    task_store = FakeTaskStore(
        tasks={
            "t1": _base_task(task_id="t1", file_id="f1", status="pending"),
            "t2": _base_task(task_id="t2", file_id="f2", status="completed"),
        }
    )

    payload = batch_cancel_tasks(
        task_store=task_store,
        file_store=file_store,
        task_ids=["t1", "t2", "missing", "t1"],
    )

    assert payload["action"] == "cancel"
    assert payload["summary"] == {"requested": 4, "succeeded": 1, "failed": 3}
    results = payload["results"]
    assert results[0]["task_id"] == "t1"
    assert results[0]["ok"] is True
    assert results[0]["status"] == "cancelled"
    assert results[1]["error_code"] == "invalid_status"
    assert results[2]["error_code"] == "not_found"
    assert results[3]["error_code"] == "duplicate_task_id"


def test_batch_retry_tasks_returns_mixed_outcomes() -> None:
    file_store = FakeFileStore(
        files={
            "f1": {"id": "f1", "filename": "failed.mp3"},
            "f2": {"id": "f2", "filename": "pending.mp3"},
        }
    )
    task_store = FakeTaskStore(
        tasks={
            "failed": {
                **_base_task(task_id="failed", file_id="f1", status="failed"),
                "options": {"language": "zh"},
            },
            "pending": _base_task(task_id="pending", file_id="f2", status="pending"),
            "cancelled_missing_file": _base_task(
                task_id="cancelled_missing_file",
                file_id="f-missing",
                status="cancelled",
            ),
        }
    )

    generated_ids = deque(["retry-1"])
    payload = batch_retry_tasks(
        task_store=task_store,
        file_store=file_store,
        task_ids=[
            "failed",
            "cancelled_missing_file",
            "pending",
            "unknown",
            "failed",
        ],
        task_id_factory=generated_ids.popleft,
    )

    assert payload["action"] == "retry"
    assert payload["summary"] == {"requested": 5, "succeeded": 1, "failed": 4}
    results = payload["results"]
    assert results[0]["ok"] is True
    assert results[0]["new_task_id"] == "retry-1"
    assert results[1]["error_code"] == "file_missing"
    assert results[2]["error_code"] == "invalid_status"
    assert results[3]["error_code"] == "not_found"
    assert results[4]["error_code"] == "duplicate_task_id"
    assert task_store.get_task("retry-1") is not None


def test_batch_retry_tasks_continues_when_enqueue_fails() -> None:
    file_store = FakeFileStore(
        files={
            "f1": {"id": "f1", "filename": "failed-1.mp3"},
            "f2": {"id": "f2", "filename": "failed-2.mp3"},
        }
    )
    task_store = FailingEnqueueTaskStore(
        tasks={
            "failed-1": _base_task(task_id="failed-1", file_id="f1", status="failed"),
            "failed-2": _base_task(task_id="failed-2", file_id="f2", status="failed"),
        },
        fail_enqueue_task_ids={"retry-fail"},
    )

    generated_ids = deque(["retry-fail", "retry-ok"])
    payload = batch_retry_tasks(
        task_store=task_store,
        file_store=file_store,
        task_ids=["failed-1", "failed-2"],
        task_id_factory=generated_ids.popleft,
    )

    assert payload["action"] == "retry"
    assert payload["summary"] == {"requested": 2, "succeeded": 1, "failed": 1}
    results = payload["results"]
    assert results[0]["task_id"] == "failed-1"
    assert results[0]["ok"] is False
    assert "Failed to create retry task" in results[0]["message"]
    assert "new_task_id" not in results[0]
    assert results[1]["task_id"] == "failed-2"
    assert results[1]["ok"] is True
    assert results[1]["new_task_id"] == "retry-ok"
    assert task_store.get_task("retry-fail") is None
    assert task_store.get_task("retry-ok") is not None


def test_create_task_raises_when_file_missing() -> None:
    file_store = FakeFileStore(files={})
    task_store = FakeTaskStore(tasks={})

    with pytest.raises(TaskUseCaseError) as error:
        create_task(
            file_store=file_store,
            task_store=task_store,
            file_id="missing-file",
            options=None,
        )

    assert error.value.status_code == 404
