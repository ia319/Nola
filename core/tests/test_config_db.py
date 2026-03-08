"""Pytest tests for the application configuration database."""

import gc
import sqlite3
import tempfile
from pathlib import Path

import pytest

from nola.models import AppConfigDatabase, init_db


@pytest.fixture
def config_db():
    """Create an isolated app config database backed by a temporary SQLite file."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "test.db"

        init_db(db_path)
        store = AppConfigDatabase(db_path)

        try:
            yield store, db_path
        finally:
            gc.collect()


class TestAppConfigDatabase:
    """Test app configuration persistence operations."""

    def test_init_db_creates_app_config_table(self, config_db):
        """init_db() should add the app_config table to the schema."""
        _, db_path = config_db

        with sqlite3.connect(db_path) as conn:
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

        assert written == [
            "transcription.beam_size",
            "transcription.vad_filter",
            "transcription.temperature",
            "transcription.vad_parameters",
            "transcription.initial_prompt",
        ]
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
