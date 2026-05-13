"""Task row parsing helpers shared by repositories."""

import json
import logging
import sqlite3
from typing import Any, cast

from nola.common.types import JsonDict
from nola.models.taskdb.types import TaskRow

logger = logging.getLogger(__name__)


def _parse_json_object(
    task: dict[str, Any],
    *,
    field_name: str,
    task_id: str,
) -> None:
    raw_value = task.get(field_name)
    if raw_value:
        try:
            parsed = json.loads(raw_value)
            if isinstance(parsed, dict):
                task[field_name] = cast(JsonDict, parsed)
            else:
                logger.warning("Invalid %s JSON shape for task %s", field_name, task_id)
                task[field_name] = None
        except json.JSONDecodeError:
            logger.warning("Corrupted %s JSON for task %s", field_name, task_id)
            task[field_name] = None
    else:
        task[field_name] = None


def parse_task_row(row: sqlite3.Row, task_id: str) -> TaskRow:
    """Parse JSON columns from a task row."""
    task = dict(row)
    segments_raw = task.get("segments")
    if segments_raw:
        try:
            segments = json.loads(segments_raw)
            if isinstance(segments, list) and all(
                isinstance(segment, dict) for segment in segments
            ):
                task["segments"] = segments
            else:
                logger.warning("Invalid segments JSON shape for task %s", task_id)
                task["segments"] = None
        except json.JSONDecodeError:
            logger.warning("Corrupted segments JSON for task %s", task_id)
            task["segments"] = None

    options_raw = task.get("options")
    if options_raw:
        try:
            options = json.loads(options_raw)
            if isinstance(options, dict):
                task["options"] = cast(dict[str, Any], options)
            else:
                logger.warning("Invalid options JSON shape for task %s", task_id)
                task["options"] = None
        except json.JSONDecodeError:
            logger.warning("Corrupted options JSON for task %s", task_id)
            task["options"] = None

    _parse_json_object(task, field_name="runtime_config", task_id=task_id)
    _parse_json_object(task, field_name="request_overrides", task_id=task_id)
    return cast(TaskRow, task)
