"""Coordinate model cache mutations that must not overlap."""

from collections.abc import Iterator
from contextlib import contextmanager
from threading import Lock, RLock


class ModelOperationLocks:
    """Provide per-model locks for cache and download mutations."""

    def __init__(self) -> None:
        self._guard = Lock()
        self._locks: dict[str, RLock] = {}

    @contextmanager
    def model(self, model_id: str) -> Iterator[None]:
        """Serialize mutations that target the same canonical model id."""
        with self._guard:
            lock = self._locks.setdefault(model_id, RLock())

        with lock:
            yield
