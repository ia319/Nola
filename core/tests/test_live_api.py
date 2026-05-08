"""Tests for live transcription API endpoints."""

import tempfile
from pathlib import Path
from unittest.mock import PropertyMock, patch

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from nola.api.deps import (
    get_app_config_db,
    get_file_db,
    get_live_db,
    get_live_diagnostics_output_dir,
    get_live_realtime_transcriber_factory,
    get_live_stream_connection_registry,
    get_task_db,
)
from nola.application.live import DEFAULT_LIVE_SESSION_LIMIT, LiveSessionRecord
from nola.application.live.realtime import (
    LIVE_REALTIME_PROTOCOL_VERSION,
    LiveRealtimeTranscriberFrame,
    LiveRealtimeTranscriberResult,
    LiveRealtimeTranscriptFinalCandidate,
    LiveRealtimeTranscriptPreview,
)
from nola.application.live.types import LiveTrackSource
from nola.config.settings import Settings
from nola.main import app
from nola.models import init_db


@pytest.fixture
def client() -> TestClient:
    """Create a test client backed by an isolated live database."""
    app.openapi_schema = None
    get_app_config_db.cache_clear()
    get_file_db.cache_clear()
    get_live_db.cache_clear()
    get_live_stream_connection_registry.cache_clear()
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

    app.openapi_schema = None
    get_app_config_db.cache_clear()
    get_file_db.cache_clear()
    get_live_db.cache_clear()
    get_live_stream_connection_registry.cache_clear()
    get_task_db.cache_clear()


def _create_live_session(client: TestClient) -> dict[str, object]:
    response = client.post(
        "/api/live/sessions",
        json={
            "title": "Daily standup",
            "mode": "streaming",
            "language_hint": "en",
            "model_id": "small",
        },
    )
    assert response.status_code == 200
    return response.json()


def _realtime_event(
    event_type: str,
    session_id: str,
    *,
    protocol_version: int = LIVE_REALTIME_PROTOCOL_VERSION,
) -> dict[str, object]:
    """Build one realtime client event envelope."""
    return {
        "type": event_type,
        "protocol_version": protocol_version,
        "session_id": session_id,
        "event_id": f"{event_type}-event",
        "sent_at": "2026-01-01T00:00:00+00:00",
    }


def _track_start_event(
    session_id: str,
    *,
    source: str,
    sequence: int = 0,
) -> dict[str, object]:
    """Build one realtime track start event."""
    return {
        **_realtime_event("track.start", session_id),
        "source": source,
        "sequence": sequence,
        "label": source,
        "device_label": None,
        "sample_rate": 16000,
        "channel_count": 1,
    }


def _audio_frame_event(
    session_id: str,
    *,
    track_id: str,
    source: str,
    sequence: int,
) -> dict[str, object]:
    """Build one realtime audio frame metadata event."""
    return {
        **_realtime_event("audio.frame", session_id),
        "track_id": track_id,
        "source": source,
        "sequence": sequence,
        "captured_at_ms": sequence * 20,
        "duration_ms": 20,
        "byte_length": 640,
        "encoding": "pcm_s16le",
        "sample_rate": 16000,
        "channel_count": 1,
    }


def _track_stop_event(
    session_id: str,
    *,
    track_id: str,
    source: str,
    sequence: int,
) -> dict[str, object]:
    """Build one realtime track stop event."""
    return {
        **_realtime_event("track.stop", session_id),
        "track_id": track_id,
        "source": source,
        "sequence": sequence,
    }


def test_list_live_sessions_empty(client: TestClient) -> None:
    """Live session list should return an empty page before any session exists."""
    response = client.get("/api/live/sessions")

    assert response.status_code == 200
    assert response.json() == {
        "sessions": [],
        "total": 0,
        "limit": DEFAULT_LIVE_SESSION_LIMIT,
        "offset": 0,
    }


