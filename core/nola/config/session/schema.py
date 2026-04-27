"""Session execution option metadata."""

from __future__ import annotations

from nola.config.transcription.schema.models import (
    OptionGroupSchema,
    SelectFieldSchema,
    SelectOptionSchema,
)
from nola.engines.base import ALLOWED_ENGINE_COMPUTE_TYPES, ALLOWED_ENGINE_DEVICES

_SESSION_EXECUTION_PARAM_SCHEMA: list[OptionGroupSchema] = [
    OptionGroupSchema(
        group="execution",
        group_label_key="tasks.workbench.sessionConfig.executionEngine",
        fields=[
            SelectFieldSchema(
                key="device",
                label_key="tasks.workbench.sessionConfig.device.label",
                type="select",
                options=[
                    SelectOptionSchema(
                        value=value,
                        label_key=f"tasks.workbench.sessionConfig.device.options.{value}",
                    )
                    for value in ALLOWED_ENGINE_DEVICES
                ],
            ),
            SelectFieldSchema(
                key="compute_type",
                label_key="tasks.workbench.sessionConfig.computeType.label",
                type="select",
                options=[
                    SelectOptionSchema(
                        value=value,
                        label_key=(
                            f"tasks.workbench.sessionConfig.computeType.options.{value}"
                        ),
                    )
                    for value in ALLOWED_ENGINE_COMPUTE_TYPES
                ],
            ),
        ],
    ),
]


def get_session_execution_param_schema() -> list[OptionGroupSchema]:
    """Return a defensive copy of session execution field metadata."""
    return [group.model_copy(deep=True) for group in _SESSION_EXECUTION_PARAM_SCHEMA]


__all__ = ["get_session_execution_param_schema"]
