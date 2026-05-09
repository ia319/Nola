"""Define typed application-layer errors for live use-cases."""

from typing import TypeAlias

LiveUseCaseErrorDetail: TypeAlias = str | dict[str, str]


class LiveUseCaseError(Exception):
    """Carry HTTP-compatible error details for route mapping."""

    def __init__(self, *, status_code: int, detail: LiveUseCaseErrorDetail) -> None:
        message = (
            detail
            if isinstance(detail, str)
            else "; ".join(f"{key}: {value}" for key, value in detail.items())
        )
        super().__init__(message)
        self.status_code = status_code
        self.detail = detail