def test_list_live_sessions_uses_dependency_override(client: TestClient) -> None:
    """Live session list should accept a FastAPI store dependency override."""

    class OverrideLiveStore:
        def list_sessions(
            self,
            limit: int = DEFAULT_LIVE_SESSION_LIMIT,
            offset: int = 0,
        ) -> list[LiveSessionRecord]:
            session: LiveSessionRecord = {
                "id": "override-session",
                "title": "Override",
                "mode": "streaming",
                "status": "active",
                "language_hint": None,
                "model_id": None,
                "runtime": None,
                "audio_format": None,
                "started_at": "2026-01-01T00:00:00+00:00",
                "ended_at": None,
                "error": None,
                "created_at": "2026-01-01T00:00:00+00:00",
                "updated_at": "2026-01-01T00:00:00+00:00",
            }
            return [session][offset : offset + limit]

        def count_sessions(self) -> int:
            return 1

    app.dependency_overrides[get_live_db] = OverrideLiveStore
    try:
        response = client.get("/api/live/sessions")
    finally:
        app.dependency_overrides.pop(get_live_db, None)

    assert response.status_code == 200
    assert response.json()["sessions"][0]["session_id"] == "override-session"


def test_create_list_get_and_finish_live_session(client: TestClient) -> None:
    """Live session endpoints should expose the stage-one lifecycle."""
    created = _create_live_session(client)
    session_id = str(created["session_id"])

    list_response = client.get("/api/live/sessions")
    detail_response = client.get(f"/api/live/sessions/{session_id}")
    finish_response = client.post(f"/api/live/sessions/{session_id}/finish")
    repeated_finish_response = client.post(f"/api/live/sessions/{session_id}/finish")

    assert created["status"] == "active"
    assert created["tracks"] == []
    assert created["segments"] == []
    assert created["segment_total"] == 0
    assert list_response.status_code == 200
    assert list_response.json()["total"] == 1
    assert list_response.json()["sessions"][0]["session_id"] == session_id
    assert detail_response.status_code == 200
    assert detail_response.json()["session_id"] == session_id
    assert finish_response.status_code == 200
    assert finish_response.json()["status"] == "finished"
    assert finish_response.json()["ended_at"] is not None
    assert repeated_finish_response.status_code == 200
    assert repeated_finish_response.json()["status"] == "finished"


def test_live_realtime_stream_returns_server_ready(client: TestClient) -> None:
    """Live realtime stream should expose protocol and session metadata."""
    created = _create_live_session(client)
    session_id = str(created["session_id"])

    with client.websocket_connect(
        f"/api/live/sessions/{session_id}/stream"
    ) as websocket:
        websocket.send_json(_realtime_event("client.hello", session_id))
        ready = websocket.receive_json()
        websocket.send_json(_realtime_event("session.finish", session_id))
        finished = websocket.receive_json()

        assert ready["type"] == "server.ready"
        assert ready["protocol_version"] == LIVE_REALTIME_PROTOCOL_VERSION
        assert ready["session_id"] == session_id
        assert ready["audio_contract"] == {
            "encoding": "pcm_s16le",
            "byte_order": "little_endian",
            "sample_rate": 16000,
            "channel_count": 1,
            "frame_duration_ms_min": 20,
            "frame_duration_ms_max": 100,
            "frame_payload_bytes_max": 3200,
        }
        assert ready["session"]["session_id"] == session_id
        assert finished["type"] == "session.finished"
        assert finished["session"]["status"] == "finished"

        with pytest.raises(WebSocketDisconnect) as close_error:
            websocket.receive_json()
        assert close_error.value.code == 1000


def test_live_realtime_stream_rejects_malformed_hello_json(
    client: TestClient,
) -> None:
    """Live realtime stream should reject malformed hello JSON predictably."""
    created = _create_live_session(client)
    session_id = str(created["session_id"])

    with client.websocket_connect(
        f"/api/live/sessions/{session_id}/stream"
    ) as websocket:
        websocket.send_text("{")
        error = websocket.receive_json()

        assert error["type"] == "server.error"
        assert error["error"]["code"] == "invalid_event"
        assert error["error"]["message"] == "Realtime event payload is invalid JSON"
        with pytest.raises(WebSocketDisconnect) as close_error:
            websocket.receive_json()
        assert close_error.value.code == 1008


def test_live_realtime_stream_rejects_malformed_event_json(
    client: TestClient,
) -> None:
    """Live realtime stream should reject malformed event JSON predictably."""
    created = _create_live_session(client)
    session_id = str(created["session_id"])

    with client.websocket_connect(
        f"/api/live/sessions/{session_id}/stream"
    ) as websocket:
        websocket.send_json(_realtime_event("client.hello", session_id))
        assert websocket.receive_json()["type"] == "server.ready"

        websocket.send_text("{")
        error = websocket.receive_json()

        assert error["type"] == "server.error"
        assert error["error"]["code"] == "invalid_event"
        assert error["error"]["message"] == "Realtime event payload is invalid JSON"
        with pytest.raises(WebSocketDisconnect) as close_error:
            websocket.receive_json()
        assert close_error.value.code == 1008


def test_live_realtime_stream_rejects_binary_hello_event(
    client: TestClient,
) -> None:
    """Live realtime stream should reject non-text hello events predictably."""
    created = _create_live_session(client)
    session_id = str(created["session_id"])

    with client.websocket_connect(
        f"/api/live/sessions/{session_id}/stream"
    ) as websocket:
        websocket.send_bytes(b"{}")
        error = websocket.receive_json()

        assert error["type"] == "server.error"
        assert error["error"]["code"] == "invalid_event"
        assert (
            error["error"]["message"]
            == "Realtime event must be sent as a JSON text frame"
        )
        with pytest.raises(WebSocketDisconnect) as close_error:
            websocket.receive_json()
        assert close_error.value.code == 1008


def test_live_realtime_stream_rejects_binary_runtime_event(
    client: TestClient,
) -> None:
    """Live realtime stream should reject non-text runtime events predictably."""
    created = _create_live_session(client)
    session_id = str(created["session_id"])

    with client.websocket_connect(
        f"/api/live/sessions/{session_id}/stream"
    ) as websocket:
        websocket.send_json(_realtime_event("client.hello", session_id))
        assert websocket.receive_json()["type"] == "server.ready"

        websocket.send_bytes(b"{}")
        error = websocket.receive_json()

        assert error["type"] == "server.error"
        assert error["error"]["code"] == "invalid_event"
        assert (
            error["error"]["message"]
            == "Realtime event must be sent as a JSON text frame"
        )
        with pytest.raises(WebSocketDisconnect) as close_error:
            websocket.receive_json()
        assert close_error.value.code == 1008


def test_live_realtime_stream_handles_track_lifecycle(client: TestClient) -> None:
    """Live realtime stream should create and stop source tracks."""
    created = _create_live_session(client)
    session_id = str(created["session_id"])

    with client.websocket_connect(
        f"/api/live/sessions/{session_id}/stream"
    ) as websocket:
        websocket.send_json(_realtime_event("client.hello", session_id))
        assert websocket.receive_json()["type"] == "server.ready"

        websocket.send_json(_track_start_event(session_id, source="microphone"))
        microphone_ready = websocket.receive_json()
        microphone_track_id = str(microphone_ready["track"]["track_id"])

        websocket.send_json(_track_start_event(session_id, source="system"))
        system_ready = websocket.receive_json()
        system_track_id = str(system_ready["track"]["track_id"])

        websocket.send_json(
            _audio_frame_event(
                session_id,
                track_id=microphone_track_id,
                source="microphone",
                sequence=0,
            )
        )
        websocket.send_bytes(b"\x00" * 640)
        websocket.send_json(
            _track_stop_event(
                session_id,
                track_id=microphone_track_id,
                source="microphone",
                sequence=1,
            )
        )
        websocket.send_json(
            _track_stop_event(
                session_id,
                track_id=system_track_id,
                source="system",
                sequence=0,
            )
        )
        websocket.send_json(_realtime_event("session.finish", session_id))
        finished = websocket.receive_json()

        tracks = sorted(
            finished["session"]["tracks"],
            key=lambda track: track["source"],
        )
        assert microphone_ready["type"] == "track.ready"
        assert microphone_ready["track"]["source"] == "microphone"
        assert system_ready["track"]["source"] == "system"
        assert finished["type"] == "session.finished"
        assert [track["source"] for track in tracks] == ["microphone", "system"]
        assert all(track["ended_at"] is not None for track in tracks)


def test_live_realtime_stream_emits_mock_transcripts(
    client: TestClient,
) -> None:
    """Live realtime stream should emit partials and persist final segments."""
    created = _create_live_session(client)
    session_id = str(created["session_id"])

    with client.websocket_connect(
        f"/api/live/sessions/{session_id}/stream"
    ) as websocket:
        websocket.send_json(_realtime_event("client.hello", session_id))
        assert websocket.receive_json()["type"] == "server.ready"
        websocket.send_json(_track_start_event(session_id, source="microphone"))
        track_ready = websocket.receive_json()
        track_id = str(track_ready["track"]["track_id"])

        for sequence in range(25):
            websocket.send_json(
                _audio_frame_event(
                    session_id,
                    track_id=track_id,
                    source="microphone",
                    sequence=sequence,
                )
            )
            websocket.send_bytes(b"\x00" * 640)

        partial = websocket.receive_json()
        interim_detail = client.get(f"/api/live/sessions/{session_id}").json()

        for sequence in range(25, 50):
            websocket.send_json(
                _audio_frame_event(
                    session_id,
                    track_id=track_id,
                    source="microphone",
                    sequence=sequence,
                )
            )
            websocket.send_bytes(b"\x00" * 640)

        final = websocket.receive_json()
        websocket.send_json(_realtime_event("session.finish", session_id))
        finished = websocket.receive_json()

    assert partial["type"] == "transcript.committed_partial"
    assert partial["transcript"]["result_kind"] == "committed_partial"
    assert partial["transcript"]["session_id"] == session_id
    assert partial["transcript"]["track_id"] == track_id
    assert partial["transcript"]["source"] == "microphone"
    assert partial["transcript"]["committed_index"] == 1
    assert partial["transcript"]["start_ms"] == 0
    assert partial["transcript"]["end_ms"] == 500
    assert partial["transcript"]["text"] == "Mock microphone partial 1"
    assert partial["transcript"]["is_final"] is False
    assert interim_detail["segment_total"] == 0
    assert interim_detail["segments"] == []

    assert final["type"] == "transcript.final"
    assert final["transcript"]["result_kind"] == "final"
    assert final["transcript"]["track_id"] == track_id
    assert final["transcript"]["source"] == "microphone"
    assert final["transcript"]["sequence"] == 1
    assert final["transcript"]["start_ms"] == 0
    assert final["transcript"]["end_ms"] == 1000
    assert final["transcript"]["text"] == "Mock microphone segment 1"
    assert final["transcript"]["is_final"] is True
    assert finished["type"] == "session.finished"
    assert finished["session"]["segment_total"] == 1
    assert finished["session"]["segments"][0]["text"] == "Mock microphone segment 1"


def test_live_realtime_stream_emits_flush_final_on_track_stop(
    client: TestClient,
) -> None:
    """Live realtime stream should send flush finals from track.stop."""
    created = _create_live_session(client)
    session_id = str(created["session_id"])

    app.dependency_overrides[get_live_realtime_transcriber_factory] = (
        lambda: _FlushTrackRouteTranscriber
    )
    try:
        with client.websocket_connect(
            f"/api/live/sessions/{session_id}/stream"
        ) as websocket:
            websocket.send_json(_realtime_event("client.hello", session_id))
            assert websocket.receive_json()["type"] == "server.ready"
            websocket.send_json(_track_start_event(session_id, source="microphone"))
            track_ready = websocket.receive_json()
            track_id = str(track_ready["track"]["track_id"])

            websocket.send_json(
                _track_stop_event(
                    session_id,
                    track_id=track_id,
                    source="microphone",
                    sequence=0,
                )
            )
            final = websocket.receive_json()
            websocket.send_json(_realtime_event("session.finish", session_id))
            finished = websocket.receive_json()
    finally:
        app.dependency_overrides.pop(get_live_realtime_transcriber_factory, None)

    assert final["type"] == "transcript.final"
    assert final["transcript"]["track_id"] == track_id
    assert final["transcript"]["source"] == "microphone"
    assert final["transcript"]["text"] == "flush stop final"
    assert finished["type"] == "session.finished"
    assert finished["session"]["segment_total"] == 1
    assert finished["session"]["segments"][0]["text"] == "flush stop final"


