"""Batch-export use-case."""

import io
import logging
import re
import zipfile
from datetime import datetime
from pathlib import Path

from fastapi.responses import Response, StreamingResponse

from nola.application.tasks.contracts import SupportsFileQueries, SupportsTaskQueries
from nola.application.tasks.errors import TaskUseCaseError
from nola.application.tasks.exports.export_common import resolve_export_options
from nola.config.export import ExportFormat
from nola.models import AppConfigDatabase
from nola.models.tasks import TaskStatus
from nola.services.formatters import get_formatter
from nola.services.formatters.base import SegmentData

logger = logging.getLogger(__name__)


def batch_export_tasks(
    *,
    task_store: SupportsTaskQueries,
    file_store: SupportsFileQueries,
    config_store: AppConfigDatabase,
    task_ids: list[str],
    requested_format: ExportFormat | None,
    requested_include_timestamps: bool | None,
    zip_name: str | None,
) -> Response:
    """Export multiple completed tasks into a ZIP archive."""
    zip_buffer = io.BytesIO()
    errors: list[dict[str, str]] = []
    used_names: set[str] = set()
    success_count = 0

    effective_format, effective_include_timestamps = resolve_export_options(
        config_store=config_store,
        requested_format=requested_format,
        requested_include_timestamps=requested_include_timestamps,
    )
    formatter = get_formatter(
        effective_format,
        include_timestamps=effective_include_timestamps,
    )

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
                segment_data = [
                    SegmentData(start=s["start"], end=s["end"], text=s["text"])
                    for s in segments
                ]
                content = formatter.format(segment_data)

                file_row = file_store.get_file(task["file_id"])
                base_name = Path(file_row["filename"]).stem if file_row else task_id[:8]
                filename = f"{base_name}.{formatter.file_extension}"

                # Handle duplicate filenames inside the same archive.
                if filename in used_names:
                    counter = 1
                    while (
                        f"{base_name}_{counter}.{formatter.file_extension}"
                        in used_names
                    ):
                        counter += 1
                    filename = f"{base_name}_{counter}.{formatter.file_extension}"

                used_names.add(filename)
                archive.writestr(filename, content)
                success_count += 1
            except Exception as error:
                logger.exception("Error exporting task %s", task_id)
                errors.append(
                    {
                        "task_id": task_id,
                        "reason": "error",
                        "detail": str(error),
                    }
                )

        if errors:
            lines = [
                f"{item['task_id']}: {item['reason']}"
                + (f" - {item.get('detail', '')}" if item.get("detail") else "")
                for item in errors
            ]
            archive.writestr("_errors.txt", "\n".join(lines))

    if success_count == 0 and errors:
        raise TaskUseCaseError(
            status_code=400,
            detail=f"All {len(errors)} exports failed",
        )

    zip_buffer.seek(0)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    if zip_name:
        # Remove header/path injection characters from user-provided zip name.
        safe_name = re.sub(r'[\r\n/\\"]', "", zip_name).strip()
        zip_filename = f"{safe_name}.zip" if safe_name else f"export_{timestamp}.zip"
    else:
        zip_filename = f"export_{timestamp}.zip"

    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{zip_filename}"'},
    )
