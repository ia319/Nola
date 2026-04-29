"""Application-layer errors for model use-cases."""

from __future__ import annotations


class ModelUseCaseError(Exception):
    """Carry one stable HTTP-facing model use-case failure."""

    def __init__(self, *, status_code: int, detail: str) -> None:
        self.status_code = status_code
        self.detail = detail
        super().__init__(detail)
