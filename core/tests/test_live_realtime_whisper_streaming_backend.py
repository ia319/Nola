"""Unit tests for the Live WhisperStreaming faster-whisper backend."""

from collections.abc import Iterable
from dataclasses import dataclass

import numpy as np
import numpy.typing as npt
import pytest

from nola.application.live.realtime.whisper_streaming import (
    WhisperStreamingFasterWhisperBackend,
    WhisperStreamingRuntimeConfig,
    WhisperStreamingRuntimeError,
    WhisperStreamingVadParameters,
)


@dataclass(frozen=True, slots=True)
class _FakeWord:
    start: float
    end: float
    word: str


@dataclass(frozen=True, slots=True)
class _FakeSegment:
    end: float
    no_speech_prob: float
    words: tuple[_FakeWord, ...] | None


@dataclass(frozen=True, slots=True)
class _TranscribeCall:
    sample_count: int
    dtype: str
    initial_prompt: str | None
    vad_filter: bool
    vad_parameters: WhisperStreamingVadParameters | None


class _FakeRuntimeModel:
    def __init__(self) -> None:
        self.unload_count = 0

    def unload_model(self) -> None:
        self.unload_count += 1


class _FakeModel:
    def __init__(self, segments: tuple[_FakeSegment, ...]) -> None:
        self.model = _FakeRuntimeModel()
        self._segments = segments
        self.calls: list[_TranscribeCall] = []

    def transcribe(
        self,
        audio: npt.NDArray[np.float32],
        *,
        language: str | None,
        initial_prompt: str | None,
        beam_size: int,
        word_timestamps: bool,
        condition_on_previous_text: bool,
        vad_filter: bool,
        vad_parameters: WhisperStreamingVadParameters | None,
    ) -> tuple[Iterable[_FakeSegment], object]:
        assert language is None
        assert beam_size == 5
        assert word_timestamps is True
        assert condition_on_previous_text is True
        self.calls.append(
            _TranscribeCall(
                sample_count=int(audio.shape[0]),
                dtype=str(audio.dtype),
                initial_prompt=initial_prompt,
                vad_filter=vad_filter,
                vad_parameters=vad_parameters,
            )
        )
        return self._segments, object()


def test_backend_maps_words_and_segment_end_timestamps() -> None:
    """Normalize faster-whisper output without stripping word spacing."""
    model = _FakeModel(
        (
            _FakeSegment(
                end=0.75,
                no_speech_prob=0.1,
                words=(
                    _FakeWord(start=0.0, end=0.3, word=" hello"),
                    _FakeWord(start=0.3, end=0.75, word=" world"),
                ),
            ),
            _FakeSegment(
                end=1.2,
                no_speech_prob=0.95,
                words=(_FakeWord(start=0.8, end=1.1, word=" skip"),),
            ),
        )
    )
    backend = WhisperStreamingFasterWhisperBackend(model)

    output = backend.transcribe(
        (0.1, 0.2, 0.3),
        prompt="previous text",
        config=WhisperStreamingRuntimeConfig(),
    )

    assert [word.text for word in output.words] == [" hello", " world"]
    assert output.segment_end_ms == (750, 1200)
    assert model.calls == [
        _TranscribeCall(
            sample_count=3,
            dtype="float32",
            initial_prompt="previous text",
            vad_filter=False,
            vad_parameters=None,
        )
    ]


def test_backend_forwards_runtime_vad_config() -> None:
    """Forward faster-whisper VAD config only through the backend boundary."""
    vad_parameters: WhisperStreamingVadParameters = {"threshold": 0.5}
    model = _FakeModel((_FakeSegment(end=0.1, no_speech_prob=0.0, words=None),))
    backend = WhisperStreamingFasterWhisperBackend(model)

    backend.transcribe(
        (0.1,),
        prompt="",
        config=WhisperStreamingRuntimeConfig(
            vad_filter=True,
            vad_parameters=vad_parameters,
        ),
    )

    assert model.calls[0].initial_prompt is None
    assert model.calls[0].vad_filter is True
    assert model.calls[0].vad_parameters == vad_parameters


def test_backend_close_is_idempotent_and_rejects_later_transcribe() -> None:
    """Release one loaded model once and reject later inference."""
    model = _FakeModel(())
    backend = WhisperStreamingFasterWhisperBackend(model)

    backend.close()
    backend.close()

    assert model.model.unload_count == 1
    with pytest.raises(WhisperStreamingRuntimeError) as exc_info:
        backend.transcribe((), prompt="", config=WhisperStreamingRuntimeConfig())
    assert exc_info.value.code == "runtime_inference_failed"
