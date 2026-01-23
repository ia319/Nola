"""Test production-grade task queue system."""

from nola.models import FileDatabase, TaskDatabase, TaskStatus, init_db

# Initialize database
print("Initializing database with enhanced schema...")
init_db()

# Test FileDatabase
print("\n=== FileDatabase Tests ===")
file_db = FileDatabase()
file_db.create_file("file-001", "test.mp3", "/tmp/test.mp3", 1024, "audio/mpeg")
assert file_db.get_file_path("file-001") == "/tmp/test.mp3"
print("✓ File operations work")

# Test production-grade TaskDatabase
print("\n=== Production Queue Tests ===")
task_db = TaskDatabase()

# Test 1: Enqueue with priority
print("\n1. Enqueue with priority...")
task_db.enqueue("task-low", "file-001", priority=0)
task_db.enqueue("task-high", "file-001", priority=10)
task_db.enqueue("task-mid", "file-001", priority=5)
print("✓ Enqueued 3 tasks with different priorities")

# Test 2: Atomic dequeue (should get highest priority)
print("\n2. Atomic dequeue...")
task = task_db.dequeue("worker-001")
assert task is not None
assert task["id"] == "task-high"  # Highest priority first
assert task["status"] == TaskStatus.PROCESSING.value
assert task["worker_id"] == "worker-001"
print(f"✓ Dequeued task: {task['id']} (priority={task['priority']})")

# Test 3: Heartbeat
print("\n3. Heartbeat...")
task_db.heartbeat("task-high", progress=50.0)
updated = task_db.get_task("task-high")
assert updated["progress"] == 50.0
print("✓ Heartbeat updated progress")

# Test 4: Complete task
print("\n4. Complete task...")
segments = [{"start": 0.0, "end": 2.5, "text": "Test"}]
task_db.complete("task-high", segments, 2.5)
completed = task_db.get_task("task-high")
assert completed["status"] == TaskStatus.COMPLETED.value
assert len(completed["segments"]) == 1
print("✓ Task completed successfully")

# Test 5: Fail with retry
print("\n5. Fail with retry...")
task2 = task_db.dequeue("worker-002")
assert task2["id"] == "task-mid"
task_db.fail("task-mid", "Test error", should_retry=True)
failed = task_db.get_task("task-mid")
assert failed["status"] == TaskStatus.PENDING.value  # Requeued for retry
assert failed["retry_count"] == 1
print("✓ Failed task requeued for retry")

# Test 6: Cancel task
print("\n6. Cancel task...")
cancelled = task_db.cancel("task-low")
assert cancelled is True
task = task_db.get_task("task-low")
assert task["status"] == TaskStatus.CANCELLED.value
print("✓ Task cancelled successfully")

# Test 7: Maintenance operations
print("\n7. Maintenance operations...")
# Requeue timeout tasks
requeued = task_db.requeue_timeout_tasks(timeout_seconds=0)
print(f"✓ Requeued {requeued} timeout tasks")

# Requeue dead workers
requeued = task_db.requeue_dead_workers(heartbeat_timeout=0)
print(f"✓ Requeued {requeued} dead worker tasks")

print("\n✅ All production-grade queue tests passed!")
