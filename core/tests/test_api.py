"""Pytest tests for API endpoints."""

import asyncio
import tempfile
from pathlib import Path
from unittest.mock import PropertyMock, patch

import pytest
from fastapi.testclient import TestClient

from nola.api.deps import get_app_config_db, get_file_db, get_task_db
from nola.api.routes import models as models_routes
from nola.config.constants import MAX_BATCH_TASK_IDS
from nola.config.settings import Settings
from nola.main import app
from nola.model_hub import DownloadProgress, require_model
from nola.models import init_db


def _claim_pending_task(task_db, expected_task_id: str) -> None:
    """Claim a queued task through the public queue API."""
    task = task_db.dequeue(worker_id="test-worker")
    assert task is not None
    assert task["id"] == expected_task_id


@pytest.fixture
def client():
    """Create test client with isolated database."""
    get_app_config_db.cache_clear()
    get_file_db.cache_clear()
    get_task_db.cache_clear()

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)
        db_path = tmp_path / "nola.db"
        upload_dir = tmp_path / "uploads"

        init_db(db_path)
        upload_dir.mkdir(parents=True, exist_ok=True)

        with (
            patch.object(
                Settings, "db_path", new_callable=PropertyMock, return_value=db_path
            ),
            patch.object(
                Settings,
                "upload_dir",
                new_callable=PropertyMock,
                return_value=upload_dir,
            ),
            patch("nola.main.init_db", lambda: None),
        ):
            with TestClient(app) as test_client:
                yield test_client

        get_app_config_db.cache_clear()
        get_file_db.cache_clear()
        get_task_db.cache_clear()


class TestHealthEndpoints:
    """Test health and info endpoints."""

    def test_health_check(self, client):
        """Test health endpoint returns ok status."""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert "version" in data

    def test_root(self, client):
        """Test root endpoint returns API info."""
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Nola Core"
        assert "version" in data


class TestFilesAPI:
    """Test file management endpoints."""

    def test_get_nonexistent_file(self, client):
        """Test getting a file that doesn't exist."""
        response = client.get("/api/files/nonexistent-id")
        assert response.status_code == 404

    def test_delete_nonexistent_file(self, client):
        """Test deleting a file that doesn't exist."""
        response = client.delete("/api/files/nonexistent-id")
        assert response.status_code == 404

    def test_delete_file_with_linked_tasks_returns_409(self, client):
        """Reject file deletion when task records still reference the file."""
        file_db = get_file_db()
        task_db = get_task_db()

        file_db.create_file(
            file_id="linked-file",
            filename="linked.mp3",
            path="/tmp/linked.mp3",
            size=1000,
        )
        task_db.enqueue(task_id="linked-task", file_id="linked-file", options=None)

        response = client.delete("/api/files/linked-file")

        assert response.status_code == 409
        assert response.json()["detail"] == (
            "Cannot delete file linked-file: 1 transcription task(s) still reference it"
        )
        assert file_db.get_file("linked-file") is not None

    def test_delete_file_returns_404_when_row_disappears_before_delete(self, client):
        """Return not found when a concurrent request already removed the row."""
        file_db = get_file_db()
        file_db.create_file(
            file_id="lost-delete-file",
            filename="lost.mp3",
            path="/tmp/lost.mp3",
            size=1000,
        )

        with (
            patch("nola.api.routes.files.get_file_db", return_value=file_db),
            patch.object(file_db, "delete_file", return_value=False),
        ):
            response = client.delete("/api/files/lost-delete-file")

        assert response.status_code == 404
        assert response.json()["detail"] == "File not found"


