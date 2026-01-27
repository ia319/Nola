"""Shared constants for Nola application."""

from pathlib import Path

# Data directories
DATA_DIR = Path("data")
UPLOAD_DIR = DATA_DIR / "uploads"
DB_PATH = DATA_DIR / "nola.db"

# File upload limits
MAX_FILE_SIZE = 500 * 1024 * 1024  # 500 MB
ALLOWED_AUDIO_TYPES = {
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/x-wav",
    "audio/flac",
    "audio/x-flac",
    "audio/mp4",
    "audio/m4a",
    "audio/x-m4a",
    "audio/ogg",
    "audio/webm",
    "audio/aac",
    "video/mp4",  # Some audio files are labeled as video/mp4
}
ALLOWED_EXTENSIONS = {".mp3", ".wav", ".flac", ".m4a", ".ogg", ".webm", ".aac", ".mp4"}