def test_live_realtime_stream_emits_preview_transcript(
    client: TestClient,
) -> None:
    """Live realtime stream should send preview transcript events."""
    created = _create_live_session(client)
    session_id = str(created["session_id"])

    app.dependency_overrides[get_live_realtime_transcriber_factory] = (
        lambda: _PreviewRouteTranscriber
    )
    try:
        with client.websocket_connect(
            f"/api/live/sessions/{session_id}/stream"
        ) as websocket:
            websocket.send_json(_realtime_event("client.hello", session_id))
            assert websocket.receive_json()["type"] == "server.ready"
            websocket.send_json(_track_start_event(session_id, source="microphone"))
            track_ready = websocket.receive_json()
            track_id = str(track_ready["track"]["track_id"])

            websocket.send_json(
                _audio_frame_event(
                    session_id,
                    track_id=track_id,
                    source="microphone",
                    sequence=0,
                )
            )
            websocket.send_bytes(b"\x00" * 640)
            preview = websocket.receive_json()
            websocket.send_json(_realtime_event("session.finish", session_id))
            finished = websocket.receive_json()
    finally:
        app.dependency_overrides.pop(get_live_realtime_transcriber_factory, None)

    assert preview["type"] == "transcript.preview"
    assert preview["transcript"]["result_kind"] == "preview"
    assert preview["transcript"]["track_id"] == track_id
    assert preview["transcript"]["source"] == "microphone"
    assert preview["transcript"]["preview_index"] == 1
    assert preview["transcript"]["start_ms"] == 0
    assert preview["transcript"]["end_ms"] == 20
    assert preview["transcript"]["text"] == "route preview"
    assert preview["transcript"]["is_final"] is False
    assert finished["type"] == "session.finished"
    assert finished["session"]["segment_total"] == 0


def test_live_realtime_stream_rejects_unknown_track_audio(
    client: TestClient,
) -> None:
    """Live realtime stream should reject audio for unknown tracks."""
    created = _create_live_session(client)
    session_id = str(created["session_id"])

    with client.websocket_connect(
        f"/api/live/sessions/{session_id}/stream"
    ) as websocket:
        websocket.send_json(_realtime_event("client.hello", session_id))
        assert websocket.receive_json()["type"] == "server.ready"
        websocket.send_json(
            _audio_frame_event(
                session_id,
                track_id="missing-track",
                source="microphone",
                sequence=0,
            )
        )
        error = websocket.receive_json()

        assert error["type"] == "server.error"
        assert error["error"]["code"] == "invalid_track"
        with pytest.raises(WebSocketDisconnect) as close_error:
            websocket.receive_json()
        assert close_error.value.code == 1008


def test_live_realtime_stream_rejects_audio_sequence_gap(
    client: TestClient,
) -> None:
    """Live realtime stream should reject skipped track frame sequences."""
    created = _create_live_session(client)
    session_id = str(created["session_id"])

    with client.websocket_connect(
        f"/api/live/sessions/{session_id}/stream"
    ) as websocket:
        websocket.send_json(_realtime_event("client.hello", session_id))
        assert websocket.receive_json()["type"] == "server.ready"
        websocket.send_json(_track_start_event(session_id, source="microphone"))
        track_ready = websocket.receive_json()
        track_id = str(track_ready["track"]["track_id"])
        websocket.send_json(
            _audio_frame_event(
                session_id,
                track_id=track_id,
                source="microphone",
                sequence=1,
            )
        )
        error = websocket.receive_json()

        assert error["type"] == "server.error"
        assert error["error"]["code"] == "audio_sequence_invalid"
        with pytest.raises(WebSocketDisconnect) as close_error:
            websocket.receive_json()
        assert close_error.value.code == 1008


def test_live_realtime_stream_rejects_pcm_payload_length_mismatch(
    client: TestClient,
) -> None:
    """Live realtime stream should reject PCM frames that do not match metadata."""
    created = _create_live_session(client)
    session_id = str(created["session_id"])

    with client.websocket_connect(
        f"/api/live/sessions/{session_id}/stream"
    ) as websocket:
        websocket.send_json(_realtime_event("client.hello", session_id))
        assert websocket.receive_json()["type"] == "server.ready"
        websocket.send_json(_track_start_event(session_id, source="microphone"))
        track_ready = websocket.receive_json()
        track_id = str(track_ready["track"]["track_id"])
        websocket.send_json(
            _audio_frame_event(
                session_id,
                track_id=track_id,
                source="microphone",
                sequence=0,
            )
        )
        websocket.send_bytes(b"\x00" * 638)
        error = websocket.receive_json()

        assert error["type"] == "server.error"
        assert error["error"]["code"] == "audio_frame_invalid"
        with pytest.raises(WebSocketDisconnect) as close_error:
            websocket.receive_json()
        assert close_error.value.code == 1008


