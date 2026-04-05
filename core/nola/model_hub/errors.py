"""Model-hub error types."""

from __future__ import annotations


class ModelHubError(Exception):
    """Base exception for model-management failures."""


class ModelHubDependencyError(ModelHubError):
    """Raise when one required runtime dependency is unavailable."""

    def __init__(self, dependency_name: str) -> None:
        """Store the missing dependency name and build a stable message."""
        self.dependency_name = dependency_name
        super().__init__(f"Missing required dependency: {dependency_name}")


class UnknownModelError(ModelHubError):
    """Raise when a model id is not part of the supported registry."""

    def __init__(self, model_id: str) -> None:
        """Store the missing model id and build a stable message."""
        self.model_id = model_id
        super().__init__(f"Unknown model id: {model_id}")


class InvalidModelDirectoryError(ModelHubError):
    """Raise when a configured model cache directory is invalid."""

    def __init__(self, detail: str) -> None:
        """Store the stable validation failure message."""
        self.detail = detail
        super().__init__(detail)


class ModelNotDownloadedError(ModelHubError):
    """Raise when one repository is absent from the local cache."""

    def __init__(self, repo_id: str) -> None:
        """Store the missing repository id and build a stable message."""
        self.repo_id = repo_id
        super().__init__(f"Model is not downloaded: {repo_id}")


class ModelAlreadyDownloadingError(ModelHubError):
    """Raise when one model already has an active download task."""

    def __init__(self, model_id: str) -> None:
        """Store the conflicting model id and build a stable message."""
        self.model_id = model_id
        super().__init__(f"Model is already downloading: {model_id}")


class ModelDownloadNotFoundError(ModelHubError):
    """Raise when one model has no active download task to control."""

    def __init__(self, model_id: str) -> None:
        """Store the missing model id and build a stable message."""
        self.model_id = model_id
        super().__init__(f"Active download not found: {model_id}")


class ModelDownloadFailedError(ModelHubError):
    """Raise when one download worker exits with a terminal error."""

    def __init__(self, model_id: str, detail: str) -> None:
        """Store the model id and terminal failure detail."""
        self.model_id = model_id
        self.detail = detail
        super().__init__(f"Model download failed for {model_id}: {detail}")
