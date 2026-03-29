"""Tests for the curated model registry."""

from __future__ import annotations

from nola.model_hub import (
    get_model,
    get_model_by_repo_id,
    is_supported_model,
    list_model_ids,
    list_models,
    require_model,
)
from nola.model_hub.errors import UnknownModelError


def test_list_models_returns_canonical_ids_without_aliases() -> None:
    """Expose canonical models once each in display order."""
    models = list_models()
    model_ids = [model.model_id for model in models]

    assert "large-v3" in model_ids
    assert "large" not in model_ids
    assert "turbo" not in model_ids
    assert len(model_ids) == len(set(model_ids))


def test_get_model_resolves_aliases_to_canonical_model() -> None:
    """Resolve supported aliases to the same canonical model info."""
    canonical = get_model("large-v3")
    alias = get_model("large")

    assert canonical is not None
    assert alias == canonical
    assert alias.model_id == "large-v3"


def test_get_model_by_repo_id_returns_registered_model() -> None:
    """Find one model using the mapped Hugging Face repository id."""
    model = get_model_by_repo_id("Systran/faster-whisper-small")

    assert model is not None
    assert model.model_id == "small"
    assert model.languages == "multilingual"


def test_registry_marks_english_models_with_one_language_category() -> None:
    """Classify English-only models separately from multilingual models."""
    english_model = require_model("small.en")
    multilingual_model = require_model("small")

    assert english_model.languages == "english-only"
    assert multilingual_model.languages == "multilingual"


def test_registry_marks_distilled_large_models_as_english_only() -> None:
    """Keep distilled large releases aligned with their English-only model cards."""
    assert require_model("distil-large-v2").languages == "english-only"
    assert require_model("distil-large-v3").languages == "english-only"
    assert require_model("distil-large-v3.5").languages == "english-only"


def test_require_model_raises_stable_domain_error_for_unknown_id() -> None:
    """Raise a domain error when one lookup id is unsupported."""
    try:
        require_model("not-a-model")
    except UnknownModelError as exc:
        assert exc.model_id == "not-a-model"
    else:
        raise AssertionError("UnknownModelError was not raised")


def test_list_model_ids_can_include_aliases() -> None:
    """Expose aliases only when explicitly requested."""
    canonical_ids = list_model_ids()
    lookup_ids = list_model_ids(include_aliases=True)

    assert "large" not in canonical_ids
    assert "large" in lookup_ids
    assert is_supported_model("turbo") is True
