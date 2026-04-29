"""Define typed application-layer errors for file use-cases."""

from nola.application.files.types import FileUseCaseErrorCode


class FileUseCaseError(Exception):
    """Carry HTTP-compatible error details for route mapping."""

    def __init__(
        self,
        *,
        status_code: int,
        detail: str,
        error_code: FileUseCaseErrorCode,
    ) -> None:
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail
        self.error_code = error_code