def test_live_realtime_stream_handles_explicit_wav_diagnostics(
    client: TestClient,
    tmp_path: Path,
) -> None:
    """Live realtime stream should emit explicit WAV diagnostics events."""
    created = _create_live_session(client)
    session_id = str(created["session_id"])

    app.dependency_overrides[get_live_diagnostics_output_dir] = (
        lambda: tmp_path / "diagnostics"
    )
    try:
        with client.websocket_connect(
            f"/api/live/sessions/{session_id}/stream"
        ) as websocket:
            websocket.send_json(_realtime_event("client.hello", session_id))
            assert websocket.receive_json()["type"] == "server.ready"
            websocket.send_json(_track_start_event(session_id, source="microphone"))
            track_ready = websocket.receive_json()
            track_id = str(track_ready["track"]["track_id"])

            websocket.send_json(
                {
                    **_realtime_event("diagnostics.wav.start", session_id),
                    "max_duration_ms": 1000,
                    "max_bytes": 4096,
                    "tracks": [track_id],
                }
            )
            started = websocket.receive_json()
            websocket.send_json(
                _audio_frame_event(
                    session_id,
                    track_id=track_id,
                    source="microphone",
                    sequence=0,
                )
            )
            websocket.send_bytes(b"\x00" * 640)
            websocket.send_json(_realtime_event("diagnostics.wav.stop", session_id))
            stopped = websocket.receive_json()
            websocket.send_json(_realtime_event("session.finish", session_id))
            finished = websocket.receive_json()
    finally:
        app.dependency_overrides.pop(get_live_diagnostics_output_dir, None)

    assert started["type"] == "diagnostics.wav.started"
    assert "output_dir" not in started
    assert "manifest_path" not in started
    assert started["capture_id"].startswith(f"{session_id}-")
    assert started["manifest_name"] == "manifest.json"
    assert started["max_duration_ms"] == 1000
    assert started["max_bytes"] == 4096
    assert started["tracks"] == [track_id]
    assert stopped["type"] == "diagnostics.wav.stopped"
    assert "output_dir" not in stopped
    assert "manifest_path" not in stopped
    assert stopped["capture_id"] == started["capture_id"]
    assert stopped["manifest_name"] == "manifest.json"
    assert stopped["reason"] == "client_stop"
    assert stopped["files"][0]["track_id"] == track_id
    assert "path" not in stopped["files"][0]
    assert stopped["files"][0]["file_name"] == f"{track_id}-microphone.wav"
    assert stopped["files"][0]["duration_ms"] == 20
    assert finished["type"] == "session.finished"


def test_live_realtime_stream_stops_wav_diagnostics_on_limit(
    client: TestClient,
    tmp_path: Path,
) -> None:
    """Live realtime stream should keep running after diagnostics limits stop."""
    created = _create_live_session(client)
    session_id = str(created["session_id"])

    app.dependency_overrides[get_live_diagnostics_output_dir] = (
        lambda: tmp_path / "diagnostics"
    )
    try:
        with client.websocket_connect(
            f"/api/live/sessions/{session_id}/stream"
        ) as websocket:
            websocket.send_json(_realtime_event("client.hello", session_id))
            assert websocket.receive_json()["type"] == "server.ready"
            websocket.send_json(_track_start_event(session_id, source="microphone"))
            track_ready = websocket.receive_json()
            track_id = str(track_ready["track"]["track_id"])

            websocket.send_json(
                {
                    **_realtime_event("diagnostics.wav.start", session_id),
                    "max_duration_ms": 20,
                    "max_bytes": 4096,
                    "tracks": [track_id],
                }
            )
            started = websocket.receive_json()
            websocket.send_json(
                _audio_frame_event(
                    session_id,
                    track_id=track_id,
                    source="microphone",
                    sequence=0,
                )
            )
            websocket.send_bytes(b"\x00" * 640)
            websocket.send_json(
                _audio_frame_event(
                    session_id,
                    track_id=track_id,
                    source="microphone",
                    sequence=1,
                )
            )
            websocket.send_bytes(b"\x00" * 640)
            stopped = websocket.receive_json()
            websocket.send_json(_realtime_event("session.finish", session_id))
            finished = websocket.receive_json()
    finally:
        app.dependency_overrides.pop(get_live_diagnostics_output_dir, None)

    assert started["type"] == "diagnostics.wav.started"
    assert stopped["type"] == "diagnostics.wav.stopped"
    assert stopped["reason"] == "limit_exceeded"
    assert stopped["capture_id"] == started["capture_id"]
    assert finished["type"] == "session.finished"


