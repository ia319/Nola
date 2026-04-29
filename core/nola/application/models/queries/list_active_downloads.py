"""List-active-model-downloads use-case."""

from nola.application.models.payloads import build_active_downloads_payload
from nola.application.models.types import ActiveModelDownloadsPayload
from nola.model_hub import ModelDownloaderPort


def list_active_downloads(
    *,
    downloader: ModelDownloaderPort,
) -> ActiveModelDownloadsPayload:
    """Return active model downloads with current speed snapshots."""
    return build_active_downloads_payload(downloader=downloader)
