"""Single-task export use-case."""

import re
from urllib.parse import quote

from fastapi.responses import JSONResponse, Response

from nola.application.tasks.contracts import SupportsFileQueries, SupportsTaskQueries
from nola.application.tasks.errors import TaskUseCaseError
from nola.application.tasks.exports.export_common import resolve_export_options
from nola.config import settings
from nola.config.export import (
    ExportFormat,
    build_export_filename,
    write_unique_export_text,
)
from nola.models import AppConfigDatabase
from nola.models.tasks import TaskStatus
from nola.services.formatters import SegmentData, get_formatter


def export_task(
    *,
    task_store: SupportsTaskQueries,
    file_store: SupportsFileQueries,
    config_store: AppConfigDatabase,
    task_id: str,
    requested_format: ExportFormat | None,
    requested_include_timestamps: bool | None,
    requested_filename: str | None,
    save: bool,
) -> Response:
    """Export a completed task as subtitle text or persisted file path."""
    task = task_store.get_task(task_id)
    if task is None:
        raise TaskUseCaseError(status_code=404, detail="Task not found")

    if task["status"] != TaskStatus.COMPLETED.value:
        raise TaskUseCaseError(
            status_code=400,
            detail=f"Task not completed, current status: {task['status']}",
        )

    segments = task.get("segments") or []
    if not segments:
        raise TaskUseCaseError(status_code=400, detail="No segments available")

    # Keep fail-fast behavior for data integrity.
    # Future: consider best-effort export with skipped segment warnings.
    segment_data: list[SegmentData] = []
    for index, segment in enumerate(segments):
        try:
            segment_data.append(
                SegmentData(
                    start=segment["start"],
                    end=segment["end"],
                    text=segment["text"],
                )
            )
        except (KeyError, TypeError, ValueError) as error:
            if isinstance(segment, dict):
                context = f"start={segment.get('start')}, end={segment.get('end')}"
            else:
                context = f"raw={segment!r}"
            raise TaskUseCaseError(
                status_code=500,
                detail=(
                    f"Invalid segment[{index}] in task {task_id}: {error}. "
                    f"Data: {context}"
                ),
            ) from error

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
        raise TaskUseCaseError(
            status_code=500,
            detail="Invalid export formatter configuration",
        ) from error
    content = formatter.format(segment_data)

    file_row = file_store.get_file(task["file_id"])
    raw_filename = file_row.get("filename") if file_row else None
    fallback_name = (
        raw_filename
        if isinstance(raw_filename, str) and raw_filename.strip()
        else task_id
    )
    export_filename = build_export_filename(
        requested_name=requested_filename,
        fallback_name=fallback_name,
        extension=formatter.file_extension,
    )

    if save:
        settings.exports_dir.mkdir(parents=True, exist_ok=True)
        export_path = write_unique_export_text(
            settings.exports_dir,
            export_filename,
            content,
        )
        return JSONResponse(content={"saved_path": f"exports/{export_path.name}"})

    # Sanitize for ASCII-safe header value (RFC 6266).
    ascii_name = export_filename.encode("ascii", "ignore").decode()
    ascii_name = re.sub(r"[^A-Za-z0-9._-]", "_", ascii_name)
    if not ascii_name or ascii_name.startswith("."):
        ascii_name = f"export.{formatter.file_extension}"

    return Response(
        content=content,
        media_type=formatter.content_type,
        headers={
            "Content-Disposition": (
                f'attachment; filename="{ascii_name}"; '
                f"filename*=UTF-8''{quote(export_filename)}"
            )
        },
    )
