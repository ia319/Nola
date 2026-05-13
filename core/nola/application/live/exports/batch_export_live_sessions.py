"""Batch-live-session export use-case."""

import io
import logging
import zipfile
from dataclasses import dataclass

from nola.application.live.contracts import SupportsLiveRepository
from nola.application.live.errors import LiveUseCaseError
from nola.application.live.exports.export_common import (
    build_live_export_filename,
    build_live_segment_data,
)
from nola.config.export import (
    ExportFormat,
    build_export_archive_filename,
    reserve_unique_export_filename,
    resolve_export_options,
)
from nola.models import AppConfigDatabase
from nola.services.formatters import get_formatter

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class LiveBatchExportArchive:
    """Framework-agnostic Live batch export payload."""

    data: bytes
    filename: str
    media_type: str = "application/zip"


def batch_export_live_sessions(
    *,
    live_store: SupportsLiveRepository,
    config_store: AppConfigDatabase,
    session_ids: list[str],
    requested_format: ExportFormat | None,
    requested_include_timestamps: bool | None,
    zip_name: str | None,
) -> LiveBatchExportArchive:
    """Export multiple finished live sessions into a ZIP archive."""
    zip_buffer = io.BytesIO()
    errors: list[dict[str, str]] = []
    used_names: set[str] = set()
    success_count = 0

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

    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        for session_id in session_ids:
            try:
                session = live_store.get_session(session_id)
                if session is None:
                    errors.append({"session_id": session_id, "reason": "not_found"})
                    continue
                if session["status"] != "finished":
                    errors.append(
                        {
                            "session_id": session_id,
                            "reason": f"status_{session['status']}",
                        }
                    )
                    continue

                segments = live_store.list_final_segments(session_id)
                if not segments:
                    errors.append(
                        {"session_id": session_id, "reason": "no_final_segments"}
                    )
                    continue

                content = formatter.format(build_live_segment_data(segments))
                filename = build_live_export_filename(
                    session=session,
                    requested_name=None,
                    extension=formatter.file_extension,
                )
                archive.writestr(
                    reserve_unique_export_filename(filename, used_names),
                    content,
                )
                success_count += 1
            except Exception:
                logger.exception("Error exporting live session %s", session_id)
                errors.append({"session_id": session_id, "reason": "internal_error"})

        if errors:
            lines = [f"{item['session_id']}: {item['reason']}" for item in errors]
            archive.writestr(
                reserve_unique_export_filename("_errors.txt", used_names),
                "\n".join(lines),
            )

    if success_count == 0 and errors:
        status_code = (
            500 if any(error["reason"] == "internal_error" for error in errors) else 400
        )
        raise LiveUseCaseError(
            status_code=status_code,
            detail=f"All {len(errors)} live exports failed",
        )

    zip_buffer.seek(0)
    return LiveBatchExportArchive(
        data=zip_buffer.getvalue(),
        filename=build_export_archive_filename(
            requested_name=zip_name,
            fallback_prefix="live_export",
        ),
    )
