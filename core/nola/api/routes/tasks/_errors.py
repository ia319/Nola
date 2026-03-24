"""Map task use-case errors into HTTP exceptions."""

from typing import NoReturn

from fastapi import HTTPException

from nola.application.tasks.errors import TaskUseCaseError


def raise_http_error(error: TaskUseCaseError) -> NoReturn:
    """Raise an HTTPException from a use-case error."""
    raise HTTPException(status_code=error.status_code, detail=error.detail) from error
