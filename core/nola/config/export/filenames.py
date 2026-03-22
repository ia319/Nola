"""Filename helpers for transcription export endpoints."""

from __future__ import annotations

import re
from pathlib import Path

_INVALID_FILENAME_CHARS_PATTERN = re.compile(r'[<>:"/\\|?*\x00-\x1F]')


def _sanitize_export_stem(raw_name: str | None) -> str | None:
    """Normalize user-provided export filename into a safe basename."""
    if raw_name is None:
        return None

    stripped = raw_name.strip()
    if not stripped:
        return None

    # Ignore directory segments to prevent path traversal via filename input.
    leaf = stripped.replace("\\", "/").rsplit("/", maxsplit=1)[-1]
    stem = Path(leaf).stem
    normalized = _INVALID_FILENAME_CHARS_PATTERN.sub("_", stem).strip().strip(".")

    if not normalized:
        return None

    return normalized


def build_export_filename(
    *,
    requested_name: str | None,
    fallback_name: str,
    extension: str,
) -> str:
    """Build final export filename with a fixed extension."""
    fallback_stem = _sanitize_export_stem(fallback_name) or "export"
    preferred_stem = _sanitize_export_stem(requested_name)
    final_stem = preferred_stem or fallback_stem
    normalized_extension = extension.lstrip(".")
    return f"{final_stem}.{normalized_extension}"


def resolve_unique_export_path(directory: Path, filename: str) -> Path:
    """Return a non-conflicting file path by appending numeric suffix when needed."""
    candidate = directory / filename
    if not candidate.exists():
        return candidate

    stem = Path(filename).stem
    suffix = Path(filename).suffix

    counter = 1
    while True:
        next_candidate = directory / f"{stem}_{counter}{suffix}"
        if not next_candidate.exists():
            return next_candidate
        counter += 1
