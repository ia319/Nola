"""Unit tests for shared faster-whisper runtime helpers."""

from dataclasses import dataclass
from pathlib import Path
from typing import ClassVar

import pytest

from nola.engines import faster_whisper_runtime
from nola.engines.faster_whisper_runtime import (
    FasterWhisperModelConfig,
    close_faster_whisper_model,
    create_faster_whisper_model,
)


@dataclass(frozen=True, slots=True)
class _ModelCall:
    model_size_or_path: str
    device: str
    compute_type: str
    download_root: str | None
    local_files_only: bool


class _FakeRuntimeModel:
    def __init__(self) -> None:
        self.unload_count = 0

    def unload_model(self) -> None:
        self.unload_count += 1


class _FakeWhisperModel:
    calls: ClassVar[list[_ModelCall]] = []

    def __init__(
        self,
        model_size_or_path: str,
        *,
        device: str,
        compute_type: str,
        download_root: str | None = None,
        local_files_only: bool = False,
    ) -> None:
        self.model = _FakeRuntimeModel()
        self.calls.append(
            _ModelCall(
                model_size_or_path=model_size_or_path,
                device=device,
                compute_type=compute_type,
                download_root=download_root,
                local_files_only=local_files_only,
            )
        )


@pytest.fixture(autouse=True)
def _fake_whisper_model(monkeypatch: pytest.MonkeyPatch) -> None:
    _FakeWhisperModel.calls = []
    monkeypatch.setattr(faster_whisper_runtime, "WhisperModel", _FakeWhisperModel)


def test_create_faster_whisper_model_forwards_runtime_config(tmp_path: Path) -> None:
    """Forward resolved runtime config without widening init kwargs."""
    model = create_faster_whisper_model(
        FasterWhisperModelConfig(
            model_size_or_path="Systran/faster-whisper-small",
            device="cpu",
            compute_type="int8",
            download_root=tmp_path,
            local_files_only=True,
        )
    )

    assert isinstance(model, _FakeWhisperModel)
    assert _FakeWhisperModel.calls == [
        _ModelCall(
            model_size_or_path="Systran/faster-whisper-small",
            device="cpu",
            compute_type="int8",
            download_root=str(tmp_path),
            local_files_only=True,
        )
    ]


def test_close_faster_whisper_model_unloads_runtime_model() -> None:
    """Release the CTranslate2 model owned by faster-whisper."""
    model = _FakeWhisperModel("small", device="cpu", compute_type="default")

    close_faster_whisper_model(model)

    assert model.model.unload_count == 1


def test_close_faster_whisper_model_accepts_missing_model() -> None:
    """Allow callers to close an already-cleared model reference."""
    close_faster_whisper_model(None)
