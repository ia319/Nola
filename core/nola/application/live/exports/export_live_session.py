"""Single-live-session export use-case."""

from fastapi.responses import JSONResponse, Response

from nola.application.live.contracts import SupportsLiveRepository
from nola.application.live.errors import LiveUseCaseError
from nola.application.live.exports.export_common import (
    build_live_download_response,
    build_live_export_filename,
    build_live_segment_data,
    require_live_export_session,
)
from nola.config import settings
from nola.config.export import (
    ExportFormat,
    resolve_export_options,
    write_unique_export_text,
)
from nola.models import AppConfigDatabase
from nola.services.formatters import get_formatter


def export_live_session(
    *,
    live_store: SupportsLiveRepository,
    config_store: AppConfigDatabase,
    session_id: str,
    requested_format: ExportFormat | None,
    requested_include_timestamps: bool | None,
    requested_filename: str | None,
    save: bool,
) -> Response:
    """Export a finished live session as subtitle text or persisted file path."""
    session = require_live_export_session(live_store, session_id)
    segments = live_store.list_final_segments(session_id)
    if not segments:
        raise LiveUseCaseError(status_code=400, detail="No final segments available")

    try:
        effective_format, effective_include_timestamps = resolve_export_options(
            config_store=config_store,
            requested_format=requested_format,
            requested_include_timestamps=requested_include_timestamps,
        )
        formatter = get_formatter(
            effective_format,
            include_timestamps=effective_include_timestamps,
        )
    except (ValueError, KeyError) as error:
        raise LiveUseCaseError(
            status_code=500,
            detail="Invalid export formatter configuration",
        ) from error

    content = formatter.format(build_live_segment_data(segments))
    export_filename = build_live_export_filename(
        session=session,
        requested_name=requested_filename,
        extension=formatter.file_extension,
    )

    if save:
        try:
            settings.exports_dir.mkdir(parents=True, exist_ok=True)
            export_path = write_unique_export_text(
                settings.exports_dir,
                export_filename,
                content,
            )
        except (OSError, UnicodeError) as error:
            raise LiveUseCaseError(
                status_code=500,
                detail="Failed to save export file",
            ) from error
        return JSONResponse(content={"saved_path": f"exports/{export_path.name}"})

    return build_live_download_response(
        content=content,
        filename=export_filename,
        media_type=formatter.content_type,
    )
