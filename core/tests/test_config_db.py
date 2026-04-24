"""Pytest tests for the application configuration database."""

import sqlite3
import tempfile
from contextlib import closing
from pathlib import Path

import pytest

from nola.config import settings
from nola.models import AppConfigDatabase, init_db


@pytest.fixture
def config_db():
    """Create an isolated app config database backed by a temporary SQLite file."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "test.db"

        init_db(db_path)
        store = AppConfigDatabase(db_path)

        yield store, db_path


class TestAppConfigDatabase:
    """Test app configuration persistence operations."""

    def test_default_db_path_matches_settings(self):
        """Default construction should follow the application database path."""
        store = AppConfigDatabase()

        assert store.db_path == settings.db_path

    def test_init_db_creates_app_config_table(self, config_db):
        """init_db() should add the app_config table to the schema."""
        _, db_path = config_db

        with closing(sqlite3.connect(db_path)) as conn:
            row = conn.execute(
                "SELECT name FROM sqlite_master "
                "WHERE type = 'table' AND name = 'app_config'"
            ).fetchone()

        assert row is not None

    def test_get_all_returns_empty_dict_for_missing_prefix(self, config_db):
        """get_all() should return an empty mapping when no keys match."""
        store, _ = config_db

        assert store.get_all("transcription.") == {}

    def test_set_many_and_get_all_round_trip_scalars_and_nested_values(self, config_db):
        """set_many() should preserve JSON-compatible scalar and nested values."""
        store, _ = config_db

        written = store.set_many(
            "transcription.",
            {
                "beam_size": 3,
                "vad_filter": True,
                "temperature": [0.0, 0.2, 0.4],
                "vad_parameters": {
                    "threshold": 0.6,
                    "min_silence_duration_ms": 1500,
                },
                "initial_prompt": None,
            },
        )

        assert set(written) == {
            "transcription.beam_size",
            "transcription.vad_filter",
            "transcription.temperature",
            "transcription.vad_parameters",
            "transcription.initial_prompt",
        }
        assert store.get_all("transcription.") == {
            "beam_size": 3,
            "vad_filter": True,
            "temperature": [0.0, 0.2, 0.4],
            "vad_parameters": {
                "threshold": 0.6,
                "min_silence_duration_ms": 1500,
            },
            "initial_prompt": None,
        }

    def test_get_all_filters_by_prefix_and_returns_unprefixed_keys(self, config_db):
        """get_all() should scope results to the requested prefix only."""
        store, _ = config_db

        store.set_many("transcription.", {"beam_size": 5, "vad_filter": False})
        store.set_many("ui.", {"language": "zh-CN"})

        assert store.get_all("transcription.") == {
            "beam_size": 5,
            "vad_filter": False,
        }
        assert store.get_all("ui.") == {"language": "zh-CN"}

    def test_set_many_overwrites_existing_values(self, config_db):
        """set_many() should upsert existing keys without clearing untouched keys."""
        store, _ = config_db

        store.set_many("transcription.", {"beam_size": 5, "vad_filter": False})
        store.set_many("transcription.", {"beam_size": 3})

        assert store.get_all("transcription.") == {
            "beam_size": 3,
            "vad_filter": False,
        }

    def test_delete_all_removes_only_matching_prefix(self, config_db):
        """delete_all() should leave keys outside the prefix untouched."""
        store, _ = config_db

        store.set_many("transcription.", {"beam_size": 5, "vad_filter": False})
        store.set_many("ui.", {"language": "en"})

        deleted = store.delete_all("transcription.")

        assert deleted == 2
        assert store.get_all("transcription.") == {}
        assert store.get_all("ui.") == {"language": "en"}

    def test_replace_many_rewrites_only_target_prefix(self, config_db):
        """replace_many() should rewrite one prefix without touching others."""
        store, _ = config_db

        store.set_many(
            "transcription.",
            {
                "beam_size": 5,
                "vad_parameters": {"threshold": 0.6},
            },
        )
        store.set_many("ui.", {"language": "en"})

        written = store.replace_many(
            "transcription.",
            {
                "vad_parameters": {"speech_pad_ms": 500},
            },
        )

        assert written == ["transcription.vad_parameters"]
        assert store.get_all("transcription.") == {
            "vad_parameters": {"speech_pad_ms": 500}
        }
        assert store.get_all("ui.") == {"language": "en"}

    def test_patch_many_applies_partial_updates_without_prefix_rewrite(self, config_db):
        """patch_many() should update and delete without clearing untouched keys."""
        store, _ = config_db

        store.set_many(
            "export.",
            {
                "format": "srt",
                "include_timestamps": True,
            },
        )
        store.set_many("ui.", {"language": "en"})

        touched = store.patch_many(
            "export.",
            {
                "format": "vtt",
                "include_timestamps": None,
            },
        )

        assert set(touched) == {"export.format", "export.include_timestamps"}
        assert store.get_all("export.") == {"format": "vtt"}
        assert store.get_all("ui.") == {"language": "en"}

    def test_patch_many_prefixes_applies_updates_across_prefixes(self, config_db):
        """patch_many_prefixes() should patch related prefixes together."""
        store, _ = config_db

        store.set_many("ui.", {"language": "en"})

        touched = store.patch_many_prefixes(
            {
                "model.": {"configured_model_id": "medium"},
                "execution.": {
                    "device": "cuda",
                    "compute_type": "float16",
                },
            }
        )

        assert set(touched) == {
            "model.configured_model_id",
            "execution.device",
            "execution.compute_type",
        }
        assert store.get_all("model.") == {"configured_model_id": "medium"}
        assert store.get_all("execution.") == {
            "device": "cuda",
            "compute_type": "float16",
        }
        assert store.get_all("ui.") == {"language": "en"}

    def test_patch_many_prefixes_rolls_back_on_error(self, config_db):
        """patch_many_prefixes() should leave all prefixes unchanged on failure."""
        store, db_path = config_db

        store.set_many("model.", {"configured_model_id": "small"})
        store.set_many("execution.", {"device": "cpu"})
        with closing(sqlite3.connect(db_path)) as conn:
            conn.execute("""
                CREATE TRIGGER fail_execution_device_update
                BEFORE UPDATE ON app_config
                WHEN NEW.key = 'execution.device'
                BEGIN
                    SELECT RAISE(ABORT, 'forced rollback');
                END
            """)
            conn.commit()

        with pytest.raises(sqlite3.IntegrityError, match="forced rollback"):
            store.patch_many_prefixes(
                {
                    "model.": {"configured_model_id": "medium"},
                    "execution.": {"device": "cuda"},
                }
            )

        assert store.get_all("model.") == {"configured_model_id": "small"}
        assert store.get_all("execution.") == {"device": "cpu"}
