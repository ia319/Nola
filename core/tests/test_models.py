"""Pytest tests for database models."""

import gc
import sqlite3
import tempfile
from contextlib import closing
from pathlib import Path

import pytest

from nola.models import FileDatabase, TaskDatabase, TaskStatus, init_db


@pytest.fixture
def test_db():
    """Create isolated test database."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "test.db"

        init_db(db_path)

        file_db = FileDatabase(db_path)
        task_db = TaskDatabase(db_path)

        try:
            yield file_db, task_db
        finally:
            gc.collect()


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

    def test_list_files_supports_search_filter_sort_and_count(self, test_db):
        """File list query should search, filter, sort, and count consistently."""
        file_db, _ = test_db

        file_db.create_file(
            "file-zeta",
            "zeta.wav",
            "/tmp/zeta.wav",
            300,
            "audio/wav",
        )
        file_db.create_file(
            "needle-file",
            "alpha.mp3",
            "/tmp/alpha.mp3",
            100,
            "audio/mpeg",
        )
        file_db.create_file(
            "file-beta",
            "beta.flac",
            "/tmp/beta.flac",
            200,
            "audio/flac",
        )

        id_rows = file_db.list_files(q="needle", limit=10, offset=0)
        content_rows = file_db.list_files(q="audio/wav", limit=10, offset=0)
        filtered_rows = file_db.list_files(
            content_type="audio/mpeg",
            limit=10,
            offset=0,
        )
        sorted_rows = file_db.list_files(
            sort_by="filename",
            order="asc",
            limit=10,
            offset=0,
        )

        assert [row["id"] for row in id_rows] == ["needle-file"]
        assert [row["id"] for row in content_rows] == ["file-zeta"]
        assert [row["id"] for row in filtered_rows] == ["needle-file"]
        assert [row["filename"] for row in sorted_rows] == [
            "alpha.mp3",
            "beta.flac",
            "zeta.wav",
        ]
        assert file_db.count_files(q="needle") == 1
        assert file_db.count_files(content_type="audio/mpeg") == 1


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

    def test_complete_task_clears_stale_error_after_retry(self, test_db):
        """complete() should clear previous failure error after retry succeeds."""
        file_db, task_db = test_db

        file_db.create_file("file-001", "test.mp3", "/tmp/test.mp3", 1024)
        task_db.enqueue("task-001", "file-001", max_retries=3)
        task_db.dequeue("worker-001")
        task_db.fail("task-001", "Temporary failure", should_retry=True)

        task_db.dequeue("worker-002")
        task_db.complete("task-001", [{"start": 0.0, "end": 1.0, "text": "ok"}], 1.0)

        task = task_db.get_task("task-001")
        assert task["status"] == TaskStatus.COMPLETED.value
        assert task["error"] is None

    def test_fail_with_retry(self, test_db):
        """Test task failure with retry."""
        file_db, task_db = test_db

        file_db.create_file("file-001", "test.mp3", "/tmp/test.mp3", 1024)
        task_db.enqueue("task-001", "file-001", max_retries=3)
        task_db.dequeue("worker-001")

        result = task_db.fail("task-001", "Test error", should_retry=True)
        task = task_db.get_task("task-001")

        assert result is True
        assert task["status"] == TaskStatus.PENDING.value  # Requeued
        assert task["retry_count"] == 1
        assert task["error"] == "Test error"

    def test_fail_with_retry_resets_progress_and_heartbeat(self, test_db):
        """Retry requeue from fail() should clear stale processing runtime fields."""
        file_db, task_db = test_db

        file_db.create_file("file-001", "test.mp3", "/tmp/test.mp3", 1024)
        task_db.enqueue("task-001", "file-001", max_retries=3)
        task_db.dequeue("worker-001")
        task_db.heartbeat("task-001", progress=82.0)

        result = task_db.fail("task-001", "Test error", should_retry=True)
        task = task_db.get_task("task-001")

        assert result is True
        assert task["status"] == TaskStatus.PENDING.value
        assert task["progress"] == 0.0
        assert task["last_heartbeat"] is None

    def test_fail_max_retries_reached(self, test_db):
        """Test task failure when max retries are reached."""
        file_db, task_db = test_db

        file_db.create_file("file-001", "test.mp3", "/tmp/test.mp3", 1024)
        # Create task with 0 retries allowed
        task_db.enqueue("task-001", "file-001", max_retries=0)
        task_db.dequeue("worker-001")

        result = task_db.fail("task-001", "Final error", should_retry=True)
        task = task_db.get_task("task-001")

        assert result is True
        assert task["status"] == TaskStatus.FAILED.value
        assert task["retry_count"] == 0
        assert task["error"] == "Final error"
        assert task["completed_at"] is not None

    def test_fail_non_existent_task(self, test_db):
        """Test failing a non-existent task returns False."""
        _, task_db = test_db
        # Should not raise error, but return False
        result = task_db.fail("non-existent", "Error")
        assert result is False

    def test_cancel_task(self, test_db):
        """Test task cancellation."""
        file_db, task_db = test_db

        file_db.create_file("file-001", "test.mp3", "/tmp/test.mp3", 1024)
        task_db.enqueue("task-001", "file-001")

        cancelled = task_db.cancel("task-001")
        assert cancelled is True

        task = task_db.get_task("task-001")
        assert task["status"] == TaskStatus.CANCELLED.value

    def test_cancel_with_snapshot(self, test_db):
        """cancel_with_snapshot() should return cancelled task row."""
        file_db, task_db = test_db

        file_db.create_file("file-001", "test.mp3", "/tmp/test.mp3", 1024)
        task_db.enqueue("task-001", "file-001")

        snapshot = task_db.cancel_with_snapshot("task-001")

        assert snapshot is not None
        assert snapshot["id"] == "task-001"
        assert snapshot["status"] == TaskStatus.CANCELLED.value
        assert snapshot["completed_at"] is not None

    def test_requeue_timeout_tasks(self, test_db):
        """Test timeout task recovery."""
        file_db, task_db = test_db

        file_db.create_file("file-001", "test.mp3", "/tmp/test.mp3", 1024)
        task_db.enqueue("task-001", "file-001")
        task_db.dequeue("worker-001")
        task_db.heartbeat("task-001", progress=73.0)

        # Requeue with zero timeout (immediate)
        count = task_db.requeue_timeout_tasks(timeout_seconds=0)
        assert count == 1

        task = task_db.get_task("task-001")
        assert task["status"] == TaskStatus.PENDING.value
        assert "timeout" in task["error"].lower()
        assert task["retry_count"] == 1  # Verify retry count incremented
        assert task["progress"] == 0.0
        assert task["last_heartbeat"] is None

    def test_requeue_dead_workers_resets_progress_and_heartbeat(self, test_db):
        """Dead-worker requeue should clear stale processing runtime fields."""
        file_db, task_db = test_db

        file_db.create_file("file-001", "test.mp3", "/tmp/test.mp3", 1024)
        task_db.enqueue("task-001", "file-001")
        task_db.dequeue("worker-001")
        task_db.heartbeat("task-001", progress=91.0)

        count = task_db.requeue_dead_workers(heartbeat_timeout=0)
        assert count == 1

        task = task_db.get_task("task-001")
        assert task["status"] == TaskStatus.PENDING.value
        assert "heartbeat timeout" in task["error"].lower()
        assert task["retry_count"] == 1
        assert task["progress"] == 0.0
        assert task["last_heartbeat"] is None

    def test_requeue_poison_pill(self, test_db):
        """Test that poison pill tasks are marked FAILED after max retries."""
        file_db, task_db = test_db

        file_db.create_file("file-001", "test.mp3", "/tmp/test.mp3", 1024)
        task_db.enqueue("task-poison", "file-001", max_retries=2)

        # 1. First run -> Timeout
        task_db.dequeue("worker-001")
        task_db.requeue_timeout_tasks(timeout_seconds=0)
        task = task_db.get_task("task-poison")
        assert task["status"] == TaskStatus.PENDING.value
        assert task["retry_count"] == 1

        # 2. Second run -> Timeout
        task_db.dequeue("worker-001")
        task_db.requeue_timeout_tasks(timeout_seconds=0)
        task = task_db.get_task("task-poison")
        assert task["status"] == TaskStatus.PENDING.value
        assert task["retry_count"] == 2

        # 3. Third run -> Timeout (Max retries reached)
        task_db.dequeue("worker-001")
        count = task_db.requeue_timeout_tasks(timeout_seconds=0)

        # Should NOT requeue anymore, but mark as FAILED
        assert count == 0
        task = task_db.get_task("task-poison")
        assert task["status"] == TaskStatus.FAILED.value
        assert "max retries exceeded" in task["error"]
        assert task["completed_at"] is not None

    def test_list_tasks(self, test_db):
        """Test listing tasks with filtering."""
        file_db, task_db = test_db

        file_db.create_file("file-001", "test.mp3", "/tmp/test.mp3", 1024)

        # Create multiple tasks
        task_db.enqueue("task-001", "file-001")
        task_db.enqueue("task-002", "file-001")
        task_db.enqueue("task-003", "file-001")

        # Complete one task
        task_db.dequeue("worker-001")
        task_db.complete("task-001", [], 0.0)

        # List all tasks
        all_tasks = task_db.list_tasks()
        assert len(all_tasks) == 3

        # List pending tasks
        pending = task_db.list_tasks(status="pending")
        assert len(pending) == 2

        # List completed tasks
        completed = task_db.list_tasks(status="completed")
        assert len(completed) == 1
        assert completed[0]["id"] == "task-001"

        # Test pagination
        first_page = task_db.list_tasks(limit=2, offset=0)
        assert len(first_page) == 2

        second_page = task_db.list_tasks(limit=2, offset=2)
        assert len(second_page) == 1

    def test_count_tasks(self, test_db):
        """Test counting tasks with filtering."""
        file_db, task_db = test_db

        file_db.create_file("file-001", "test.mp3", "/tmp/test.mp3", 1024)

        # Create tasks
        task_db.enqueue("task-001", "file-001")
        task_db.enqueue("task-002", "file-001")

        # Count all
        assert task_db.count_tasks() == 2

        # Count pending
        assert task_db.count_tasks(status="pending") == 2

        # Complete one
        task_db.dequeue("worker-001")
        task_db.complete("task-001", [], 0.0)

        # Count by status
        assert task_db.count_tasks(status="pending") == 1
        assert task_db.count_tasks(status="completed") == 1

    def test_complete_cancelled_task(self, test_db):
        """complete() should not overwrite cancelled status."""
        file_db, task_db = test_db

        file_db.create_file("file-001", "test.mp3", "/tmp/test.mp3", 1024)
        task_db.enqueue("task-001", "file-001")
        task_db.dequeue("worker-001")
        task_db.cancel("task-001")

        result = task_db.complete("task-001", [{"text": "test"}], 10.0)

        assert result is False
        task = task_db.get_task("task-001")
        assert task["status"] == "cancelled"
        assert task["segments"] is None

    def test_fail_cancelled_task(self, test_db):
        """fail() should not overwrite cancelled status."""
        file_db, task_db = test_db

        file_db.create_file("file-001", "test.mp3", "/tmp/test.mp3", 1024)
        task_db.enqueue("task-001", "file-001")
        task_db.dequeue("worker-001")
        task_db.cancel("task-001")

        result = task_db.fail("task-001", "Some error")

        assert result is False
        task = task_db.get_task("task-001")
        assert task["status"] == "cancelled"

    def test_heartbeat_cancelled_task(self, test_db):
        """heartbeat() should not update cancelled task."""
        file_db, task_db = test_db

        file_db.create_file("file-001", "test.mp3", "/tmp/test.mp3", 1024)
        task_db.enqueue("task-001", "file-001")
        task_db.dequeue("worker-001")

        original = task_db.get_task("task-001")
        task_db.cancel("task-001")
        task_db.heartbeat("task-001", 50.0)

        task = task_db.get_task("task-001")
        assert task["status"] == "cancelled"
        assert task["progress"] == original["progress"]
        assert task["last_heartbeat"] == original["last_heartbeat"]

    def test_init_db_migrates_task_execution_columns(self):
        """init_db() should add execution columns to existing task tables."""
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "legacy.db"
            with closing(sqlite3.connect(db_path)) as conn:
                with conn:
                    conn.execute("""
                        CREATE TABLE files (
                            id TEXT PRIMARY KEY,
                            filename TEXT NOT NULL,
                            path TEXT NOT NULL,
                            size INTEGER NOT NULL,
                            content_type TEXT,
                            created_at TEXT NOT NULL
                        )
                    """)
                    conn.execute("""
                        CREATE TABLE transcription_tasks (
                            id TEXT PRIMARY KEY,
                            file_id TEXT NOT NULL,
                            status TEXT NOT NULL,
                            priority INTEGER DEFAULT 0,
                            retry_count INTEGER DEFAULT 0,
                            max_retries INTEGER DEFAULT 3,
                            worker_id TEXT,
                            started_at TEXT,
                            last_heartbeat TEXT,
                            timeout_seconds INTEGER DEFAULT 3600,
                            options TEXT,
                            progress REAL DEFAULT 0.0,
                            duration REAL,
                            segments TEXT,
                            error TEXT,
                            created_at TEXT NOT NULL,
                            completed_at TEXT,
                            FOREIGN KEY (file_id) REFERENCES files(id)
                        )
                    """)
                    conn.execute(
                        """
                        INSERT INTO files
                        (id, filename, path, size, content_type, created_at)
                        VALUES (?, ?, ?, ?, ?, ?)
                        """,
                        (
                            "legacy-file",
                            "legacy.wav",
                            "/tmp/legacy.wav",
                            100,
                            "audio/wav",
                            "2026-01-01T00:00:00",
                        ),
                    )
                    conn.execute(
                        """
                        INSERT INTO transcription_tasks
                        (id, file_id, status, created_at)
                        VALUES (?, ?, ?, ?)
                        """,
                        (
                            "legacy-task",
                            "legacy-file",
                            "pending",
                            "2026-01-01T00:00:00",
                        ),
                    )

            init_db(db_path)

            with closing(sqlite3.connect(db_path)) as conn:
                rows = conn.execute("PRAGMA table_info(transcription_tasks)").fetchall()
            columns = {row[1] for row in rows}
            task_db = TaskDatabase(db_path)
            task = task_db.get_task("legacy-task")

            assert {"model_id", "engine_device", "engine_compute_type"} <= columns
            assert task is not None
            assert task["model_id"] is None
            assert task["engine_device"] is None
            assert task["engine_compute_type"] is None
