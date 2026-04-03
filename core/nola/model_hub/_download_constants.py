"""Shared constants for managed model downloads."""

from __future__ import annotations

DOWNLOAD_ALLOW_PATTERNS = (
    "config.json",
    "preprocessor_config.json",
    "model.bin",
    "tokenizer.json",
    "vocabulary.*",
)

__all__ = ["DOWNLOAD_ALLOW_PATTERNS"]
