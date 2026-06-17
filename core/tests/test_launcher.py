"""Tests for the packaged Nola Core launcher."""

from pathlib import Path

import pytest

from nola.launcher import apply_runtime_environment, build_parser


def test_runtime_environment_ignores_controlled_system_values() -> None:
    """Desktop sidecar mode should use explicit launcher values only."""
    parser = build_parser()
    args = parser.parse_args(
        [
            "api",
            "--ignore-system-env",
            "--data-dir",
            "portable/data",
            "--model-dir",
            "portable/models",
            "--host",
            "127.0.0.1",
            "--port",
            "9123",
            "--cors-origins",
            "http://localhost:5173",
            "--live-realtime-transcriber",
            "whisper_streaming",
        ]
    )
    environ = {
        "NOLA_CORS_ORIGINS": "http://old.example",
        "NOLA_DATA_DIR": "system-data",
        "NOLA_HOST": "0.0.0.0",
        "NOLA_LIVE_REALTIME_TRANSCRIBER": "mock",
        "NOLA_MODEL_DIR": "system-models",
        "NOLA_PORT": "8000",
        "NOLA_UNRELATED": "kept",
    }

    apply_runtime_environment(args, environ)

    assert environ["NOLA_CORS_ORIGINS"] == "http://localhost:5173"
    assert environ["NOLA_DATA_DIR"] == str(Path("portable/data"))
    assert environ["NOLA_HOST"] == "127.0.0.1"
    assert environ["NOLA_LIVE_REALTIME_TRANSCRIBER"] == "whisper_streaming"
    assert environ["NOLA_MODEL_DIR"] == str(Path("portable/models"))
    assert environ["NOLA_PORT"] == "9123"
    assert environ["NOLA_UNRELATED"] == "kept"


def test_runtime_environment_preserves_system_values_without_isolation() -> None:
    """Standalone backend mode should keep the ordinary NOLA_* environment."""
    parser = build_parser()
    args = parser.parse_args(["worker"])
    environ = {
        "NOLA_DATA_DIR": "system-data",
        "NOLA_MODEL_DIR": "system-models",
    }

    apply_runtime_environment(args, environ)

    assert environ["NOLA_DATA_DIR"] == "system-data"
    assert environ["NOLA_MODEL_DIR"] == "system-models"


def test_parser_rejects_invalid_port() -> None:
    """API port must stay within the TCP port range."""
    parser = build_parser()

    with pytest.raises(SystemExit):
        parser.parse_args(["api", "--port", "70000"])
