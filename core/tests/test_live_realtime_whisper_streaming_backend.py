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
    WhisperStreamingTask,
    WhisperStreamingTemperature,
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
    language: str | None
    task: WhisperStreamingTask
    initial_prompt: str | None
    vad_filter: bool
    vad_parameters: WhisperStreamingVadParameters | None
    beam_size: int
    best_of: int
    temperature: WhisperStreamingTemperature
    compression_ratio_threshold: float | None
    log_prob_threshold: float | None
    no_speech_threshold: float | None
    condition_on_previous_text: bool
    word_timestamps: bool


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
        task: WhisperStreamingTask,
        initial_prompt: str | None,
        beam_size: int,
        best_of: int,
        temperature: WhisperStreamingTemperature,
        compression_ratio_threshold: float | None,
        log_prob_threshold: float | None,
        no_speech_threshold: float | None,
        word_timestamps: bool,
        condition_on_previous_text: bool,
        vad_filter: bool,
        vad_parameters: WhisperStreamingVadParameters | None,
    ) -> tuple[Iterable[_FakeSegment], object]:
        self.calls.append(
            _TranscribeCall(
                sample_count=int(audio.shape[0]),
                dtype=str(audio.dtype),
                language=language,
                task=task,
                initial_prompt=initial_prompt,
                vad_filter=vad_filter,
                vad_parameters=vad_parameters,
                beam_size=beam_size,
                best_of=best_of,
                temperature=temperature,
                compression_ratio_threshold=compression_ratio_threshold,
                log_prob_threshold=log_prob_threshold,
                no_speech_threshold=no_speech_threshold,
                condition_on_previous_text=condition_on_previous_text,
                word_timestamps=word_timestamps,
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
            language=None,
            task="transcribe",
            initial_prompt="previous text",
            vad_filter=False,
            vad_parameters=None,
            beam_size=5,
            best_of=5,
            temperature=0.0,
            compression_ratio_threshold=None,
            log_prob_threshold=None,
            no_speech_threshold=None,
            condition_on_previous_text=True,
            word_timestamps=True,
        )
    ]


def test_backend_forwards_runtime_faster_whisper_config() -> None:
    """Forward configured faster-whisper arguments through the backend boundary."""
    vad_parameters: WhisperStreamingVadParameters = {"threshold": 0.5}
    model = _FakeModel((_FakeSegment(end=0.1, no_speech_prob=0.0, words=None),))
    backend = WhisperStreamingFasterWhisperBackend(model)

    backend.transcribe(
        (0.1,),
        prompt="",
        config=WhisperStreamingRuntimeConfig(
            language="en",
            task="translate",
            beam_size=3,
            best_of=4,
            temperature=[0.0, 0.2],
            compression_ratio_threshold=2.2,
            log_prob_threshold=-0.8,
            no_speech_threshold=0.3,
            condition_on_previous_text=False,
            vad_filter=True,
            vad_parameters=vad_parameters,
        ),
    )

    assert model.calls[0].language == "en"
    assert model.calls[0].task == "translate"
    assert model.calls[0].initial_prompt is None
    assert model.calls[0].beam_size == 3
    assert model.calls[0].best_of == 4
    assert model.calls[0].temperature == [0.0, 0.2]
    assert model.calls[0].compression_ratio_threshold == 2.2
    assert model.calls[0].log_prob_threshold == -0.8
    assert model.calls[0].no_speech_threshold == 0.3
    assert model.calls[0].condition_on_previous_text is False
    assert model.calls[0].word_timestamps is True
    assert model.calls[0].vad_filter is True
    assert model.calls[0].vad_parameters == vad_parameters


def test_backend_ignores_static_context_prompt() -> None:
    """Keep user prompt text out of repeated realtime inference windows."""
    model = _FakeModel((_FakeSegment(end=0.1, no_speech_prob=0.0, words=None),))
    backend = WhisperStreamingFasterWhisperBackend(model)

    backend.transcribe(
        (0.1,),
        prompt="dynamic history",
        config=WhisperStreamingRuntimeConfig(context_prompt="  Domain terms  "),
    )

    assert model.calls[0].initial_prompt == "dynamic history"


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
