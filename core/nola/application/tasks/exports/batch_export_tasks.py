"""Batch-export use-case."""

import io
import logging
import zipfile
from dataclasses import dataclass

from nola.application.tasks.contracts import SupportsFileQueries, SupportsTaskQueries
from nola.application.tasks.errors import TaskUseCaseError
from nola.application.tasks.exports.export_common import resolve_export_options
from nola.config.export import (
    ExportFormat,
    build_export_archive_filename,
    build_export_filename,
    reserve_unique_export_filename,
)
from nola.models import AppConfigDatabase
from nola.models.tasks import TaskStatus
from nola.services.formatters import get_formatter
from nola.services.formatters.base import SegmentData

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class BatchExportArchive:
    """Framework-agnostic batch export payload."""

    data: bytes
    filename: str
    media_type: str = "application/zip"


def batch_export_tasks(
    *,
    task_store: SupportsTaskQueries,
    file_store: SupportsFileQueries,
    config_store: AppConfigDatabase,
    task_ids: list[str],
    requested_format: ExportFormat | None,
    requested_include_timestamps: bool | None,
    zip_name: str | None,
) -> BatchExportArchive:
    """Export multiple completed tasks into a ZIP archive."""
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
        raise TaskUseCaseError(
            status_code=500,
            detail="Invalid export formatter configuration",
        ) from error

    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        for task_id in task_ids:
            try:
                task = task_store.get_task(task_id)
                if task is None:
                    errors.append({"task_id": task_id, "reason": "not_found"})
                    continue

                if task["status"] != TaskStatus.COMPLETED.value:
                    errors.append(
                        {"task_id": task_id, "reason": f"status_{task['status']}"}
                    )
                    continue

                segments = task.get("segments") or []
                if not segments:
                    errors.append({"task_id": task_id, "reason": "no_segments"})
                    continue

                segment_data = [
                    SegmentData(start=s["start"], end=s["end"], text=s["text"])
                    for s in segments
                ]
                content = formatter.format(segment_data)

                file_row = file_store.get_file(task["file_id"])
                raw_filename = file_row.get("filename") if file_row else None
                fallback_name = (
                    raw_filename
                    if isinstance(raw_filename, str) and raw_filename.strip()
                    else task_id[:8]
                )
                filename = build_export_filename(
                    requested_name=None,
                    fallback_name=fallback_name,
                    extension=formatter.file_extension,
                )
                filename = reserve_unique_export_filename(filename, used_names)
                archive.writestr(filename, content)
                success_count += 1
            except Exception:
                logger.exception("Error exporting task %s", task_id)
                errors.append(
                    {
                        "task_id": task_id,
                        "reason": "internal_error",
                    }
                )

        if errors:
            lines = [f"{item['task_id']}: {item['reason']}" for item in errors]
            error_report_name = reserve_unique_export_filename(
                "_errors.txt",
                used_names,
            )
            archive.writestr(error_report_name, "\n".join(lines))

    if success_count == 0 and errors:
        raise TaskUseCaseError(
            status_code=400,
            detail=f"All {len(errors)} exports failed",
        )

    zip_buffer.seek(0)
    return BatchExportArchive(
        data=zip_buffer.getvalue(),
        filename=build_export_archive_filename(
            requested_name=zip_name,
            fallback_prefix="export",
        ),
    )
