"""Provide pytest configuration and fixtures."""

import pytest


@pytest.fixture
def test_audio_path(tmp_path):
    """Create a temporary test audio file path."""
    return tmp_path / "test_audio.mp3"
