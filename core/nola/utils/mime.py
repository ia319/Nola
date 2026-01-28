"""MIME type utilities."""

from pathlib import Path

# Extension to MIME type mapping
EXT_TO_MIME = {
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".flac": "audio/flac",
    ".m4a": "audio/mp4",
    ".ogg": "audio/ogg",
    ".webm": "audio/webm",
    ".aac": "audio/aac",
    ".mp4": "video/mp4",
    ".wma": "audio/x-ms-wma",
}


def infer_content_type(filename: str) -> str:
    """Infer MIME type from filename extension."""
    ext = Path(filename).suffix.lower()
    return EXT_TO_MIME.get(ext, "application/octet-stream")
