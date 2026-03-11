"""Shared deep-merge helper for configuration dictionaries."""

from __future__ import annotations

from typing import Any


def deep_merge(base: dict[str, Any], overrides: dict[str, Any]) -> dict[str, Any]:
    """Merge nested config overrides without discarding untouched subkeys.

    This is a plain recursive merge. Keys present in *overrides* replace or
    extend matching keys in *base*; keys absent from *overrides* are kept
    as-is. ``None`` values are treated as regular values and written through.

    For PATCH-style semantics where ``None`` means "remove the key", use the
    dedicated ``_apply_override_patch`` in the config route module instead.
    """
    result = dict(base)
    for key, value in overrides.items():
        current = result.get(key)
        if isinstance(current, dict) and isinstance(value, dict):
            result[key] = deep_merge(current, value)
        else:
            result[key] = value
    return result
