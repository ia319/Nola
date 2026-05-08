"""Pytest tests for worker module."""

from pathlib import Path
from unittest.mock import Mock, patch

import pytest

from nola.engines.base import TranscribeOptions, TranscriptionEngine
from nola.model_hub import require_model
from nola.models.tasks import TaskRowRaw
from nola.services import worker as worker_module
from nola.services.worker import build_transcribe_options
from nola.services.worker_engine import (
    DesiredEngineState,
    EngineFingerprint,
    LoadedEngineState,
    WorkerEngineError,
)


class StubConfigStore:
    """Provide the minimal config-store contract used by worker tests."""

    def __init__(self, values: dict[str, object]) -> None:
        """Initialize the stubbed defaults payload."""
        self.values = values

    def get_all(self, prefix: str) -> dict[str, object]:
        """Return persisted defaults for the requested prefix."""
        assert prefix == "transcription."
        return self.values


class TestBuildTranscribeOptions:
    """Test worker-side option merging and invalid key filtering."""

    def test_empty_options(self):
        """Empty dict should return default options."""
        options = build_transcribe_options({})
        assert options == TranscribeOptions()

    def test_none_options(self):
        """None should return default options."""
        options = build_transcribe_options(None)
        assert options == TranscribeOptions()

    def test_valid_options(self):
        """Valid options should be applied."""
        options = build_transcribe_options({"language": "en", "beam_size": 3})

        assert options.language == "en"
        assert options.beam_size == 3
        # Other fields should use defaults
        assert options.task == "transcribe"

    def test_invalid_keys_filtered(self):
        """Invalid keys should be silently filtered out."""
        options = build_transcribe_options(
            {
                "language": "zh",
                "invalid_key": "should_be_ignored",
                "another_invalid": 123,
            }
        )

        assert options.language == "zh"
        # Should not raise TypeError for invalid keys
        assert not hasattr(options, "invalid_key")

    def test_mixed_valid_invalid_keys(self):
        """Mixed valid and invalid keys should work."""
        options = build_transcribe_options(
            {
                "task": "translate",
                "beam_size": 7,
                "foo": "bar",
                "baz": 999,
            }
        )

        assert options.task == "translate"
        assert options.beam_size == 7

    def test_app_defaults_apply_when_task_omits_field(self):
        """Persisted defaults should fill in fields omitted by the task."""
        options = build_transcribe_options(
            {"language": "en"},
            StubConfigStore({"beam_size": 3, "vad_filter": True}),
        )

        assert options.language == "en"
        assert options.beam_size == 3
        assert options.vad_filter is True

    def test_task_options_override_app_defaults(self):
        """Per-task options should override persisted application defaults."""
        options = build_transcribe_options(
            {"beam_size": 7},
            StubConfigStore({"beam_size": 3, "task": "translate"}),
        )

        assert options.beam_size == 7
        assert options.task == "translate"

    def test_runtime_config_snapshot_overrides_current_defaults(self):
        """Stored runtime snapshots should bypass execution-time defaults."""
        options = build_transcribe_options(
            {"beam_size": 7},
            StubConfigStore({"beam_size": 3, "task": "translate"}),
            runtime_config={
                "schema_version": 1,
                "model_id": "small",
                "engine_device": "cpu",
                "engine_compute_type": "default",
                "transcription_options": {
                    "language": "en",
                    "task": "transcribe",
                    "beam_size": 1,
                },
                "request_options": None,
            },
        )

        assert options.language == "en"
        assert options.task == "transcribe"
        assert options.beam_size == 1

    def test_nested_vad_parameters_deep_merge_across_layers(self):
        """Nested VAD overrides should merge instead of replacing whole objects."""
        options = build_transcribe_options(
            {"vad_parameters": {"threshold": 0.7}},
            StubConfigStore({"vad_parameters": {"speech_pad_ms": 500}}),
        )

        assert options.vad_parameters == {
            "speech_pad_ms": 500,
            "threshold": 0.7,
        }

    def test_empty_app_config_matches_previous_default_behavior(self):
        """An empty config table should behave exactly like the old worker path."""
        options = build_transcribe_options(None, StubConfigStore({}))

        assert options == TranscribeOptions()

    def test_engine_config_keys_stay_out_of_transcribe_options(self):
        """Engine startup config should not become task-level transcription options."""
        options = build_transcribe_options(
            {
                "device": "cuda",
                "compute_type": "float16",
                "model_size": "small.en",
                "beam_size": 3,
            },
            StubConfigStore({"device": "cpu"}),
        )

        assert options.beam_size == 3
        assert not hasattr(options, "device")
        assert not hasattr(options, "compute_type")
        assert not hasattr(options, "model_size")

    def test_inf_sentinel_deserializes_for_vad_max_speech_duration(self):
        """Known numeric sentinel values should be restored before engine call."""
        options = build_transcribe_options(
            {
                "vad_parameters": {
                    "max_speech_duration_s": "inf",
                }
            }
        )

        assert options.vad_parameters == {"max_speech_duration_s": float("inf")}

    def test_inf_sentinel_deserializes_inside_nested_lists(self):
        """Deserializer should recurse into lists to keep serializer symmetry."""
        options = build_transcribe_options(
            {
                "vad_parameters": {
                    "history": [{"max_speech_duration_s": "inf"}],
                }
            }
        )

        assert options.vad_parameters == {
            "history": [{"max_speech_duration_s": float("inf")}]
        }

    def test_plain_inf_string_is_preserved_for_text_fields(self):
        """Text payloads equal to 'inf' should remain text values."""
        options = build_transcribe_options({"hotwords": "inf"})

        assert options.hotwords == "inf"


