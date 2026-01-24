"""Pytest tests for database models."""

import tempfile
from pathlib import Path

import pytest

from nola.models import FileDatabase, TaskDatabase, TaskStatus, init_db


@pytest.fixture
def test_db():
    """Create isolated test database."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "test.db"

        # Monkeypatch database path
        import nola.models.database as db_module

        original_path = db_module.DB_PATH
        db_module.DB_PATH = db_path

        # Initialize schema
        init_db()

        # Provide database instances
        file_db = FileDatabase(db_path)
        task_db = TaskDatabase(db_path)

        try:
            yield file_db, task_db
        finally:
            # Ensure all connections are closed before cleanup
            import gc

            gc.collect()

            # Restore original path
            db_module.DB_PATH = original_path


class TestFileDatabase:
    """Test file management operations."""

    def test_create_and_get_file(self, test_db):
        """Test file creation and retrieval."""
        file_db, _ = test_db

        file_db.create_file("file-001", "test.mp3", "/tmp/test.mp3", 1024, "audio/mpeg")
        file = file_db.get_file("file-001")

        assert file is not None
        assert file["filename"] == "test.mp3"
        assert file["size"] == 1024

    def test_get_file_path(self, test_db):
        """Test file path retrieval."""
        file_db, _ = test_db

        file_db.create_file("file-002", "test.mp3", "/tmp/test.mp3", 1024)
        path = file_db.get_file_path("file-002")

        assert path == "/tmp/test.mp3"

    def test_delete_file(self, test_db):
        """Test file deletion."""
        file_db, _ = test_db

        file_db.create_file("file-003", "test.mp3", "/tmp/test.mp3", 1024)
        deleted = file_db.delete_file("file-003")

        assert deleted is True
        assert file_db.get_file("file-003") is None


class TestTaskDatabase:
    """Test task queue operations."""

    def test_enqueue_and_dequeue(self, test_db):
        """Test priority-based task queueing."""
        file_db, task_db = test_db

        # Create file
        file_db.create_file("file-001", "test.mp3", "/tmp/test.mp3", 1024)

        # Enqueue with different priorities
        task_db.enqueue("task-low", "file-001", priority=0)
        task_db.enqueue("task-high", "file-001", priority=10)
        task_db.enqueue("task-mid", "file-001", priority=5)

        # Dequeue should get highest priority
        task = task_db.dequeue("worker-001")
        assert task is not None
        assert task["id"] == "task-high"
        assert task["priority"] == 10
        assert task["status"] == TaskStatus.PROCESSING.value
        assert task["worker_id"] == "worker-001"

    def test_heartbeat(self, test_db):
        """Test worker heartbeat updates."""
        file_db, task_db = test_db

        file_db.create_file("file-001", "test.mp3", "/tmp/test.mp3", 1024)
        task_db.enqueue("task-001", "file-001")
        task_db.dequeue("worker-001")

        task_db.heartbeat("task-001", progress=50.0)
        task = task_db.get_task("task-001")

        assert task["progress"] == 50.0
        assert task["last_heartbeat"] is not None

    def test_complete_task(self, test_db):
        """Test task completion."""
        file_db, task_db = test_db

        file_db.create_file("file-001", "test.mp3", "/tmp/test.mp3", 1024)
        task_db.enqueue("task-001", "file-001")
        task_db.dequeue("worker-001")

        segments = [{"start": 0.0, "end": 2.5, "text": "Test"}]
        task_db.complete("task-001", segments, 2.5)

        task = task_db.get_task("task-001")
        assert task["status"] == TaskStatus.COMPLETED.value
        assert task["duration"] == 2.5
        assert len(task["segments"]) == 1
        assert task["completed_at"] is not None

    def test_fail_with_retry(self, test_db):
        """Test task failure with retry."""
        file_db, task_db = test_db

        file_db.create_file("file-001", "test.mp3", "/tmp/test.mp3", 1024)
        task_db.enqueue("task-001", "file-001", max_retries=3)
        task_db.dequeue("worker-001")

        task_db.fail("task-001", "Test error", should_retry=True)
        task = task_db.get_task("task-001")

        assert task["status"] == TaskStatus.PENDING.value  # Requeued
        assert task["retry_count"] == 1
        assert task["error"] == "Test error"

    def test_cancel_task(self, test_db):
        """Test task cancellation."""
        file_db, task_db = test_db

        file_db.create_file("file-001", "test.mp3", "/tmp/test.mp3", 1024)
        task_db.enqueue("task-001", "file-001")

        cancelled = task_db.cancel("task-001")
        assert cancelled is True

        task = task_db.get_task("task-001")
        assert task["status"] == TaskStatus.CANCELLED.value

    def test_requeue_timeout_tasks(self, test_db):
        """Test timeout task recovery."""
        file_db, task_db = test_db

        file_db.create_file("file-001", "test.mp3", "/tmp/test.mp3", 1024)
        task_db.enqueue("task-001", "file-001")
        task_db.dequeue("worker-001")

        # Requeue with zero timeout (immediate)
        count = task_db.requeue_timeout_tasks(timeout_seconds=0)
        assert count == 1

        task = task_db.get_task("task-001")
        assert task["status"] == TaskStatus.PENDING.value
        assert "timeout" in task["error"].lower()