def test_live_realtime_stream_rejects_missing_session(client: TestClient) -> None:
    """Live realtime stream should reject unknown sessions."""
    with client.websocket_connect(
        "/api/live/sessions/missing-session/stream"
    ) as websocket:
        error = websocket.receive_json()

        assert error["type"] == "server.error"
        assert error["error"]["code"] == "session_not_found"
        with pytest.raises(WebSocketDisconnect) as close_error:
            websocket.receive_json()
        assert close_error.value.code == 4404


def test_live_realtime_stream_rejects_non_active_session(client: TestClient) -> None:
    """Live realtime stream should reject terminal sessions."""
    created = _create_live_session(client)
    session_id = str(created["session_id"])
    finish_response = client.post(f"/api/live/sessions/{session_id}/finish")
    assert finish_response.status_code == 200

    with client.websocket_connect(
        f"/api/live/sessions/{session_id}/stream"
    ) as websocket:
        error = websocket.receive_json()

        assert error["type"] == "server.error"
        assert error["error"]["code"] == "session_not_active"
        with pytest.raises(WebSocketDisconnect) as close_error:
            websocket.receive_json()
        assert close_error.value.code == 4409


def test_live_realtime_stream_rejects_second_writer(client: TestClient) -> None:
    """Live realtime stream should reject a second writer for one session."""
    created = _create_live_session(client)
    session_id = str(created["session_id"])

    with client.websocket_connect(f"/api/live/sessions/{session_id}/stream") as first:
        first.send_json(_realtime_event("client.hello", session_id))
        assert first.receive_json()["type"] == "server.ready"

        with client.websocket_connect(
            f"/api/live/sessions/{session_id}/stream"
        ) as second:
            error = second.receive_json()
            assert error["type"] == "server.error"
            assert error["error"]["code"] == "session_already_streaming"
            with pytest.raises(WebSocketDisconnect) as close_error:
                second.receive_json()
            assert close_error.value.code == 4409

        first.send_json(_realtime_event("session.finish", session_id))
        assert first.receive_json()["type"] == "session.finished"


def test_live_realtime_stream_rechecks_session_after_acquire(
    client: TestClient,
) -> None:
    """Live realtime stream should reject sessions finished during acquire."""
    created = _create_live_session(client)
    session_id = str(created["session_id"])
    live_db = get_live_db()

    class FinishDuringAcquireRegistry:
        def __init__(self) -> None:
            self.released = False

        async def acquire(self, acquired_session_id: str) -> bool:
            assert acquired_session_id == session_id
            live_db.finish_session(
                session_id,
                ended_at="2026-01-01T00:01:00+00:00",
                updated_at="2026-01-01T00:01:00+00:00",
            )
            return True

        async def release(self, released_session_id: str) -> None:
            assert released_session_id == session_id
            self.released = True

    registry = FinishDuringAcquireRegistry()
    app.dependency_overrides[get_live_stream_connection_registry] = lambda: registry
    try:
        with client.websocket_connect(
            f"/api/live/sessions/{session_id}/stream"
        ) as websocket:
            error = websocket.receive_json()

            assert error["type"] == "server.error"
            assert error["error"]["code"] == "session_not_active"
            with pytest.raises(WebSocketDisconnect) as close_error:
                websocket.receive_json()
            assert close_error.value.code == 4409
    finally:
        app.dependency_overrides.pop(get_live_stream_connection_registry, None)

    assert registry.released is True


def test_live_realtime_stream_rejects_unsupported_protocol(
    client: TestClient,
) -> None:
    """Live realtime stream should reject unsupported protocol versions."""
    created = _create_live_session(client)
    session_id = str(created["session_id"])

    with client.websocket_connect(
        f"/api/live/sessions/{session_id}/stream"
    ) as websocket:
        websocket.send_json(
            _realtime_event("client.hello", session_id, protocol_version=999)
        )
        error = websocket.receive_json()

        assert error["type"] == "server.error"
        assert error["error"]["code"] == "protocol_version_unsupported"
        with pytest.raises(WebSocketDisconnect) as close_error:
            websocket.receive_json()
        assert close_error.value.code == 1008

    detail_response = client.get(f"/api/live/sessions/{session_id}")
    assert detail_response.status_code == 200
    assert detail_response.json()["status"] == "active"


