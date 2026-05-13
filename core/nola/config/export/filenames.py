"""Filename helpers for transcription export endpoints."""

from __future__ import annotations

import re
from datetime import datetime
from pathlib import Path
from urllib.parse import quote

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


def build_download_content_disposition(filename: str) -> str:
    """Build a safe attachment header while preserving the UTF-8 filename."""
    extension = Path(filename).suffix.lstrip(".") or "txt"
    ascii_name = filename.encode("ascii", "ignore").decode()
    ascii_name = re.sub(r"[^A-Za-z0-9._-]", "_", ascii_name)
    if not ascii_name or ascii_name.startswith("."):
        ascii_name = f"export.{extension}"
    return f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{quote(filename)}"


def build_export_archive_filename(
    *,
    requested_name: str | None,
    fallback_prefix: str,
) -> str:
    """Build a safe ZIP archive filename for batch export downloads."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    if requested_name:
        safe_name = re.sub(r'[\r\n/\\"]', "", requested_name).strip()
        if safe_name.lower().endswith(".zip"):
            safe_name = safe_name[:-4].strip()
        return f"{safe_name}.zip" if safe_name else f"{fallback_prefix}_{timestamp}.zip"
    return f"{fallback_prefix}_{timestamp}.zip"


def reserve_unique_export_filename(candidate: str, used_names: set[str]) -> str:
    """Return a non-conflicting filename within one archive."""
    stem = Path(candidate).stem
    suffix = Path(candidate).suffix
    unique_name = candidate
    counter = 1
    while unique_name in used_names:
        unique_name = f"{stem}_{counter}{suffix}"
        counter += 1
    used_names.add(unique_name)
    return unique_name


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


def write_unique_export_text(directory: Path, filename: str, content: str) -> Path:
    """Write text to a unique filename using atomic exclusive create."""
    stem = Path(filename).stem
    suffix = Path(filename).suffix

    counter = 0
    while True:
        candidate_name = filename if counter == 0 else f"{stem}_{counter}{suffix}"
        candidate = directory / candidate_name
        try:
            with candidate.open("x", encoding="utf-8") as handle:
                handle.write(content)
            return candidate
        except FileExistsError:
            counter += 1
