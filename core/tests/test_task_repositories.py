"""Repository-level tests for split task storage modules."""

import gc
import json
import sqlite3
import tempfile
from pathlib import Path

import pytest

from nola.models import FileDatabase, init_db
from nola.models.taskdb import TaskQueueRepository, TaskStatus, TaskStoreRepository


@pytest.fixture
def task_repositories():
    """Create isolated task repositories with a fresh SQLite database."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "test.db"
        init_db(db_path)

        file_db = FileDatabase(db_path)
        queue_repo = TaskQueueRepository(db_path)
        store_repo = TaskStoreRepository(db_path)

        try:
            yield file_db, queue_repo, store_repo
        finally:
            gc.collect()


def test_queue_repository_dequeue_honors_priority(task_repositories):
    """dequeue() should claim the highest-priority pending task first."""
    file_db, queue_repo, _ = task_repositories

    file_db.create_file("file-001", "audio.wav", "/tmp/audio.wav", 1024)
    queue_repo.enqueue("task-low", "file-001", priority=0)
    queue_repo.enqueue("task-high", "file-001", priority=10)

    claimed = queue_repo.dequeue("worker-001")

    assert claimed is not None
    assert claimed["id"] == "task-high"
    assert claimed["status"] == TaskStatus.PROCESSING.value
    assert claimed["worker_id"] == "worker-001"


def test_task_store_filename_search_escapes_like_wildcards(task_repositories):
    """q filtering should treat '%' and '_' as literal characters."""
    file_db, queue_repo, store_repo = task_repositories

    file_db.create_file("file-a", "100%_done.wav", "/tmp/a.wav", 100)
    file_db.create_file("file-b", "100AA_done.wav", "/tmp/b.wav", 100)

    queue_repo.enqueue("task-a", "file-a")
    queue_repo.enqueue("task-b", "file-b")

    rows = store_repo.list_tasks(q="%_", limit=10, offset=0)

    assert len(rows) == 1
    assert rows[0]["id"] == "task-a"


def test_task_store_delete_task_record_only_deletes_terminal_tasks(task_repositories):
    """delete_task_record() should reject pending tasks and allow terminal tasks."""
    file_db, queue_repo, store_repo = task_repositories

    file_db.create_file("file-001", "audio.wav", "/tmp/audio.wav", 1024)
    queue_repo.enqueue("task-001", "file-001")

    assert store_repo.delete_task_record("task-001") is False

    snapshot = store_repo.cancel_with_snapshot("task-001")
    assert snapshot is not None
    assert snapshot["status"] == TaskStatus.CANCELLED.value

    assert store_repo.delete_task_record("task-001") is True
    assert store_repo.get_task("task-001") is None


def test_task_store_get_task_drops_invalid_json_shapes(task_repositories):
    """get_task() should coerce non-conforming JSON payload shapes to None."""
    file_db, queue_repo, store_repo = task_repositories

    file_db.create_file("file-001", "audio.wav", "/tmp/audio.wav", 1024)
    queue_repo.enqueue("task-001", "file-001")

    with sqlite3.connect(queue_repo.db_path) as conn:
        conn.execute(
            """
            UPDATE transcription_tasks
            SET segments = ?, options = ?
            WHERE id = ?
            """,
            (
                json.dumps({"start": 0.0, "end": 1.0, "text": "bad-shape"}),
                json.dumps(["bad-shape"]),
                "task-001",
            ),
        )

    task = store_repo.get_task("task-001")

    assert task is not None
    assert task["segments"] is None
    assert task["options"] is None


def test_task_store_preserves_model_id(task_repositories):
    """Queue and store layers should keep one reserved task model id."""
    file_db, queue_repo, store_repo = task_repositories

    file_db.create_file("file-001", "audio.wav", "/tmp/audio.wav", 1024)
    queue_repo.enqueue("task-001", "file-001", model_id="small")

    claimed = queue_repo.dequeue("worker-001")
    stored = store_repo.get_task("task-001")

    assert claimed is not None
    assert claimed["model_id"] == "small"
    assert stored is not None
    assert stored["model_id"] == "small"