def test_live_realtime_stream_marks_session_failed_after_disconnect(
    client: TestClient,
) -> None:
    """Live realtime stream should fail active sessions after unexpected close."""
    created = _create_live_session(client)
    session_id = str(created["session_id"])

    with client.websocket_connect(
        f"/api/live/sessions/{session_id}/stream"
    ) as websocket:
        websocket.send_json(_realtime_event("client.hello", session_id))
        assert websocket.receive_json()["type"] == "server.ready"

    detail_response = client.get(f"/api/live/sessions/{session_id}")

    assert detail_response.status_code == 200
    assert detail_response.json()["status"] == "failed"
    assert detail_response.json()["error"] == "connection_closed"


def test_get_live_session_returns_paged_segments(client: TestClient) -> None:
    """Live detail should return a bounded segment window."""
    created = _create_live_session(client)
    session_id = str(created["session_id"])
    live_db = get_live_db()
    for sequence in range(1, 4):
        live_db.create_segment(
            segment_id=f"segment-00{sequence}",
            session_id=session_id,
            track_id=None,
            sequence=sequence,
            start_ms=(sequence - 1) * 1000,
            end_ms=sequence * 1000,
            text=f"text {sequence}",
            language="en",
            confidence=None,
            is_final=True,
            created_at=f"2026-01-01T00:00:0{sequence}",
        )

    response = client.get(
        f"/api/live/sessions/{session_id}",
        params={"segment_limit": 1, "segment_offset": 1},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["segment_total"] == 3
    assert data["segment_limit"] == 1
    assert data["segment_offset"] == 1
    assert [segment["segment_id"] for segment in data["segments"]] == ["segment-002"]


def test_live_session_errors(client: TestClient) -> None:
    """Live routes should expose stable HTTP error boundaries."""
    invalid_create = client.post(
        "/api/live/sessions",
        json={"title": "Bad", "mode": "offline"},
    )
    missing_detail = client.get("/api/live/sessions/missing-session")
    invalid_segment_page = client.get(
        "/api/live/sessions/missing-session",
        params={"segment_limit": 501},
    )

    assert invalid_create.status_code == 422
    assert missing_detail.status_code == 404
    assert missing_detail.json()["detail"] == "Live session not found"
    assert invalid_segment_page.status_code == 422


def test_openapi_exposes_live_paths(client: TestClient) -> None:
    """OpenAPI should include the live session routes."""
    response = client.get("/openapi.json")

    assert response.status_code == 200
    paths = response.json()["paths"]
    assert "/api/live/sessions" in paths
    assert "/api/live/sessions/{session_id}" in paths
    assert "/api/live/sessions/{session_id}/finish" in paths


class _FlushTrackRouteTranscriber:
    def accept_frame(
        self,
        _frame: LiveRealtimeTranscriberFrame,
    ) -> tuple[LiveRealtimeTranscriberResult, ...]:
        return ()

    def flush_track(
        self,
        *,
        track_id: str,
        source: LiveTrackSource,
    ) -> tuple[LiveRealtimeTranscriberResult, ...]:
        return (
            LiveRealtimeTranscriptFinalCandidate(
                track_id=track_id,
                source=source,
                start_ms=0,
                end_ms=200,
                text="flush stop final",
                language=None,
                confidence=None,
            ),
        )

    def flush_all(self) -> tuple[LiveRealtimeTranscriberResult, ...]:
        return ()

    def release(self) -> None:
        return None


class _PreviewRouteTranscriber:
    def accept_frame(
        self,
        frame: LiveRealtimeTranscriberFrame,
    ) -> tuple[LiveRealtimeTranscriberResult, ...]:
        return (
            LiveRealtimeTranscriptPreview(
                track_id=frame.track_id,
                source=frame.source,
                preview_index=1,
                start_ms=frame.start_ms,
                end_ms=frame.end_ms,
                text="route preview",
                language=None,
                confidence=None,
            ),
        )

    def flush_track(
        self,
        *,
        track_id: str,
        source: LiveTrackSource,
    ) -> tuple[LiveRealtimeTranscriberResult, ...]:
        del track_id, source
        return ()

    def flush_all(self) -> tuple[LiveRealtimeTranscriberResult, ...]:
        return ()

    def release(self) -> None:
        return None
