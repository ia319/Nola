"""Task query helpers shared by repositories."""

import json
import logging
import sqlite3
from typing import cast

from nola.models.taskdb.types import TaskRow

logger = logging.getLogger(__name__)


def escape_like_fragment(fragment: str) -> str:
    """Escape LIKE wildcards so search keeps literal contains semantics."""
    return fragment.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def parse_task_row(row: sqlite3.Row, task_id: str) -> TaskRow:
    """Parse JSON columns from a task row."""
    task = dict(row)
    if task["segments"]:
        try:
            task["segments"] = json.loads(task["segments"])
        except json.JSONDecodeError:
            logger.warning("Corrupted segments JSON for task %s", task_id)
            task["segments"] = None
    if task["options"]:
        try:
            task["options"] = json.loads(task["options"])
        except json.JSONDecodeError:
            logger.warning("Corrupted options JSON for task %s", task_id)
            task["options"] = None
    return cast(TaskRow, task)
