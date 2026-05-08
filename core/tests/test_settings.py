"""Test application settings validation."""

import pytest
from pydantic import ValidationError

from nola.config.settings import Settings


def test_live_realtime_transcriber_accepts_supported_modes() -> None:
    mock_settings = Settings(live_realtime_transcriber="mock")

    assert mock_settings.live_realtime_transcriber == "mock"
    assert (
        Settings(
            live_realtime_transcriber="whisper_streaming"
        ).live_realtime_transcriber
        == "whisper_streaming"
    )


def test_live_realtime_transcriber_normalizes_string_input() -> None:
    settings = Settings(live_realtime_transcriber=" WHISPER_STREAMING ")

    assert settings.live_realtime_transcriber == "whisper_streaming"


def test_live_realtime_transcriber_rejects_unknown_mode() -> None:
    with pytest.raises(ValidationError):
        Settings(live_realtime_transcriber="unknown")
