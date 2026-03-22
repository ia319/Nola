"""Tests for export filename helpers."""

from pathlib import Path

from nola.config.export.filenames import write_unique_export_text


class TestExportFilenameHelpers:
    """Test filename reservation and write behaviors."""

    def test_write_unique_export_text_uses_requested_name_when_available(
        self, tmp_path
    ):
        """First write should use requested filename without suffix."""
        exports_dir = tmp_path / "exports"
        exports_dir.mkdir(parents=True, exist_ok=True)

        written_path = write_unique_export_text(
            exports_dir,
            "meeting-notes.srt",
            "line one",
        )

        assert written_path.name == "meeting-notes.srt"
        assert written_path.read_text(encoding="utf-8") == "line one"

    def test_write_unique_export_text_appends_suffix_on_collision(self, tmp_path):
        """Second write should use suffixed filename when name already exists."""
        exports_dir = tmp_path / "exports"
        exports_dir.mkdir(parents=True, exist_ok=True)

        first = write_unique_export_text(exports_dir, "meeting-notes.srt", "first")
        second = write_unique_export_text(exports_dir, "meeting-notes.srt", "second")

        assert first.name == "meeting-notes.srt"
        assert second.name == "meeting-notes_1.srt"
        assert first.read_text(encoding="utf-8") == "first"
        assert second.read_text(encoding="utf-8") == "second"

    def test_write_unique_export_text_recovers_from_race(self, monkeypatch, tmp_path):
        """Exclusive-create retry should recover when first candidate is taken."""
        exports_dir = tmp_path / "exports"
        exports_dir.mkdir(parents=True, exist_ok=True)

        original_open = Path.open
        first_attempt = {"raised": False}

        def flaky_open(path: Path, mode: str = "r", *args, **kwargs):
            if (
                mode == "x"
                and path.name == "meeting-notes.srt"
                and not first_attempt["raised"]
            ):
                first_attempt["raised"] = True
                raise FileExistsError
            return original_open(path, mode, *args, **kwargs)

        monkeypatch.setattr(Path, "open", flaky_open)

        written_path = write_unique_export_text(
            exports_dir, "meeting-notes.srt", "content"
        )

        assert written_path.name == "meeting-notes_1.srt"
        assert written_path.read_text(encoding="utf-8") == "content"
