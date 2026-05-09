"""Adapt faster-whisper output for Live WhisperStreaming processing."""

from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

import numpy as np
import numpy.typing as npt

from nola.application.live.realtime.whisper_streaming.config import (
    WhisperStreamingRuntimeConfig,
    WhisperStreamingTask,
    WhisperStreamingTemperature,
    WhisperStreamingVadParameters,
    combine_initial_prompt,
)
from nola.application.live.realtime.whisper_streaming.errors import (
    WhisperStreamingRuntimeError,
)
from nola.application.live.realtime.whisper_streaming.types import (
    WhisperStreamingInferenceBackend,
    WhisperStreamingModelOutput,
    WhisperStreamingWord,
)
from nola.engines.base import EngineComputeType, EngineDevice
from nola.engines.faster_whisper_runtime import (
    FasterWhisperModelConfig,
    FasterWhisperModelHandle,
    close_faster_whisper_model,
    create_faster_whisper_model,
)

_NO_SPEECH_SKIP_THRESHOLD = 0.9


class _FasterWhisperWord(Protocol):
    @property
    def start(self) -> float:
        """Return the word start timestamp in seconds."""
        ...

    @property
    def end(self) -> float:
        """Return the word end timestamp in seconds."""
        ...

    @property
    def word(self) -> str:
        """Return the word text as emitted by faster-whisper."""
        ...


class _FasterWhisperSegment(Protocol):
    @property
    def end(self) -> float:
        """Return the segment end timestamp in seconds."""
        ...

    @property
    def no_speech_prob(self) -> float:
        """Return the segment no-speech probability."""
        ...

    @property
    def words(self) -> Sequence[_FasterWhisperWord] | None:
        """Return segment words when word timestamps are available."""
        ...


class WhisperStreamingFasterWhisperModel(FasterWhisperModelHandle, Protocol):
    """Expose the faster-whisper calls used by the Live backend."""

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
    ) -> tuple[Iterable[_FasterWhisperSegment], object]:
        """Return faster-whisper segments for one waveform window."""
        ...


@dataclass(frozen=True, slots=True)
class WhisperStreamingFasterWhisperBackendConfig:
    """Configure one Live faster-whisper backend."""

    model_size_or_path: str
    device: EngineDevice
    compute_type: EngineComputeType
    download_root: Path
    local_files_only: bool = True


class WhisperStreamingFasterWhisperBackend(WhisperStreamingInferenceBackend):
    """Run faster-whisper inference for one Live transcriber instance."""

    separator = ""

    def __init__(self, model: WhisperStreamingFasterWhisperModel) -> None:
        self._model: WhisperStreamingFasterWhisperModel | None = model

    @classmethod
    def from_config(
        cls,
        config: WhisperStreamingFasterWhisperBackendConfig,
    ) -> "WhisperStreamingFasterWhisperBackend":
        """Create a backend from one resolved Live model config."""
        model = create_faster_whisper_model(
            FasterWhisperModelConfig(
                model_size_or_path=config.model_size_or_path,
                device=config.device,
                compute_type=config.compute_type,
                download_root=config.download_root,
                local_files_only=config.local_files_only,
            )
        )
        return cls(model=model)

    def transcribe(
        self,
        waveform: Sequence[float],
        *,
        prompt: str,
        config: WhisperStreamingRuntimeConfig,
    ) -> WhisperStreamingModelOutput:
        """Return timestamped words and segment boundaries for one audio window."""
        model = self._require_model()
        audio = np.asarray(waveform, dtype=np.float32)
        initial_prompt = combine_initial_prompt(
            context_prompt=config.context_prompt,
            dynamic_prompt=prompt,
        )
        try:
            segments, _info = model.transcribe(
                audio,
                language=config.language,
                task=config.task,
                initial_prompt=initial_prompt,
                beam_size=config.beam_size,
                best_of=config.best_of,
                temperature=config.temperature,
                compression_ratio_threshold=config.compression_ratio_threshold,
                log_prob_threshold=config.log_prob_threshold,
                no_speech_threshold=config.no_speech_threshold,
                word_timestamps=True,
                condition_on_previous_text=config.condition_on_previous_text,
                vad_filter=config.vad_filter,
                vad_parameters=config.vad_parameters,
            )
            return _collect_model_output(segments)
        except WhisperStreamingRuntimeError:
            raise
        except Exception as error:
            raise WhisperStreamingRuntimeError(
                code="runtime_inference_failed",
                message="WhisperStreaming inference failed",
            ) from error

    def close(self) -> None:
        """Release the loaded faster-whisper model once."""
        model = self._model
        if model is None:
            return
        try:
            close_faster_whisper_model(model)
        finally:
            self._model = None

    def _require_model(self) -> WhisperStreamingFasterWhisperModel:
        model = self._model
        if model is None:
            raise WhisperStreamingRuntimeError(
                code="runtime_inference_failed",
                message="WhisperStreaming backend is closed",
            )
        return model


def _collect_model_output(
    segments: Iterable[_FasterWhisperSegment],
) -> WhisperStreamingModelOutput:
    words: list[WhisperStreamingWord] = []
    segment_end_ms: list[int] = []

    for segment in segments:
        segment_end_ms.append(_seconds_to_ms(segment.end))
        if segment.no_speech_prob > _NO_SPEECH_SKIP_THRESHOLD:
            continue
        for word in segment.words or ():
            words.append(
                WhisperStreamingWord(
                    start_ms=_seconds_to_ms(word.start),
                    end_ms=_seconds_to_ms(word.end),
                    text=word.word,
                )
            )

    return WhisperStreamingModelOutput(
        words=tuple(words),
        segment_end_ms=tuple(segment_end_ms),
    )


def _seconds_to_ms(value: float) -> int:
    return int(round(value * 1000))


__all__ = [
    "WhisperStreamingFasterWhisperBackend",
    "WhisperStreamingFasterWhisperBackendConfig",
    "WhisperStreamingFasterWhisperModel",
]