def _raw_task(
    task_id: str = "task-1",
    runtime_config: str | None = None,
) -> TaskRowRaw:
    """Build one raw task row for worker loop tests."""
    return {
        "id": task_id,
        "file_id": "file-1",
        "model_id": "small",
        "engine_device": "cpu",
        "engine_compute_type": "default",
        "status": "processing",
        "priority": 0,
        "retry_count": 0,
        "max_retries": 3,
        "worker_id": "worker-1",
        "started_at": None,
        "last_heartbeat": None,
        "timeout_seconds": 3600,
        "options": None,
        "runtime_config": runtime_config,
        "progress": 0.0,
        "duration": None,
        "segments": None,
        "error": None,
        "created_at": "2026-01-01T00:00:00",
        "completed_at": None,
    }


def _desired_state(fingerprint: EngineFingerprint) -> DesiredEngineState:
    """Build a desired engine state for worker loop tests."""
    return DesiredEngineState(
        fingerprint=fingerprint,
        model_info=require_model(fingerprint.model_id),
    )


class TestWorkerLoop:
    """Test worker queue loop coordination with engine loading."""

    def test_worker_loop_loads_engine_for_claimed_task(self, tmp_path: Path) -> None:
        """Load the task engine before running transcription."""
        task = _raw_task()
        task_db = Mock()
        task_db.dequeue.side_effect = [task, KeyboardInterrupt]
        file_db = Mock()
        config_store = Mock()
        engine = Mock(spec=TranscriptionEngine)
        loaded_state = LoadedEngineState(
            fingerprint=EngineFingerprint(
                model_id="small",
                model_dir=tmp_path,
                device="cpu",
                compute_type="default",
            ),
            engine=engine,
        )

        with (
            patch.object(worker_module, "_running", True),
            patch("nola.services.worker.FileDatabase", return_value=file_db),
            patch("nola.services.worker.TaskDatabase", return_value=task_db),
            patch(
                "nola.services.worker.AppConfigDatabase",
                return_value=config_store,
            ),
            patch(
                "nola.services.worker.build_desired_engine_state",
                return_value=_desired_state(loaded_state.fingerprint),
            ),
            patch(
                "nola.services.worker.ensure_engine_loaded",
                return_value=loaded_state,
            ) as ensure_loaded,
            patch("nola.services.worker.run_transcription") as run_transcription,
        ):
            started = worker_module.worker_loop(tmp_path / "nola.db")

        assert started is True
        ensure_loaded.assert_called_once_with(
            task=task,
            loaded=None,
            config_db=config_store,
            desired=_desired_state(loaded_state.fingerprint),
        )
        run_transcription.assert_called_once_with(
            task,
            file_db,
            task_db,
            config_store,
            engine,
        )

    def test_worker_loop_reuses_loaded_engine_state(self, tmp_path: Path) -> None:
        """Pass the previous loaded state into the next task boundary."""
        first_task = _raw_task("task-1")
        second_task = _raw_task("task-2")
        task_db = Mock()
        task_db.dequeue.side_effect = [first_task, second_task, KeyboardInterrupt]
        config_store = Mock()
        first_state = LoadedEngineState(
            fingerprint=EngineFingerprint(
                model_id="small",
                model_dir=tmp_path,
                device="cpu",
                compute_type="default",
            ),
            engine=Mock(spec=TranscriptionEngine),
        )
        second_state = LoadedEngineState(
            fingerprint=first_state.fingerprint,
            engine=first_state.engine,
        )

        with (
            patch.object(worker_module, "_running", True),
            patch("nola.services.worker.FileDatabase"),
            patch("nola.services.worker.TaskDatabase", return_value=task_db),
            patch(
                "nola.services.worker.AppConfigDatabase",
                return_value=config_store,
            ),
            patch(
                "nola.services.worker.build_desired_engine_state",
                return_value=_desired_state(first_state.fingerprint),
            ),
            patch("nola.services.worker.assert_engine_model_downloaded"),
            patch("nola.services.worker.release_loaded_engine") as release_engine,
            patch(
                "nola.services.worker.ensure_engine_loaded",
                side_effect=[first_state, second_state],
            ) as ensure_loaded,
            patch("nola.services.worker.run_transcription"),
        ):
            started = worker_module.worker_loop(tmp_path / "nola.db")

        assert started is True
        assert ensure_loaded.call_args_list[0].kwargs["loaded"] is None
        assert ensure_loaded.call_args_list[1].kwargs["loaded"] is first_state
        release_engine.assert_not_called()

    def test_worker_loop_releases_loaded_engine_before_reload(
        self, tmp_path: Path
    ) -> None:
        """Release the previous engine before loading a changed fingerprint."""
        first_task = _raw_task("task-1")
        second_task = _raw_task("task-2")
        task_db = Mock()
        task_db.dequeue.side_effect = [first_task, second_task, KeyboardInterrupt]
        config_store = Mock()
        first_fingerprint = EngineFingerprint(
            model_id="small",
            model_dir=tmp_path,
            device="cpu",
            compute_type="default",
        )
        second_fingerprint = EngineFingerprint(
            model_id="small",
            model_dir=tmp_path,
            device="cuda",
            compute_type="float16",
        )
        first_state = LoadedEngineState(
            fingerprint=first_fingerprint,
            engine=Mock(spec=TranscriptionEngine),
        )
        second_state = LoadedEngineState(
            fingerprint=second_fingerprint,
            engine=Mock(spec=TranscriptionEngine),
        )

        with (
            patch.object(worker_module, "_running", True),
            patch("nola.services.worker.FileDatabase"),
            patch("nola.services.worker.TaskDatabase", return_value=task_db),
            patch(
                "nola.services.worker.AppConfigDatabase",
                return_value=config_store,
            ),
            patch(
                "nola.services.worker.build_desired_engine_state",
                side_effect=[
                    _desired_state(first_fingerprint),
                    _desired_state(second_fingerprint),
                ],
            ),
            patch(
                "nola.services.worker.assert_engine_model_downloaded",
            ) as assert_downloaded,
            patch(
                "nola.services.worker.release_loaded_engine",
            ) as release_engine,
            patch(
                "nola.services.worker.ensure_engine_loaded",
                side_effect=[first_state, second_state],
            ) as ensure_loaded,
            patch("nola.services.worker.run_transcription"),
        ):
            started = worker_module.worker_loop(tmp_path / "nola.db")

        assert started is True
        assert_downloaded.assert_called_once_with(_desired_state(second_fingerprint))
        release_engine.assert_called_once_with(first_state)
        assert ensure_loaded.call_args_list[1].kwargs["loaded"] is None

    def test_worker_loop_fails_task_on_unexpected_engine_error(
        self, tmp_path: Path
    ) -> None:
        """Fail the dequeued task when engine preparation raises unexpectedly."""
        task = _raw_task()
        task_db = Mock()
        task_db.dequeue.side_effect = [task, KeyboardInterrupt]

        with (
            patch.object(worker_module, "_running", True),
            patch("nola.services.worker.FileDatabase"),
            patch("nola.services.worker.TaskDatabase", return_value=task_db),
            patch("nola.services.worker.AppConfigDatabase", return_value=Mock()),
            patch(
                "nola.services.worker.build_desired_engine_state",
                side_effect=RuntimeError("config unavailable"),
            ),
            patch("nola.services.worker.ensure_engine_loaded") as ensure_loaded,
            patch("nola.services.worker.run_transcription") as run_transcription,
        ):
            started = worker_module.worker_loop(tmp_path / "nola.db")

        assert started is True
        ensure_loaded.assert_not_called()
        task_db.fail.assert_called_once_with(
            "task-1",
            "Unexpected worker engine error: config unavailable",
            should_retry=True,
        )
        run_transcription.assert_not_called()

    def test_worker_loop_fails_task_when_engine_load_fails(
        self, tmp_path: Path
    ) -> None:
        """Fail only the current task when engine loading is invalid."""
        task = _raw_task()
        task_db = Mock()
        task_db.dequeue.side_effect = [task, KeyboardInterrupt]

        with (
            patch.object(worker_module, "_running", True),
            patch("nola.services.worker.FileDatabase"),
            patch("nola.services.worker.TaskDatabase", return_value=task_db),
            patch("nola.services.worker.AppConfigDatabase", return_value=Mock()),
            patch(
                "nola.services.worker.build_desired_engine_state",
                return_value=_desired_state(
                    EngineFingerprint(
                        model_id="small",
                        model_dir=tmp_path,
                        device="cpu",
                        compute_type="default",
                    )
                ),
            ),
            patch(
                "nola.services.worker.ensure_engine_loaded",
                side_effect=WorkerEngineError("bad engine", should_retry=False),
            ),
            patch("nola.services.worker.run_transcription") as run_transcription,
        ):
            started = worker_module.worker_loop(tmp_path / "nola.db")

        assert started is True
        task_db.fail.assert_called_once_with(
            "task-1",
            "bad engine",
            should_retry=False,
        )
        run_transcription.assert_not_called()

    def test_main_exits_non_zero_when_worker_startup_fails(self) -> None:
        """Exit with a failure status when the worker loop reports failure."""
        with (
            patch("nola.services.worker.init_db"),
            patch("nola.services.worker.worker_loop", return_value=False),
            patch("nola.services.worker.signal.signal"),
            patch("nola.services.worker.logging.basicConfig"),
            pytest.raises(SystemExit, match="1"),
        ):
            worker_module.main()
