"""Patch helpers for configuration override payloads."""

from __future__ import annotations

from nola.config.common.types import ConfigMap


def apply_override_patch(
    current_overrides: ConfigMap,
    patch_values: ConfigMap,
) -> ConfigMap:
    """Apply PATCH semantics where explicit null removes an override key."""
    merged = dict(current_overrides)

    for key, value in patch_values.items():
        if value is None:
            merged.pop(key, None)
            continue

        existing = merged.get(key)
        if isinstance(existing, dict) and isinstance(value, dict):
            nested = apply_override_patch(existing, value)
            if nested:
                merged[key] = nested
            else:
                merged.pop(key, None)
            continue

        if isinstance(value, dict):
            nested = apply_override_patch({}, value)
            if nested:
                merged[key] = nested
            else:
                merged.pop(key, None)
            continue

        merged[key] = value

    return merged
