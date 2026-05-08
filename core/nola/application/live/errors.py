"""Define typed application-layer errors for live use-cases."""

from typing import TypeAlias

LiveUseCaseErrorDetail: TypeAlias = str | dict[str, str]


class LiveUseCaseError(Exception):
    """Carry HTTP-compatible error details for route mapping."""

    def __init__(self, *, status_code: int, detail: LiveUseCaseErrorDetail) -> None:
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail
