"""Unit tests for task execution configuration resolution."""

import pytest

from nola.application.tasks.errors import TaskUseCaseError
from nola.application.tasks.execution_config import resolve_task_execution_config
from nola.application.tasks.types import TaskExecutionConfigValues


def _resolve_fake_model(model_id: str) -> str | None:
    models = {
        "base": "base",
        "small": "small",
        "medium": "medium",
        "large": "large-v3",
        "large-v3": "large-v3",
        "turbo": "large-v3-turbo",
    }
    return models.get(model_id)


def test_request_values_override_session_defaults() -> None:
    config = resolve_task_execution_config(
        request=TaskExecutionConfigValues(
            model_id="turbo",
            device="cuda",
            compute_type="float16",
        ),
        session_defaults=TaskExecutionConfigValues(
            model_id="medium",
            device="cpu",
            compute_type="int8",
        ),
        settings_defaults=TaskExecutionConfigValues(
            model_id="base",
            device="auto",
            compute_type="default",
        ),
        model_resolver=_resolve_fake_model,
    )

    assert config == {
        "model_id": "large-v3-turbo",
        "engine_device": "cuda",
        "engine_compute_type": "float16",
    }


def test_session_defaults_override_settings() -> None:
    config = resolve_task_execution_config(
        request=TaskExecutionConfigValues(),
        session_defaults=TaskExecutionConfigValues(
            model_id="medium",
            device="cuda",
            compute_type="float16",
        ),
        settings_defaults=TaskExecutionConfigValues(
            model_id="base",
            device="cpu",
            compute_type="default",
        ),
        model_resolver=_resolve_fake_model,
    )

    assert config == {
        "model_id": "medium",
        "engine_device": "cuda",
        "engine_compute_type": "float16",
    }


def test_model_alias_resolves_to_canonical_id() -> None:
    config = resolve_task_execution_config(
        request=TaskExecutionConfigValues(model_id="large"),
        session_defaults=TaskExecutionConfigValues(),
        settings_defaults=TaskExecutionConfigValues(
            model_id="base",
            device="cpu",
            compute_type="default",
        ),
        model_resolver=_resolve_fake_model,
    )

    assert config["model_id"] == "large-v3"


def test_invalid_model_returns_clear_error() -> None:
    with pytest.raises(TaskUseCaseError) as error:
        resolve_task_execution_config(
            request=TaskExecutionConfigValues(model_id="missing"),
            settings_defaults=TaskExecutionConfigValues(
                model_id="base",
                device="cpu",
                compute_type="default",
            ),
            model_resolver=_resolve_fake_model,
        )

    assert error.value.status_code == 422
    assert error.value.detail == "Invalid task execution model_id: missing"


def test_invalid_device_returns_clear_error() -> None:
    with pytest.raises(TaskUseCaseError) as error:
        resolve_task_execution_config(
            request=TaskExecutionConfigValues(device="metal"),
            settings_defaults=TaskExecutionConfigValues(
                model_id="base",
                device="cpu",
                compute_type="default",
            ),
            model_resolver=_resolve_fake_model,
        )

    assert error.value.status_code == 422
    assert "Invalid task execution device: metal" in error.value.detail
    assert "auto, cpu, cuda" in error.value.detail


def test_invalid_compute_type_returns_clear_error() -> None:
    with pytest.raises(TaskUseCaseError) as error:
        resolve_task_execution_config(
            request=TaskExecutionConfigValues(compute_type="float32"),
            settings_defaults=TaskExecutionConfigValues(
                model_id="base",
                device="cpu",
                compute_type="default",
            ),
            model_resolver=_resolve_fake_model,
        )

    assert error.value.status_code == 422
    assert "Invalid task execution compute_type: float32" in error.value.detail
    assert "default, float16, int8" in error.value.detail
