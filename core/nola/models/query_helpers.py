"""Shared SQLite query helper functions."""


def escape_like_fragment(fragment: str) -> str:
    """Escape LIKE wildcards so contains search stays literal."""
    return fragment.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def build_contains_like_pattern(value: str) -> str:
    """Build one escaped case-insensitive contains pattern."""
    return f"%{escape_like_fragment(value.lower())}%"
