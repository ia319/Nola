"""Task row parsing helpers shared by repositories."""

import json
import logging
import sqlite3
from typing import Any, cast

from nola.common.types import JsonDict
from nola.models.taskdb.types import TaskRow

logger = logging.getLogger(__name__)


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

    runtime_config_raw = task.get("runtime_config")
    if runtime_config_raw:
        try:
            runtime_config = json.loads(runtime_config_raw)
            if isinstance(runtime_config, dict):
                task["runtime_config"] = cast(JsonDict, runtime_config)
            else:
                logger.warning("Invalid runtime_config JSON shape for task %s", task_id)
                task["runtime_config"] = None
        except json.JSONDecodeError:
            logger.warning("Corrupted runtime_config JSON for task %s", task_id)
            task["runtime_config"] = None
    else:
        task["runtime_config"] = None
    return cast(TaskRow, task)
