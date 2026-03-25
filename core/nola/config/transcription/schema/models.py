"""Schema models for transcription UI field metadata."""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, Field


class SliderFieldSchema(BaseModel):
    """Describe a slider-backed numeric field."""

    key: str
    label_key: str
    type: Literal["slider"]
    min: float
    max: float
    step: float
    depends_on: str | None = None


class SwitchFieldSchema(BaseModel):
    """Describe a boolean toggle field."""

    key: str
    label_key: str
    type: Literal["switch"]
    depends_on: str | None = None


class NumberFieldSchema(BaseModel):
    """Describe a numeric text input field."""

    key: str
    label_key: str
    type: Literal["number"]
    min: float | None = None
    max: float | None = None
    step: float | None = None
    depends_on: str | None = None
    special_values: list[str] | None = None


class NumberListFieldSchema(BaseModel):
    """Describe a comma-separated numeric list field."""

    key: str
    label_key: str
    type: Literal["number_list"]
    allow_negative: bool = False
    integer_only: bool = False
    collapse_single_value: bool = False
    depends_on: str | None = None


class TextFieldSchema(BaseModel):
    """Describe a free-form text field."""

    key: str
    label_key: str
    type: Literal["text"]
    depends_on: str | None = None


class SelectOptionSchema(BaseModel):
    """Describe one selectable option entry."""

    value: str
    label_key: str


class SelectFieldSchema(BaseModel):
    """Describe a single-select field."""

    key: str
    label_key: str
    type: Literal["select"]
    options: list[SelectOptionSchema] | None = None
    options_source: Literal["effective_languages"] | None = None
    depends_on: str | None = None


OptionFieldSchema = Annotated[
    SliderFieldSchema
    | SwitchFieldSchema
    | NumberFieldSchema
    | NumberListFieldSchema
    | TextFieldSchema
    | SelectFieldSchema,
    Field(discriminator="type"),
]


class OptionGroupSchema(BaseModel):
    """Group related option fields under one UI section."""

    group: str
    group_label_key: str
    fields: list[OptionFieldSchema]


__all__ = [
    "NumberFieldSchema",
    "NumberListFieldSchema",
    "OptionFieldSchema",
    "OptionGroupSchema",
    "SelectFieldSchema",
    "SelectOptionSchema",
    "SliderFieldSchema",
    "SwitchFieldSchema",
    "TextFieldSchema",
]
