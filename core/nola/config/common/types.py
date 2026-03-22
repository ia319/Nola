"""Shared type aliases for configuration payloads."""

from typing import TypeAlias

from nola.common.types import JsonDict, JsonValue

ConfigValue: TypeAlias = JsonValue
ConfigMap: TypeAlias = JsonDict