class TestTranscriptionsAPI:
    """Test transcription endpoints."""

    def test_list_transcriptions_empty(self, client):
        """Test listing transcriptions when none exist."""
        response = client.get("/api/transcription-tasks")
        assert response.status_code == 200
        data = response.json()
        assert data["tasks"] == []
        assert data["total"] == 0

    def test_get_nonexistent_task(self, client):
        """Test getting a task that doesn't exist."""
        response = client.get("/api/transcription-tasks/nonexistent-id")
        assert response.status_code == 404

    def test_cancel_nonexistent_task(self, client):
        """Test cancelling a task that doesn't exist."""
        response = client.delete("/api/transcription-tasks/nonexistent-id")
        assert response.status_code == 404

    def test_cancel_pending_task_returns_task_snapshot(self, client: TestClient):
        """Cancel should return the authoritative task snapshot."""
        file_db = get_file_db()
        task_db = get_task_db()
        file_db.create_file(
            file_id="cancel-file-1",
            filename="cancel-audio.mp3",
            path="/tmp/cancel-audio.mp3",
            size=1000,
        )
        task_db.enqueue(
            task_id="cancel-task-1",
            file_id="cancel-file-1",
            options=None,
            model_id="small",
        )
        response = client.delete("/api/transcription-tasks/cancel-task-1")
        assert response.status_code == 200
        data = response.json()
        assert data["task_id"] == "cancel-task-1"
        assert data["status"] == "cancelled"
        assert data["message"] == "Task cancelled successfully"
        assert data["task"]["task_id"] == "cancel-task-1"
        assert data["task"]["status"] == "cancelled"
        assert data["task"]["filename"] == "cancel-audio.mp3"
        assert data["task"]["model_id"] == "small"

    def test_cancel_already_cancelled_task_is_idempotent(self, client: TestClient):
        """Repeated cancel should be idempotent and still return cancelled task."""
        file_db = get_file_db()
        task_db = get_task_db()
        file_db.create_file(
            file_id="cancel-file-2",
            filename="already-cancelled.mp3",
            path="/tmp/already-cancelled.mp3",
            size=1000,
        )
        task_db.enqueue(task_id="cancel-task-2", file_id="cancel-file-2", options=None)
        task_db.cancel("cancel-task-2")

        response = client.delete("/api/transcription-tasks/cancel-task-2")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "cancelled"
        assert data["message"] == "Task already cancelled"
        assert data["task"]["status"] == "cancelled"

    def test_cancel_completed_task_returns_conflict(self, client: TestClient):
        """Cancel should return conflict when task already reached completed status."""
        file_db = get_file_db()
        task_db = get_task_db()
        file_db.create_file(
            file_id="cancel-file-3",
            filename="completed.mp3",
            path="/tmp/completed.mp3",
            size=1000,
        )
        task_db.enqueue(task_id="cancel-task-3", file_id="cancel-file-3", options=None)
        _claim_pending_task(task_db, "cancel-task-3")
        task_db.complete(
            task_id="cancel-task-3",
            segments=[{"start": 0.0, "end": 1.0, "text": "done"}],
            duration=1.0,
        )

        response = client.delete("/api/transcription-tasks/cancel-task-3")
        assert response.status_code == 409
        assert "Cannot cancel task with status: completed" in response.json()["detail"]

    def test_create_task_with_invalid_file_id(self, client):
        """Test creating task with non-existent file_id."""
        response = client.post(
            "/api/transcription-tasks",
            json={"file_id": "nonexistent-file"},
        )
        assert response.status_code == 404

    def test_create_task_with_options(self, client):
        """Test creating task with custom transcription options."""
        response = client.post(
            "/api/transcription-tasks",
            json={
                "file_id": "nonexistent-file",
                "language": "zh",
                "vad_filter": True,
                "beam_size": 3,
            },
        )
        # Should fail because file doesn't exist, not because of options
        assert response.status_code == 404

    def test_get_task_detail_exposes_reserved_model_id(self, client: TestClient):
        """Task detail should expose one persisted task-level model id."""
        file_db = get_file_db()
        task_db = get_task_db()
        file_db.create_file(
            file_id="task-detail-file",
            filename="detail-model.mp3",
            path="/tmp/detail-model.mp3",
            size=1000,
        )
        task_db.enqueue(
            task_id="task-detail-1",
            file_id="task-detail-file",
            options=None,
            model_id="large-v3",
        )

        response = client.get("/api/transcription-tasks/task-detail-1")

        assert response.status_code == 200
        data = response.json()
        assert data["task_id"] == "task-detail-1"
        assert data["model_id"] == "large-v3"

    def test_list_transcriptions_exposes_reserved_model_id(self, client: TestClient):
        """Task list should expose persisted task-level model ids."""
        file_db = get_file_db()
        task_db = get_task_db()
        file_db.create_file(
            file_id="task-list-file",
            filename="list-model.mp3",
            path="/tmp/list-model.mp3",
            size=1000,
        )
        task_db.enqueue(
            task_id="task-list-1",
            file_id="task-list-file",
            options=None,
            model_id="small",
        )

        response = client.get("/api/transcription-tasks")

        assert response.status_code == 200
        data = response.json()
        assert data["tasks"][0]["task_id"] == "task-list-1"
        assert data["tasks"][0]["model_id"] == "small"

    def test_create_task_persists_canonical_reserved_model_id(self, client: TestClient):
        """Task creation should store one canonical task-level model id."""
        file_db = get_file_db()
        task_db = get_task_db()
        file_db.create_file(
            file_id="task-model-file",
            filename="task-model.mp3",
            path="/tmp/task-model.mp3",
            size=1000,
        )

        response = client.post(
            "/api/transcription-tasks",
            json={"file_id": "task-model-file", "model_id": "large"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["model_id"] == "large-v3"

        stored = task_db.get_task(data["task_id"])
        assert stored is not None
        assert stored["model_id"] == "large-v3"


class TestModelsAPI:
    """Test model-management endpoints."""

    def test_model_responses_expose_description_keys(self, client: TestClient) -> None:
        """Expose stable i18n keys for list and detail model descriptions."""
        list_response = client.get("/api/models")
        assert list_response.status_code == 200

        list_item = next(
            item
            for item in list_response.json()["models"]
            if item["model_id"] == "large-v3"
        )
        assert list_item["description_key"] == "models.catalog.largeV3.description"

        detail_response = client.get("/api/models/large-v3")
        assert detail_response.status_code == 200
        assert (
            detail_response.json()["description_key"]
            == "models.catalog.largeV3.description"
        )

    def test_start_download_rejects_models_already_cached(
        self, client: TestClient
    ) -> None:
        """Do not start a second download when one model is already cached."""
        small_model = require_model("small")

        class _FakeStorage:
            def get_cache_state(self, repo_id: str) -> str:
                assert repo_id == small_model.repo_id
                return "downloaded"

        with (
            patch(
                "nola.api.routes.models.get_model_storage", return_value=_FakeStorage()
            ),
            patch("nola.api.routes.models.get_model_downloader") as get_downloader,
        ):
            response = client.post("/api/models/small/download")

        assert response.status_code == 409
        assert response.json()["detail"] == "Model already downloaded: small"
        get_downloader.assert_not_called()

    def test_start_download_openapi_declares_all_conflict_reasons(
        self, client: TestClient
    ) -> None:
        """OpenAPI should document both model download conflict states."""
        response = client.get("/openapi.json")
        assert response.status_code == 200
        schema = response.json()

        download_post = schema["paths"]["/api/models/{model_id}/download"]["post"]
        assert (
            download_post["responses"]["409"]["description"]
            == "Download already in progress or model already downloaded"
        )

    def test_list_active_model_downloads_reports_real_speed(
        self, client: TestClient
    ) -> None:
        """The downloads endpoint should expose live per-model and total speed."""

        class _FakeDownloader:
            def list_downloads(self) -> list[DownloadProgress]:
                return [
                    DownloadProgress(
                        model_id="small",
                        status="downloading",
                        downloaded_bytes=50,
                        total_bytes=200,
                        speed_bps=1250.4,
                    ),
                    DownloadProgress(
                        model_id="large-v3",
                        status="downloading",
                        downloaded_bytes=300,
                        total_bytes=600,
                        speed_bps=2048.9,
                    ),
                ]

        with patch(
            "nola.api.routes.models.get_model_downloader",
            return_value=_FakeDownloader(),
        ):
            response = client.get("/api/models/downloads")

        assert response.status_code == 200
        data = response.json()
        assert data["active_count"] == 2
        assert data["total_speed_bps"] == 3298
        assert data["downloads"] == [
            {
                "model_id": "small",
                "name": "Small",
                "status": "downloading",
                "percent": 25.0,
                "downloaded_bytes": 50,
                "total_bytes": 200,
                "speed_bps": 1250,
                "error": None,
            },
            {
                "model_id": "large-v3",
                "name": "Large V3",
                "status": "downloading",
                "percent": 50.0,
                "downloaded_bytes": 300,
                "total_bytes": 600,
                "speed_bps": 2048,
                "error": None,
            },
        ]

    def test_model_events_streams_progress_payload(self, client: TestClient) -> None:
        """The SSE endpoint should be reachable and stream progress events."""

        class _SingleEventBus:
            async def subscribe(self, channel: str):
                assert channel == "model_downloads"
                yield {"model_id": "small", "status": "downloading"}

        with patch(
            "nola.api.routes.models.get_event_bus",
            return_value=_SingleEventBus(),
        ):
            with client.stream("GET", "/api/models/events") as response:
                assert response.status_code == 200
                lines = list(response.iter_lines())

        assert lines[:2] == [
            "event: progress",
            'data: {"model_id": "small", "status": "downloading"}',
        ]

    def test_model_events_emits_keepalive_when_idle(self) -> None:
        """Idle SSE streams should emit keepalive comments before any progress."""

        class _IdleEventBus:
            async def subscribe(self, channel: str):
                assert channel == "model_downloads"
                while True:
                    await asyncio.sleep(3600)
                    yield {}

        class _ConnectedRequest:
            async def is_disconnected(self) -> bool:
                return False

        async def exercise() -> None:
            with (
                patch(
                    "nola.api.routes.models.get_event_bus",
                    return_value=_IdleEventBus(),
                ),
                patch(
                    "nola.api.routes.models._SSE_KEEPALIVE_INTERVAL_SECONDS",
                    0.01,
                ),
            ):
                response = await models_routes.model_events(_ConnectedRequest())
                first_chunk = await anext(response.body_iterator)

                assert first_chunk == ": keepalive\n\n"

                aclose = getattr(response.body_iterator, "aclose", None)
                if callable(aclose):
                    await aclose()

        asyncio.run(exercise())

    def test_patch_model_settings_rejects_dir_change_while_downloading(
        self, client: TestClient
    ) -> None:
        """Changing the cache root should fail while downloads are active."""

        class _FakeDownloader:
            def list_downloads(self) -> list[object]:
                return [object()]

        with patch(
            "nola.api.routes.models.get_model_downloader",
            return_value=_FakeDownloader(),
        ):
            response = client.patch(
                "/api/models/settings",
                json={
                    "configured_model_dir": str(
                        Path(tempfile.gettempdir()).resolve() / "nola-alt-models"
                    )
                },
            )

        assert response.status_code == 409
        assert (
            response.json()["detail"]
            == "Cannot change model directory while downloads are active. "
            "Cancel all downloads first."
        )

    def test_model_events_openapi_declares_only_sse_success(
        self, client: TestClient
    ) -> None:
        """OpenAPI should expose only the SSE success content type for model events."""
        response = client.get("/openapi.json")
        assert response.status_code == 200
        schema = response.json()

        events_get = schema["paths"]["/api/models/events"]["get"]
        events_content = events_get["responses"]["200"]["content"]
        assert events_content == {"text/event-stream": {}}

    def test_model_events_closes_subscription_after_disconnect(self) -> None:
        """SSE subscription should close promptly after the client disconnects."""
        state = {"closed": False, "checks": 0}

        class _DisconnectingRequest:
            async def is_disconnected(self) -> bool:
                state["checks"] += 1
                return True

        class _TrackedSubscription:
            def __aiter__(self):
                return self

            async def __anext__(self) -> dict[str, str]:
                raise StopAsyncIteration

            async def aclose(self) -> None:
                state["closed"] = True

        class _TrackedEventBus:
            def subscribe(self, channel: str) -> _TrackedSubscription:
                assert channel == "model_downloads"
                return _TrackedSubscription()

        async def exercise() -> None:
            with patch(
                "nola.api.routes.models.get_event_bus",
                return_value=_TrackedEventBus(),
            ):
                response = await models_routes.model_events(_DisconnectingRequest())
                chunks = [chunk async for chunk in response.body_iterator]

            assert chunks == []
            assert state["checks"] >= 1
            assert state["closed"] is True

        asyncio.run(exercise())

    def test_patch_model_settings_openapi_declares_conflict_response(
        self, client: TestClient
    ) -> None:
        """OpenAPI should document the active-download conflict for settings updates."""
        response = client.get("/openapi.json")
        assert response.status_code == 200
        schema = response.json()

        patch_operation = schema["paths"]["/api/models/settings"]["patch"]
        conflict = patch_operation["responses"]["409"]
        assert conflict["description"] == "Downloads active for current model directory"
        conflict_content = conflict["content"]["application/json"]
        detail_schema = conflict_content["schema"]
        assert detail_schema == {"$ref": "#/components/schemas/DetailResponse"}


class TestTranscriptionTasksPhaseA:
    """Test task list, batch action, and delete-record endpoints."""

    def test_legacy_list_alias_is_removed(self, client: TestClient):
        """Legacy /api/transcriptions list path should not be exposed."""
        response = client.get("/api/transcriptions")
        assert response.status_code == 404

    def test_list_supports_filename_keyword_search(self, client: TestClient):
        """List endpoint should filter tasks by filename keyword."""
        file_db = get_file_db()
        task_db = get_task_db()

        file_db.create_file(
            file_id="search-file-1",
            filename="meeting-alpha.mp3",
            path="/tmp/meeting-alpha.mp3",
            size=1000,
        )
        file_db.create_file(
            file_id="search-file-2",
            filename="lecture-beta.mp3",
            path="/tmp/lecture-beta.mp3",
            size=1000,
        )
        task_db.enqueue(task_id="search-task-1", file_id="search-file-1", options=None)
        task_db.enqueue(task_id="search-task-2", file_id="search-file-2", options=None)

        response = client.get("/api/transcription-tasks?q=meeting")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["tasks"][0]["task_id"] == "search-task-1"
        assert data["tasks"][0]["filename"] == "meeting-alpha.mp3"

    def test_list_search_escapes_like_wildcards(self, client: TestClient):
        """List search should treat % and _ as literal characters."""
        file_db = get_file_db()
        task_db = get_task_db()

        file_db.create_file(
            file_id="wildcard-file-1",
            filename="episode_01.mp3",
            path="/tmp/episode_01.mp3",
            size=1000,
        )
        file_db.create_file(
            file_id="wildcard-file-2",
            filename="episodeA01.mp3",
            path="/tmp/episodeA01.mp3",
            size=1000,
        )
        file_db.create_file(
            file_id="wildcard-file-3",
            filename="ratio-100%.mp3",
            path="/tmp/ratio-100%.mp3",
            size=1000,
        )
        file_db.create_file(
            file_id="wildcard-file-4",
            filename="ratio-100x.mp3",
            path="/tmp/ratio-100x.mp3",
            size=1000,
        )

        task_db.enqueue(
            task_id="wildcard-task-1", file_id="wildcard-file-1", options=None
        )
        task_db.enqueue(
            task_id="wildcard-task-2", file_id="wildcard-file-2", options=None
        )
        task_db.enqueue(
            task_id="wildcard-task-3", file_id="wildcard-file-3", options=None
        )
        task_db.enqueue(
            task_id="wildcard-task-4", file_id="wildcard-file-4", options=None
        )

        underscore_response = client.get(
            "/api/transcription-tasks",
            params={"q": "episode_01"},
        )
        assert underscore_response.status_code == 200
        underscore_payload = underscore_response.json()
        assert underscore_payload["total"] == 1
        assert underscore_payload["tasks"][0]["task_id"] == "wildcard-task-1"

        percent_response = client.get(
            "/api/transcription-tasks",
            params={"q": "100%"},
        )
        assert percent_response.status_code == 200
        percent_payload = percent_response.json()
        assert percent_payload["total"] == 1
        assert percent_payload["tasks"][0]["task_id"] == "wildcard-task-3"

    def test_get_task_detail_includes_filename(self, client: TestClient):
        """Task detail endpoint should include filename for display use."""
        file_db = get_file_db()
        task_db = get_task_db()

        file_db.create_file(
            file_id="detail-file-1",
            filename="detail-audio.mp3",
            path="/tmp/detail-audio.mp3",
            size=1000,
        )
        task_db.enqueue(task_id="detail-task-1", file_id="detail-file-1", options=None)

        response = client.get("/api/transcription-tasks/detail-task-1")
        assert response.status_code == 200
        assert response.json()["filename"] == "detail-audio.mp3"

    def test_list_supports_sort_order(self, client: TestClient):
        """List endpoint should apply sort_by and order parameters."""
        file_db = get_file_db()
        task_db = get_task_db()

        file_db.create_file(
            file_id="sort-file-1",
            filename="sort-a.mp3",
            path="/tmp/sort-a.mp3",
            size=1000,
        )
        file_db.create_file(
            file_id="sort-file-2",
            filename="sort-b.mp3",
            path="/tmp/sort-b.mp3",
            size=1000,
        )
        task_db.enqueue(task_id="sort-task-1", file_id="sort-file-1", options=None)
        task_db.enqueue(task_id="sort-task-2", file_id="sort-file-2", options=None)

        response = client.get(
            "/api/transcription-tasks?sort_by=created_at&order=asc&limit=2"
        )
        assert response.status_code == 200
        tasks = response.json()["tasks"]
        assert len(tasks) == 2
        assert {tasks[0]["task_id"], tasks[1]["task_id"]} == {
            "sort-task-1",
            "sort-task-2",
        }

        first_created_at = tasks[0]["created_at"]
        second_created_at = tasks[1]["created_at"]
        assert first_created_at <= second_created_at
        if first_created_at == second_created_at:
            # list_tasks() uses task_id DESC as the deterministic tie-breaker.
            assert tasks[0]["task_id"] > tasks[1]["task_id"]

    def test_list_supports_filename_sort(self, client: TestClient):
        """List endpoint should support sort_by=filename."""
        file_db = get_file_db()
        task_db = get_task_db()

        file_db.create_file(
            file_id="filename-sort-file-1",
            filename="zeta.mp3",
            path="/tmp/zeta.mp3",
            size=1000,
        )
        file_db.create_file(
            file_id="filename-sort-file-2",
            filename="alpha.mp3",
            path="/tmp/alpha.mp3",
            size=1000,
        )
        task_db.enqueue(
            task_id="filename-sort-task-1",
            file_id="filename-sort-file-1",
            options=None,
        )
        task_db.enqueue(
            task_id="filename-sort-task-2",
            file_id="filename-sort-file-2",
            options=None,
        )

        response = client.get(
            "/api/transcription-tasks?sort_by=filename&order=asc&limit=2"
        )
        assert response.status_code == 200
        tasks = response.json()["tasks"]
        assert [task["filename"] for task in tasks] == ["alpha.mp3", "zeta.mp3"]

    def test_batch_cancel_returns_mixed_outcomes(self, client: TestClient):
        """Batch cancel should return per-item outcomes and summary counts."""
        file_db = get_file_db()
        task_db = get_task_db()

        file_db.create_file(
            file_id="batch-cancel-file-pending",
            filename="pending.mp3",
            path="/tmp/pending.mp3",
            size=1000,
        )
        file_db.create_file(
            file_id="batch-cancel-file-completed",
            filename="completed.mp3",
            path="/tmp/completed.mp3",
            size=1000,
        )
        task_db.enqueue(
            task_id="batch-cancel-completed",
            file_id="batch-cancel-file-completed",
            options=None,
        )
        task_db.enqueue(
            task_id="batch-cancel-pending",
            file_id="batch-cancel-file-pending",
            options=None,
        )
        _claim_pending_task(task_db, "batch-cancel-completed")
        task_db.complete(
            task_id="batch-cancel-completed",
            segments=[{"start": 0.0, "end": 1.0, "text": "done"}],
            duration=1.0,
        )

        response = client.post(
            "/api/transcription-tasks/batch/cancel",
            json={
                "task_ids": [
                    "batch-cancel-pending",
                    "batch-cancel-completed",
                    "batch-cancel-missing",
                    "batch-cancel-pending",
                ]
            },
        )
        assert response.status_code == 200
        payload = response.json()
        assert payload["action"] == "cancel"
        assert payload["summary"] == {"requested": 4, "succeeded": 1, "failed": 3}

        results = payload["results"]
        assert results[0]["task_id"] == "batch-cancel-pending"
        assert results[0]["ok"] is True
        assert results[0]["status"] == "cancelled"

        assert results[1]["task_id"] == "batch-cancel-completed"
        assert results[1]["ok"] is False
        assert results[1]["error_code"] == "invalid_status"

        assert results[2]["task_id"] == "batch-cancel-missing"
        assert results[2]["ok"] is False
        assert results[2]["error_code"] == "not_found"

        assert results[3]["task_id"] == "batch-cancel-pending"
        assert results[3]["ok"] is False
        assert results[3]["error_code"] == "duplicate_task_id"

        pending_task = task_db.get_task("batch-cancel-pending")
        assert pending_task is not None
        assert pending_task["status"] == "cancelled"

    def test_batch_retry_returns_mixed_outcomes(self, client: TestClient):
        """Batch retry should create new tasks for retryable statuses."""
        file_db = get_file_db()
        task_db = get_task_db()

        file_db.create_file(
            file_id="batch-retry-file-failed",
            filename="failed.mp3",
            path="/tmp/failed.mp3",
            size=1000,
        )
        file_db.create_file(
            file_id="batch-retry-file-cancelled",
            filename="cancelled.mp3",
            path="/tmp/cancelled.mp3",
            size=1000,
        )
        file_db.create_file(
            file_id="batch-retry-file-pending",
            filename="pending.mp3",
            path="/tmp/pending.mp3",
            size=1000,
        )

        task_db.enqueue(
            task_id="batch-retry-failed",
            file_id="batch-retry-file-failed",
            options={"language": "zh"},
        )
        _claim_pending_task(task_db, "batch-retry-failed")
        task_db.fail(
            task_id="batch-retry-failed",
            error="forced failure",
            should_retry=False,
        )

        task_db.enqueue(
            task_id="batch-retry-cancelled",
            file_id="batch-retry-file-cancelled",
            options=None,
        )
        task_db.cancel("batch-retry-cancelled")

        task_db.enqueue(
            task_id="batch-retry-pending",
            file_id="batch-retry-file-pending",
            options=None,
        )

        response = client.post(
            "/api/transcription-tasks/batch/retry",
            json={
                "task_ids": [
                    "batch-retry-failed",
                    "batch-retry-cancelled",
                    "batch-retry-pending",
                    "batch-retry-missing",
                    "batch-retry-failed",
                ]
            },
        )
        assert response.status_code == 200
        payload = response.json()
        assert payload["action"] == "retry"
        assert payload["summary"] == {"requested": 5, "succeeded": 2, "failed": 3}

        results = payload["results"]
        success_results = [item for item in results if item["ok"]]
        assert len(success_results) == 2
        for item in success_results:
            assert item["new_task_id"]
            created_task = task_db.get_task(item["new_task_id"])
            assert created_task is not None
            assert created_task["status"] == "pending"

        pending_result = next(
            item for item in results if item["task_id"] == "batch-retry-pending"
        )
        assert pending_result["ok"] is False
        assert pending_result["error_code"] == "invalid_status"

        missing_result = next(
            item for item in results if item["task_id"] == "batch-retry-missing"
        )
        assert missing_result["ok"] is False
        assert missing_result["error_code"] == "not_found"

        duplicate_result = results[-1]
        assert duplicate_result["task_id"] == "batch-retry-failed"
        assert duplicate_result["ok"] is False
        assert duplicate_result["error_code"] == "duplicate_task_id"

    def test_legacy_batch_cancel_alias_is_removed(self, client: TestClient):
        """Legacy batch-cancel path should not be exposed."""
        response = client.post(
            "/api/transcriptions/batch/cancel",
            json={"task_ids": ["some-task-id"]},
        )
        assert response.status_code == 404

    def test_delete_record_rejects_non_terminal_task(self, client: TestClient):
        """Delete-record endpoint should reject pending/processing tasks."""
        file_db = get_file_db()
        task_db = get_task_db()
        file_db.create_file(
            file_id="delete-pending-file",
            filename="pending.mp3",
            path="/tmp/pending.mp3",
            size=1000,
        )
        task_db.enqueue(
            task_id="delete-pending-task",
            file_id="delete-pending-file",
            options=None,
        )

        response = client.delete("/api/transcription-tasks/delete-pending-task/record")
        assert response.status_code == 400
        assert "Only terminal tasks can be deleted" in response.json()["detail"]

    def test_delete_record_removes_terminal_task(self, client: TestClient):
        """Delete-record endpoint should remove completed tasks."""
        file_db = get_file_db()
        task_db = get_task_db()
        file_db.create_file(
            file_id="delete-completed-file",
            filename="completed.mp3",
            path="/tmp/completed.mp3",
            size=1000,
        )
        task_db.enqueue(
            task_id="delete-completed-task",
            file_id="delete-completed-file",
            options=None,
        )
        _claim_pending_task(task_db, "delete-completed-task")
        task_db.complete(
            task_id="delete-completed-task",
            segments=[{"start": 0.0, "end": 1.0, "text": "done"}],
            duration=1.0,
        )

        response = client.delete(
            "/api/transcription-tasks/delete-completed-task/record"
        )
        assert response.status_code == 200
        assert response.json()["task_id"] == "delete-completed-task"

        get_response = client.get("/api/transcription-tasks/delete-completed-task")
        assert get_response.status_code == 404

    def test_legacy_delete_record_alias_is_removed(self, client: TestClient):
        """Legacy delete-record path should not be exposed."""
        response = client.delete("/api/transcriptions/some-task-id/record")
        assert response.status_code == 404


class TestInputValidation:
    """Test API input validation behavior."""

    def test_language_uppercase_code_is_normalized(self, client: TestClient):
        """Test uppercase language code is accepted and normalized."""
        file_db = get_file_db()
        file_db.create_file(
            file_id="uppercase-lang-file",
            filename="audio.mp3",
            path="/tmp/audio.mp3",
            size=1000,
        )

        response = client.post(
            "/api/transcription-tasks",
            json={"file_id": "uppercase-lang-file", "language": "EN"},
        )

        assert response.status_code == 200
        assert response.json()["options"]["language"] == "en"

    def test_language_invalid_code_returns_422(self, client: TestClient):
        """Test unsupported language code returns 422."""
        response = client.post(
            "/api/transcription-tasks",
            json={"file_id": "nonexistent-file", "language": "chinese"},
        )

        assert response.status_code == 422
        details = response.json()["detail"]
        assert any(item["loc"][-1] == "language" for item in details)
        assert "Unsupported language" in str(details)

    def test_language_locale_style_returns_422(self, client: TestClient):
        """Test locale-style language code returns 422."""
        response = client.post(
            "/api/transcription-tasks",
            json={"file_id": "nonexistent-file", "language": "zh-CN"},
        )

        assert response.status_code == 422
        details = response.json()["detail"]
        assert any(item["loc"][-1] == "language" for item in details)
        assert "Unsupported language" in str(details)

    def test_language_valid_code_passes_schema_validation(self, client: TestClient):
        """Test valid ISO 639-1 code reaches business logic layer."""
        response = client.post(
            "/api/transcription-tasks",
            json={"file_id": "nonexistent-file", "language": "zh"},
        )

        assert response.status_code == 404
        assert "File not found" in response.json()["detail"]

    def test_language_none_passes_schema_validation(self, client: TestClient):
        """Test null language reaches business logic layer."""
        response = client.post(
            "/api/transcription-tasks",
            json={"file_id": "nonexistent-file", "language": None},
        )

        assert response.status_code == 404
        assert "File not found" in response.json()["detail"]

    def test_temperature_negative_returns_422(self, client: TestClient):
        """Test negative temperature is rejected."""
        response = client.post(
            "/api/transcription-tasks",
            json={"file_id": "nonexistent-file", "temperature": -0.1},
        )

        assert response.status_code == 422
        details = response.json()["detail"]
        assert any(item["loc"][-1] == "temperature" for item in details)
        assert "non-negative" in str(details)

    def test_temperature_list_with_negative_returns_422(self, client: TestClient):
        """Test negative element in temperature list is rejected."""
        response = client.post(
            "/api/transcription-tasks",
            json={"file_id": "nonexistent-file", "temperature": [0.0, -0.2]},
        )

        assert response.status_code == 422
        details = response.json()["detail"]
        assert any(item["loc"][-1] == "temperature" for item in details)
        assert "non-negative" in str(details)

    def test_vad_parameters_unknown_key_returns_422(self, client: TestClient):
        """Test unknown nested VAD key is rejected at request validation."""
        response = client.post(
            "/api/transcription-tasks",
            json={
                "file_id": "nonexistent-file",
                "vad_filter": True,
                "vad_parameters": {"threshld": 0.6},
            },
        )

        assert response.status_code == 422
        details = response.json()["detail"]
        assert any(item["loc"][-1] == "vad_parameters" for item in details)
        assert "Unsupported vad_parameters key(s): threshld" in str(details)

    def test_vad_parameters_out_of_range_value_returns_422(self, client: TestClient):
        """Test out-of-range nested VAD value is rejected at request validation."""
        response = client.post(
            "/api/transcription-tasks",
            json={
                "file_id": "nonexistent-file",
                "vad_filter": True,
                "vad_parameters": {"threshold": 1.1},
            },
        )

        assert response.status_code == 422
        details = response.json()["detail"]
        assert any(item["loc"][-1] == "threshold" for item in details)

    def test_language_detection_segments_zero_returns_422(self, client: TestClient):
        """Test zero language_detection_segments is rejected."""
        response = client.post(
            "/api/transcription-tasks",
            json={
                "file_id": "nonexistent-file",
                "language_detection_segments": 0,
            },
        )

        assert response.status_code == 422
        details = response.json()["detail"]
        assert any(item["loc"][-1] == "language_detection_segments" for item in details)

    def test_unknown_top_level_option_key_returns_422(self, client: TestClient):
        """Test unknown top-level options are rejected instead of ignored."""
        response = client.post(
            "/api/transcription-tasks",
            json={"file_id": "nonexistent-file", "beam_sizee": 3},
        )

        assert response.status_code == 422
        details = response.json()["detail"]
        assert any(item["loc"][-1] == "beam_sizee" for item in details)

    def test_batch_export_empty_task_ids_returns_422(self, client: TestClient):
        """Test batch export rejects empty task_ids."""
        response = client.post(
            "/api/transcription-tasks/export/batch",
            json={"task_ids": [], "format": "srt"},
        )

        assert response.status_code == 422
        details = response.json()["detail"]
        assert any(item["loc"][-1] == "task_ids" for item in details)

    def test_batch_export_task_ids_exceed_max_returns_422(self, client: TestClient):
        """Test batch export rejects task_ids longer than max length."""
        task_ids = [f"task-{i}" for i in range(MAX_BATCH_TASK_IDS + 1)]
        response = client.post(
            "/api/transcription-tasks/export/batch",
            json={"task_ids": task_ids, "format": "srt"},
        )

        assert response.status_code == 422
        details = response.json()["detail"]
        assert any(item["loc"][-1] == "task_ids" for item in details)


class TestFilesAPIExtended:
    """Test new file management endpoints."""

    def test_list_files_empty(self, client):
        """Test listing files when none exist."""
        response = client.get("/api/files/")
        assert response.status_code == 200
        data = response.json()
        assert data["files"] == []
        assert data["total"] == 0
        assert data["limit"] == 50
        assert data["offset"] == 0

    def test_list_files_with_pagination(self, client):
        """Test listing files with pagination parameters."""
        response = client.get("/api/files/?limit=10&offset=5")
        assert response.status_code == 200
        data = response.json()
        assert data["limit"] == 10
        assert data["offset"] == 5

    def test_check_integrity_empty(self, client):
        """Test integrity check when no files exist."""
        response = client.get("/api/files/check-integrity")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["missing_files"] == []
        assert data["missing_count"] == 0

    def test_cleanup_empty(self, client):
        """Test cleanup when no orphan records exist."""
        response = client.post("/api/files/cleanup")
        assert response.status_code == 200
        data = response.json()
        assert data["deleted_count"] == 0


class TestExportAPI:
    """Test transcription export endpoints."""

    def test_export_nonexistent_task(self, client):
        """Test exporting a task that doesn't exist."""
        response = client.get("/api/transcription-tasks/nonexistent-id/export")
        assert response.status_code == 404

    def test_export_uncompleted_task(self, client):
        """Test exporting a task that is not completed."""
        file_db = get_file_db()
        task_db = get_task_db()
        file_db.create_file(
            file_id="test-file",
            filename="test.mp3",
            path="/tmp/test.mp3",
            size=1000,
        )
        task_db.enqueue(task_id="test-task", file_id="test-file", options=None)

        response = client.get("/api/transcription-tasks/test-task/export")
        assert response.status_code == 400
        assert "not completed" in response.json()["detail"]

    def test_export_srt_format(self, client):
        """Test exporting as SRT format."""
        file_db = get_file_db()
        task_db = get_task_db()
        file_db.create_file(
            file_id="test-file-srt",
            filename="audio.mp3",
            path="/tmp/audio.mp3",
            size=1000,
        )
        task_db.enqueue(task_id="test-task-srt", file_id="test-file-srt", options=None)
        _claim_pending_task(task_db, "test-task-srt")
        task_db.complete(
            task_id="test-task-srt",
            segments=[
                {"start": 0.0, "end": 2.5, "text": "Hello world"},
                {"start": 2.5, "end": 5.0, "text": "Test subtitle"},
            ],
            duration=5.0,
        )

        response = client.get(
            "/api/transcription-tasks/test-task-srt/export?format=srt"
        )
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("application/x-subrip")
        content = response.text
        assert "00:00:00,000 --> 00:00:02,500" in content
        assert "Hello world" in content

    def test_export_vtt_format(self, client):
        """Test exporting as VTT format."""
        file_db = get_file_db()
        task_db = get_task_db()
        file_db.create_file(
            file_id="test-file-vtt",
            filename="audio.mp3",
            path="/tmp/audio.mp3",
            size=1000,
        )
        task_db.enqueue(task_id="test-vtt", file_id="test-file-vtt", options=None)
        _claim_pending_task(task_db, "test-vtt")
        task_db.complete(
            task_id="test-vtt",
            segments=[{"start": 0.0, "end": 1.0, "text": "VTT test"}],
            duration=1.0,
        )

        response = client.get("/api/transcription-tasks/test-vtt/export?format=vtt")
        assert response.status_code == 200
        assert "text/vtt" in response.headers["content-type"]
        assert response.text.startswith("WEBVTT")

    def test_export_txt_without_timestamps(self, client):
        """Test exporting as TXT without timestamps."""
        file_db = get_file_db()
        task_db = get_task_db()
        file_db.create_file(
            file_id="test-file-txt",
            filename="audio.mp3",
            path="/tmp/audio.mp3",
            size=1000,
        )
        task_db.enqueue(task_id="test-txt", file_id="test-file-txt", options=None)
        _claim_pending_task(task_db, "test-txt")
        task_db.complete(
            task_id="test-txt",
            segments=[{"start": 0.0, "end": 1.0, "text": "Plain text"}],
            duration=1.0,
        )

        response = client.get(
            "/api/transcription-tasks/test-txt/export?format=txt&include_timestamps=false"
        )
        assert response.status_code == 200
        assert response.text == "Plain text"
        assert "[" not in response.text

    def test_export_ass_format(self, client):
        """Test exporting as ASS format."""
        file_db = get_file_db()
        task_db = get_task_db()
        file_db.create_file(
            file_id="test-file-ass",
            filename="audio.mp3",
            path="/tmp/audio.mp3",
            size=1000,
        )
        task_db.enqueue(task_id="test-ass", file_id="test-file-ass", options=None)
        _claim_pending_task(task_db, "test-ass")
        task_db.complete(
            task_id="test-ass",
            segments=[{"start": 0.0, "end": 1.0, "text": "ASS test"}],
            duration=1.0,
        )

        response = client.get("/api/transcription-tasks/test-ass/export?format=ass")
        assert response.status_code == 200
        assert "[Script Info]" in response.text
        assert "Dialogue:" in response.text

    def test_export_invalid_segment_shape_returns_400(self, client):
        """Treat malformed persisted segment shape as no segments available."""
        file_db = get_file_db()
        task_db = get_task_db()
        file_db.create_file(
            file_id="test-file-invalid-segment",
            filename="invalid.mp3",
            path="/tmp/invalid.mp3",
            size=1000,
        )
        task_db.enqueue(
            task_id="test-invalid-segment",
            file_id="test-file-invalid-segment",
            options=None,
        )
        _claim_pending_task(task_db, "test-invalid-segment")
        task_db.complete(
            task_id="test-invalid-segment",
            segments=[None],
            duration=1.0,
        )

        response = client.get(
            "/api/transcription-tasks/test-invalid-segment/export?format=srt"
        )
        assert response.status_code == 400
        detail = response.json()["detail"]
        assert detail == "No segments available"

    def test_export_formatter_error_returns_controlled_500(self, client: TestClient):
        """Map formatter resolution errors to TaskUseCaseError-based responses."""
        file_db = get_file_db()
        task_db = get_task_db()
        file_db.create_file(
            file_id="test-file-export-formatter-error",
            filename="error.mp3",
            path="/tmp/error.mp3",
            size=1000,
        )
        task_db.enqueue(
            task_id="test-export-formatter-error",
            file_id="test-file-export-formatter-error",
            options=None,
        )
        _claim_pending_task(task_db, "test-export-formatter-error")
        task_db.complete(
            task_id="test-export-formatter-error",
            segments=[{"start": 0.0, "end": 1.0, "text": "Formatter error"}],
            duration=1.0,
        )

        with patch(
            "nola.application.tasks.exports.export_task.get_formatter",
            side_effect=ValueError("boom"),
        ):
            response = client.get(
                "/api/transcription-tasks/test-export-formatter-error/export?format=srt"
            )

        assert response.status_code == 500
        assert response.json()["detail"] == "Invalid export formatter configuration"

    def test_export_save_to_disk(self, client):
        """Test exporting with save=true returns JSON with file path."""
        file_db = get_file_db()
        task_db = get_task_db()
        file_db.create_file(
            file_id="test-file-save",
            filename="audio.mp3",
            path="/tmp/audio.mp3",
            size=1000,
        )
        task_db.enqueue(task_id="test-save", file_id="test-file-save", options=None)
        _claim_pending_task(task_db, "test-save")
        task_db.complete(
            task_id="test-save",
            segments=[{"start": 0.0, "end": 1.0, "text": "Save test"}],
            duration=1.0,
        )

        with tempfile.TemporaryDirectory() as tmpdir:
            exports_path = Path(tmpdir) / "exports"
            with patch.object(
                Settings,
                "exports_dir",
                new_callable=PropertyMock,
                return_value=exports_path,
            ):
                response = client.get(
                    "/api/transcription-tasks/test-save/export?format=srt&save=true"
                )
                assert response.status_code == 200
                data = response.json()
                assert "saved_path" in data
                assert data["saved_path"].endswith(".srt")

    def test_export_save_io_failure_returns_controlled_500(self, client: TestClient):
        """Map save-path I/O failures to controlled API responses."""
        file_db = get_file_db()
        task_db = get_task_db()
        file_db.create_file(
            file_id="test-file-save-io-failure",
            filename="audio.mp3",
            path="/tmp/audio.mp3",
            size=1000,
        )
        task_db.enqueue(
            task_id="test-save-io-failure",
            file_id="test-file-save-io-failure",
            options=None,
        )
        _claim_pending_task(task_db, "test-save-io-failure")
        task_db.complete(
            task_id="test-save-io-failure",
            segments=[{"start": 0.0, "end": 1.0, "text": "Save failure"}],
            duration=1.0,
        )

        with tempfile.TemporaryDirectory() as tmpdir:
            exports_path = Path(tmpdir) / "exports"
            with (
                patch.object(
                    Settings,
                    "exports_dir",
                    new_callable=PropertyMock,
                    return_value=exports_path,
                ),
                patch(
                    "nola.application.tasks.exports.export_task.write_unique_export_text",
                    side_effect=OSError("disk full"),
                ),
            ):
                response = client.get(
                    "/api/transcription-tasks/test-save-io-failure/export"
                    "?format=srt&save=true"
                )

        assert response.status_code == 500
        assert response.json()["detail"] == "Failed to save export file"

    def test_export_allows_custom_single_filename(self, client: TestClient):
        """Single export should accept a custom filename and normalize extension."""
        file_db = get_file_db()
        task_db = get_task_db()
        file_db.create_file(
            file_id="test-file-custom-name",
            filename="meeting.mp3",
            path="/tmp/meeting.mp3",
            size=1000,
        )
        task_db.enqueue(
            task_id="test-custom-name",
            file_id="test-file-custom-name",
            options=None,
        )
        _claim_pending_task(task_db, "test-custom-name")
        task_db.complete(
            task_id="test-custom-name",
            segments=[{"start": 0.0, "end": 1.0, "text": "Custom filename"}],
            duration=1.0,
        )

        response = client.get(
            "/api/transcription-tasks/test-custom-name/export",
            params={"format": "srt", "filename": "Weekly Notes.vtt"},
        )

        assert response.status_code == 200
        content_disposition = response.headers["content-disposition"]
        assert 'filename="Weekly_Notes.srt"' in content_disposition
        assert "filename*=UTF-8''Weekly%20Notes.srt" in content_disposition

    def test_export_save_avoids_overwriting_existing_file(self, client: TestClient):
        """save=true should append a suffix when target filename already exists."""
        file_db = get_file_db()
        task_db = get_task_db()
        file_db.create_file(
            file_id="test-file-save-unique",
            filename="unique.mp3",
            path="/tmp/unique.mp3",
            size=1000,
        )
        task_db.enqueue(
            task_id="test-save-unique",
            file_id="test-file-save-unique",
            options=None,
        )
        _claim_pending_task(task_db, "test-save-unique")
        task_db.complete(
            task_id="test-save-unique",
            segments=[{"start": 0.0, "end": 1.0, "text": "Unique save"}],
            duration=1.0,
        )

        with tempfile.TemporaryDirectory() as tmpdir:
            exports_path = Path(tmpdir) / "exports"
            with patch.object(
                Settings,
                "exports_dir",
                new_callable=PropertyMock,
                return_value=exports_path,
            ):
                first = client.get(
                    "/api/transcription-tasks/test-save-unique/export",
                    params={
                        "format": "srt",
                        "save": "true",
                        "filename": "meeting-notes",
                    },
                )
                second = client.get(
                    "/api/transcription-tasks/test-save-unique/export",
                    params={
                        "format": "srt",
                        "save": "true",
                        "filename": "meeting-notes",
                    },
                )

                assert first.status_code == 200
                assert second.status_code == 200

                first_path = first.json()["saved_path"]
                second_path = second.json()["saved_path"]
                assert first_path == "exports/meeting-notes.srt"
                assert second_path == "exports/meeting-notes_1.srt"

                assert (exports_path / "meeting-notes.srt").exists()
                assert (exports_path / "meeting-notes_1.srt").exists()

    def test_export_uses_persisted_defaults_when_params_omitted(self, client):
        """Export should apply persisted defaults when query params are omitted."""
        file_db = get_file_db()
        task_db = get_task_db()
        file_db.create_file(
            file_id="test-file-default-single",
            filename="audio.mp3",
            path="/tmp/audio.mp3",
            size=1000,
        )
        task_db.enqueue(
            task_id="test-default-single",
            file_id="test-file-default-single",
            options=None,
        )
        _claim_pending_task(task_db, "test-default-single")
        task_db.complete(
            task_id="test-default-single",
            segments=[{"start": 0.0, "end": 1.0, "text": "Configured default text"}],
            duration=1.0,
        )

        patch_response = client.patch(
            "/api/config/export/defaults",
            json={"format": "txt", "include_timestamps": False},
        )
        assert patch_response.status_code == 200

        response = client.get("/api/transcription-tasks/test-default-single/export")
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/plain")
        assert response.text == "Configured default text"

    def test_export_request_params_override_persisted_defaults(self, client):
        """Explicit request values should override persisted defaults."""
        file_db = get_file_db()
        task_db = get_task_db()
        file_db.create_file(
            file_id="test-file-default-override",
            filename="audio.mp3",
            path="/tmp/audio.mp3",
            size=1000,
        )
        task_db.enqueue(
            task_id="test-default-override",
            file_id="test-file-default-override",
            options=None,
        )
        _claim_pending_task(task_db, "test-default-override")
        task_db.complete(
            task_id="test-default-override",
            segments=[{"start": 0.0, "end": 1.0, "text": "Override text"}],
            duration=1.0,
        )

        patch_response = client.patch(
            "/api/config/export/defaults",
            json={"format": "txt", "include_timestamps": False},
        )
        assert patch_response.status_code == 200

        response = client.get(
            "/api/transcription-tasks/test-default-override/export"
            "?format=txt&include_timestamps=true"
        )
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/plain")
        assert "[" in response.text

    def test_batch_export_uses_persisted_defaults_when_params_omitted(self, client):
        """Batch export should apply persisted defaults when payload omits options."""
        import io
        import zipfile

        file_db = get_file_db()
        task_db = get_task_db()
        file_db.create_file(
            file_id="test-file-default-batch",
            filename="batch-audio.mp3",
            path="/tmp/batch-audio.mp3",
            size=1000,
        )
        task_db.enqueue(
            task_id="test-default-batch",
            file_id="test-file-default-batch",
            options=None,
        )
        _claim_pending_task(task_db, "test-default-batch")
        task_db.complete(
            task_id="test-default-batch",
            segments=[{"start": 0.0, "end": 1.0, "text": "Batch default"}],
            duration=1.0,
        )

        patch_response = client.patch(
            "/api/config/export/defaults",
            json={"format": "vtt", "include_timestamps": True},
        )
        assert patch_response.status_code == 200

        response = client.post(
            "/api/transcription-tasks/export/batch",
            json={"task_ids": ["test-default-batch"]},
        )

        assert response.status_code == 200
        zip_buffer = io.BytesIO(response.content)
        with zipfile.ZipFile(zip_buffer, "r") as zf:
            names = zf.namelist()
            assert "batch-audio.vtt" in names
            assert zf.read("batch-audio.vtt").decode().startswith("WEBVTT")

    def test_export_openapi_declares_file_and_json_responses(self, client: TestClient):
        """OpenAPI should describe both file download and save=true JSON responses."""
        response = client.get("/openapi.json")
        assert response.status_code == 200
        schema = response.json()

        export_get = schema["paths"]["/api/transcription-tasks/{task_id}/export"]["get"]
        export_content = export_get["responses"]["200"]["content"]
        assert "application/json" in export_content
        assert "application/x-subrip" in export_content
        assert "text/vtt" in export_content
        assert "text/plain" in export_content
        assert "text/x-ssa" in export_content

    def test_batch_export_openapi_declares_zip_response(self, client: TestClient):
        """OpenAPI should describe ZIP download for batch export."""
        response = client.get("/openapi.json")
        assert response.status_code == 200
        schema = response.json()

        batch_post = schema["paths"]["/api/transcription-tasks/export/batch"]["post"]
        batch_content = batch_post["responses"]["200"]["content"]
        assert "application/zip" in batch_content


class TestBatchExportAPI:
    """Tests for batch export endpoint."""

    def test_batch_export_success(self, client: TestClient):
        """Test batch export with valid completed tasks."""
        import io
        import zipfile

        file_db = get_file_db()
        task_db = get_task_db()

        # Create two completed tasks
        for i in range(2):
            file_db.create_file(
                file_id=f"batch-file-{i}",
                filename=f"audio_{i}.mp3",
                path=f"/tmp/audio_{i}.mp3",
                size=1000,
            )
            task_db.enqueue(
                task_id=f"batch-task-{i}", file_id=f"batch-file-{i}", options=None
            )
            _claim_pending_task(task_db, f"batch-task-{i}")
            task_db.complete(
                task_id=f"batch-task-{i}",
                segments=[{"start": 0.0, "end": 1.0, "text": f"Test {i}"}],
                duration=1.0,
            )

        response = client.post(
            "/api/transcription-tasks/export/batch",
            json={"task_ids": ["batch-task-0", "batch-task-1"], "format": "srt"},
        )

        assert response.status_code == 200
        assert response.headers["content-type"].startswith("application/zip")

        # Verify ZIP contents
        zip_buffer = io.BytesIO(response.content)
        with zipfile.ZipFile(zip_buffer, "r") as zf:
            names = zf.namelist()
            assert len(names) == 2
            assert "audio_0.srt" in names
            assert "audio_1.srt" in names

    def test_batch_export_formatter_error_returns_controlled_500(
        self, client: TestClient
    ):
        """Map batch formatter resolution errors to controlled API failures."""
        with patch(
            "nola.application.tasks.exports.batch_export_tasks.get_formatter",
            side_effect=ValueError("boom"),
        ):
            response = client.post(
                "/api/transcription-tasks/export/batch",
                json={"task_ids": ["formatter-error-task"], "format": "srt"},
            )

        assert response.status_code == 500
        assert response.json()["detail"] == "Invalid export formatter configuration"

    def test_batch_export_partial_failure(self, client: TestClient):
        """Test batch export with mix of valid and invalid tasks."""
        import io
        import zipfile

        file_db = get_file_db()
        task_db = get_task_db()

        # Create one completed task
        file_db.create_file(
            file_id="partial-file",
            filename="partial.mp3",
            path="/tmp/partial.mp3",
            size=1000,
        )
        task_db.enqueue(task_id="partial-task", file_id="partial-file", options=None)
        _claim_pending_task(task_db, "partial-task")
        task_db.complete(
            task_id="partial-task",
            segments=[{"start": 0.0, "end": 1.0, "text": "Partial test"}],
            duration=1.0,
        )

        response = client.post(
            "/api/transcription-tasks/export/batch",
            json={
                "task_ids": ["partial-task", "nonexistent-task"],
                "format": "srt",
            },
        )

        assert response.status_code == 200

        zip_buffer = io.BytesIO(response.content)
        with zipfile.ZipFile(zip_buffer, "r") as zf:
            names = zf.namelist()
            assert "partial.srt" in names
            assert "_errors.txt" in names
            errors = zf.read("_errors.txt").decode()
            assert "nonexistent-task" in errors

    def test_batch_export_hides_internal_exception_details(self, client: TestClient):
        """Batch error report should avoid exposing raw exception details."""
        import io
        import zipfile

        file_db = get_file_db()
        task_db = get_task_db()

        file_db.create_file(
            file_id="internal-ok-file",
            filename="internal-ok.mp3",
            path="/tmp/internal-ok.mp3",
            size=1000,
        )
        task_db.enqueue(
            task_id="internal-ok-task",
            file_id="internal-ok-file",
            options=None,
        )
        _claim_pending_task(task_db, "internal-ok-task")
        task_db.complete(
            task_id="internal-ok-task",
            segments=[{"start": 0.0, "end": 1.0, "text": "ok"}],
            duration=1.0,
        )

        file_db.create_file(
            file_id="internal-bad-file",
            filename="internal-bad.mp3",
            path="/tmp/internal-bad.mp3",
            size=1000,
        )
        task_db.enqueue(
            task_id="internal-bad-task",
            file_id="internal-bad-file",
            options=None,
        )
        _claim_pending_task(task_db, "internal-bad-task")
        task_db.complete(
            task_id="internal-bad-task",
            segments=[{"start": 0.0, "end": 1.0}],
            duration=1.0,
        )

        response = client.post(
            "/api/transcription-tasks/export/batch",
            json={
                "task_ids": ["internal-ok-task", "internal-bad-task"],
                "format": "srt",
            },
        )

        assert response.status_code == 200

        zip_buffer = io.BytesIO(response.content)
        with zipfile.ZipFile(zip_buffer, "r") as zf:
            errors = zf.read("_errors.txt").decode()
            assert "internal-bad-task: internal_error" in errors
            assert "KeyError" not in errors
            assert "text" not in errors

    def test_batch_export_avoids_errors_filename_collision(self, client: TestClient):
        """Batch export should avoid duplicate _errors.txt member names in zip."""
        import io
        import zipfile

        file_db = get_file_db()
        task_db = get_task_db()

        file_db.create_file(
            file_id="collision-file",
            filename="_errors.mp3",
            path="/tmp/_errors.mp3",
            size=1000,
        )
        task_db.enqueue(
            task_id="collision-task",
            file_id="collision-file",
            options=None,
        )
        _claim_pending_task(task_db, "collision-task")
        task_db.complete(
            task_id="collision-task",
            segments=[{"start": 0.0, "end": 1.0, "text": "Collision"}],
            duration=1.0,
        )

        response = client.post(
            "/api/transcription-tasks/export/batch",
            json={
                "task_ids": ["collision-task", "missing-task"],
                "format": "txt",
            },
        )

        assert response.status_code == 200

        zip_buffer = io.BytesIO(response.content)
        with zipfile.ZipFile(zip_buffer, "r") as zf:
            names = zf.namelist()
            assert "_errors.txt" in names
            assert "_errors_1.txt" in names

    def test_batch_export_skips_task_with_empty_segments(self, client: TestClient):
        """Skip completed tasks with empty segments and record them as failures."""
        import io
        import zipfile

        file_db = get_file_db()
        task_db = get_task_db()

        file_db.create_file(
            file_id="empty-ok-file",
            filename="ok.mp3",
            path="/tmp/ok.mp3",
            size=1000,
        )
        task_db.enqueue(task_id="empty-ok-task", file_id="empty-ok-file", options=None)
        _claim_pending_task(task_db, "empty-ok-task")
        task_db.complete(
            task_id="empty-ok-task",
            segments=[{"start": 0.0, "end": 1.0, "text": "Valid export"}],
            duration=1.0,
        )

        file_db.create_file(
            file_id="empty-segments-file",
            filename="empty.mp3",
            path="/tmp/empty.mp3",
            size=1000,
        )
        task_db.enqueue(
            task_id="empty-segments-task",
            file_id="empty-segments-file",
            options=None,
        )
        _claim_pending_task(task_db, "empty-segments-task")
        task_db.complete(
            task_id="empty-segments-task",
            segments=[],
            duration=0.0,
        )

        response = client.post(
            "/api/transcription-tasks/export/batch",
            json={
                "task_ids": ["empty-ok-task", "empty-segments-task"],
                "format": "srt",
            },
        )

        assert response.status_code == 200

        zip_buffer = io.BytesIO(response.content)
        with zipfile.ZipFile(zip_buffer, "r") as zf:
            names = zf.namelist()
            assert "ok.srt" in names
            assert "empty.srt" not in names
            assert "_errors.txt" in names
            errors = zf.read("_errors.txt").decode()
            assert "empty-segments-task: no_segments" in errors

    def test_batch_export_all_empty_segments_returns_400(self, client: TestClient):
        """Return 400 when all batch-export tasks have empty segments."""
        file_db = get_file_db()
        task_db = get_task_db()

        file_db.create_file(
            file_id="all-empty-file",
            filename="all-empty.mp3",
            path="/tmp/all-empty.mp3",
            size=1000,
        )
        task_db.enqueue(
            task_id="all-empty-task", file_id="all-empty-file", options=None
        )
        _claim_pending_task(task_db, "all-empty-task")
        task_db.complete(
            task_id="all-empty-task",
            segments=[],
            duration=0.0,
        )

        response = client.post(
            "/api/transcription-tasks/export/batch",
            json={"task_ids": ["all-empty-task"], "format": "srt"},
        )

        assert response.status_code == 400
        assert "All 1 exports failed" in response.json()["detail"]

    def test_batch_export_all_failed(self, client: TestClient):
        """Test batch export when all tasks fail."""
        response = client.post(
            "/api/transcription-tasks/export/batch",
            json={"task_ids": ["fake-1", "fake-2"], "format": "srt"},
        )

        assert response.status_code == 400
        assert "All" in response.json()["detail"]

    def test_batch_export_custom_zip_name(self, client: TestClient):
        """Test batch export with custom ZIP filename."""
        file_db = get_file_db()
        task_db = get_task_db()

        file_db.create_file(
            file_id="zip-name-file",
            filename="custom.mp3",
            path="/tmp/custom.mp3",
            size=1000,
        )
        task_db.enqueue(task_id="zip-name-task", file_id="zip-name-file", options=None)
        _claim_pending_task(task_db, "zip-name-task")
        task_db.complete(
            task_id="zip-name-task",
            segments=[{"start": 0.0, "end": 1.0, "text": "Custom name"}],
            duration=1.0,
        )

        response = client.post(
            "/api/transcription-tasks/export/batch",
            json={
                "task_ids": ["zip-name-task"],
                "format": "srt",
                "zip_name": "my_subtitles",
            },
        )

        assert response.status_code == 200
        content_disp = response.headers["content-disposition"]
        assert "my_subtitles.zip" in content_disp

    def test_batch_export_zip_name_injection(self, client: TestClient):
        """Test that CR/LF in zip_name is sanitized."""
        file_db = get_file_db()
        task_db = get_task_db()

        file_db.create_file(
            file_id="inject-file",
            filename="inject.mp3",
            path="/tmp/inject.mp3",
            size=1000,
        )
        task_db.enqueue(task_id="inject-task", file_id="inject-file", options=None)
        _claim_pending_task(task_db, "inject-task")
        task_db.complete(
            task_id="inject-task",
            segments=[{"start": 0.0, "end": 1.0, "text": "Inject test"}],
            duration=1.0,
        )

        response = client.post(
            "/api/transcription-tasks/export/batch",
            json={
                "task_ids": ["inject-task"],
                "format": "srt",
                "zip_name": '  bad\r\n/\\header"  ',
            },
        )

        assert response.status_code == 200
        content_disp = response.headers["content-disposition"]
        # Verify dangerous chars are removed and whitespace is trimmed
        assert "\r" not in content_disp
        assert "\n" not in content_disp
        assert "/" not in content_disp
        assert "\\" not in content_disp
        assert '"badheader.zip"' in content_disp
