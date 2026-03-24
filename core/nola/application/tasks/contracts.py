"""Declare task use-case contracts for W1 migration.

Keep this module as a stable import target while route logic migrates
from API handlers into application services.
"""

from typing import Protocol


class SupportsTaskActions(Protocol):
    """Define high-level task actions expected by route handlers."""

    # Add concrete method signatures in W1 implementation.
    pass
