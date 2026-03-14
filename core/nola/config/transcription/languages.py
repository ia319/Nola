"""Transcription language-capability helpers."""

from __future__ import annotations

from pydantic import BaseModel

from nola.config.constants import SUPPORTED_LANGUAGES


class LanguageOptionSchema(BaseModel):
    """Describe one selectable language option."""

    code: str
    label_key: str


def _language_option(code: str) -> LanguageOptionSchema:
    """Map a Whisper language code to the frontend i18n key contract."""
    return LanguageOptionSchema(code=code, label_key=f"options.language.{code}")


def is_multilingual(model_size: str) -> bool:
    """Infer multilingual capability from the supported official model IDs."""
    return not model_size.endswith(".en")


def get_effective_languages(model_size: str) -> list[LanguageOptionSchema]:
    """Return selectable languages for the configured model."""
    codes = sorted(SUPPORTED_LANGUAGES) if is_multilingual(model_size) else ["en"]
    return [_language_option(code) for code in codes]
