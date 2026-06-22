"""Command line launcher for packaged Nola Core runtimes."""

from __future__ import annotations

import argparse
import multiprocessing
import os
from collections.abc import MutableMapping, Sequence
from pathlib import Path
from typing import cast

CONTROLLED_NOLA_ENV = (
    "NOLA_COMPUTE_TYPE",
    "NOLA_CORS_ORIGINS",
    "NOLA_DATA_DIR",
    "NOLA_DEVICE",
    "NOLA_HOST",
    "NOLA_LIVE_REALTIME_TRANSCRIBER",
    "NOLA_MAX_FILE_SIZE",
    "NOLA_MODEL_DIR",
    "NOLA_MODEL_SIZE",
    "NOLA_PORT",
)


def _path_arg(value: str) -> Path:
    return Path(value).expanduser()


def _port_arg(value: str) -> int:
    try:
        port = int(value, 10)
    except ValueError as exc:
        raise argparse.ArgumentTypeError("port must be an integer") from exc

    if port < 1 or port > 65535:
        raise argparse.ArgumentTypeError("port must be between 1 and 65535")
    return port


def _add_runtime_arguments(parser: argparse.ArgumentParser) -> None:
    parser.add_argument(
        "--ignore-system-env",
        action="store_true",
        help="Ignore inherited NOLA_* process environment values.",
    )
    parser.add_argument("--data-dir", type=_path_arg)
    parser.add_argument("--model-dir", type=_path_arg)
    parser.add_argument("--cors-origins")
    parser.add_argument(
        "--live-realtime-transcriber",
        choices=("mock", "whisper_streaming"),
    )


def build_parser() -> argparse.ArgumentParser:
    """Build the nola-core command line parser."""
    parser = argparse.ArgumentParser(prog="nola-core")
    subparsers = parser.add_subparsers(dest="command", required=True)

    api_parser = subparsers.add_parser("api")
    _add_runtime_arguments(api_parser)
    api_parser.add_argument("--host")
    api_parser.add_argument("--port", type=_port_arg)
    api_parser.add_argument(
        "--log-level",
        choices=("critical", "error", "warning", "info", "debug", "trace"),
        default="info",
    )

    worker_parser = subparsers.add_parser("worker")
    _add_runtime_arguments(worker_parser)

    return parser


def _namespace_bool(args: argparse.Namespace, name: str) -> bool:
    value = vars(args).get(name, False)
    if isinstance(value, bool):
        return value
    msg = f"{name} must be a boolean parser value"
    raise TypeError(msg)


def _namespace_value(args: argparse.Namespace, name: str) -> object | None:
    return cast(object | None, vars(args).get(name))


def _namespace_command(args: argparse.Namespace) -> str:
    value = vars(args).get("command")
    if isinstance(value, str):
        return value
    msg = "command must be a string parser value"
    raise TypeError(msg)


def _set_optional_env(
    environ: MutableMapping[str, str],
    key: str,
    value: object | None,
) -> None:
    if value is None:
        return
    environ[key] = str(value)


def apply_runtime_environment(
    args: argparse.Namespace,
    environ: MutableMapping[str, str] | None = None,
) -> None:
    """Apply launcher arguments before importing settings-backed modules."""
    target_environ = os.environ if environ is None else environ

    if _namespace_bool(args, "ignore_system_env"):
        for key in CONTROLLED_NOLA_ENV:
            target_environ.pop(key, None)

    _set_optional_env(
        target_environ, "NOLA_DATA_DIR", _namespace_value(args, "data_dir")
    )
    _set_optional_env(
        target_environ,
        "NOLA_MODEL_DIR",
        _namespace_value(args, "model_dir"),
    )
    _set_optional_env(
        target_environ,
        "NOLA_CORS_ORIGINS",
        _namespace_value(args, "cors_origins"),
    )
    _set_optional_env(
        target_environ,
        "NOLA_LIVE_REALTIME_TRANSCRIBER",
        _namespace_value(args, "live_realtime_transcriber"),
    )
    _set_optional_env(target_environ, "NOLA_HOST", _namespace_value(args, "host"))
    _set_optional_env(target_environ, "NOLA_PORT", _namespace_value(args, "port"))


def run_api(args: argparse.Namespace) -> None:
    """Run the FastAPI server entry point."""
    apply_runtime_environment(args)

    import uvicorn

    from nola.config import settings

    host = _namespace_value(args, "host")
    port = _namespace_value(args, "port")
    log_level = _namespace_value(args, "log_level")
    uvicorn.run(
        "nola.main:app",
        host=host if isinstance(host, str) else settings.host,
        port=port if isinstance(port, int) else settings.port,
        log_level=log_level if isinstance(log_level, str) else "info",
    )


def run_worker(args: argparse.Namespace) -> None:
    """Run the transcription worker entry point."""
    apply_runtime_environment(args)

    from nola.services.worker import main as worker_main

    worker_main()


def main(argv: Sequence[str] | None = None) -> None:
    """Dispatch nola-core subcommands."""
    multiprocessing.freeze_support()

    parser = build_parser()
    args = parser.parse_args(argv)
    command = _namespace_command(args)

    if command == "api":
        run_api(args)
        return
    if command == "worker":
        run_worker(args)
        return

    parser.error(f"unsupported command: {command}")


if __name__ == "__main__":
    main()
