"""Unit tests for WhisperStreaming online processor behavior."""

from collections.abc import Sequence

import pytest

from nola.application.live.realtime.whisper_streaming import (
    WhisperStreamingModelOutput,
    WhisperStreamingOnlineProcessor,
    WhisperStreamingRuntimeConfig,
    WhisperStreamingRuntimeError,
    WhisperStreamingWord,
)


class _FakeBackend:
    separator = " "

    def __init__(self, outputs: tuple[WhisperStreamingModelOutput, ...]) -> None:
        self._outputs = outputs
        self._call_index = 0
        self.prompts: list[str] = []
        self.waveform_lengths: list[int] = []
        self.closed = False

    def transcribe(
        self,
        waveform: Sequence[float],
        *,
        prompt: str,
        config: WhisperStreamingRuntimeConfig,
    ) -> WhisperStreamingModelOutput:
        del config
        self.prompts.append(prompt)
        self.waveform_lengths.append(len(waveform))
        output = self._outputs[self._call_index]
        self._call_index += 1
        return output

    def close(self) -> None:
        self.closed = True


def test_online_processor_emits_preview_then_committed_partial() -> None:
    """Validate preview and committed partial semantics."""
    backend = _FakeBackend(
        (
            _output((_word(0, 500, "hello"),), (500,)),
            _output(
                (
                    _word(0, 500, "hello"),
                    _word(500, 900, "world"),
                ),
                (500, 900),
            ),
        )
    )
    processor = WhisperStreamingOnlineProcessor(backend=backend)

    first = processor.accept_waveform(_waveform(1000), start_ms=0, end_ms=1000)
    second = processor.accept_waveform(
        _waveform(1000),
        start_ms=1000,
        end_ms=2000,
    )

    assert first.processed is True
    assert first.preview.text == "hello"
    assert first.committed_partial.is_empty is True
    assert second.committed_partial.text == "hello"
    assert second.preview.text == "world"
    assert backend.waveform_lengths == [16000, 32000]


def test_online_processor_uses_prompt_from_scrolled_committed_text() -> None:
    """Validate upstream prompt and segment trimming behavior."""
    backend = _FakeBackend(
        (
            _output(
                (
                    _word(0, 500, "alpha"),
                    _word(500, 1000, "beta"),
                ),
                (1000,),
            ),
            _output(
                (
                    _word(0, 500, "alpha"),
                    _word(500, 1000, "beta"),
                ),
                (500, 1000),
            ),
            _output(
                (
                    _word(0, 500, "beta"),
                    _word(500, 1000, "gamma"),
                ),
                (500, 1000),
            ),
        )
    )
    processor = WhisperStreamingOnlineProcessor(
        backend=backend,
        config=WhisperStreamingRuntimeConfig(buffer_trimming_ms=1500),
    )

    processor.accept_waveform(_waveform(1000), start_ms=0, end_ms=1000)
    processor.accept_waveform(_waveform(1000), start_ms=1000, end_ms=2000)
    assert processor.buffer_time_offset_ms == 500
    assert processor.build_prompt() == ("alpha", "beta")

    processor.accept_waveform(_waveform(1000), start_ms=2000, end_ms=3000)

    assert backend.prompts == ["", "", "alpha"]


def test_online_processor_finish_flushes_unconfirmed_text_and_closes() -> None:
    """Validate explicit boundary flush behavior."""
    backend = _FakeBackend((_output((_word(0, 600, "tail"),), (600,)),))
    processor = WhisperStreamingOnlineProcessor(backend=backend)

    update = processor.accept_waveform(_waveform(1000), start_ms=0, end_ms=1000)
    final_update = processor.finish()

    assert update.preview.text == "tail"
    assert final_update.final.text == "tail"
    assert processor.closed is True
    with pytest.raises(WhisperStreamingRuntimeError) as exc_info:
        processor.accept_waveform(_waveform(1000), start_ms=1000, end_ms=2000)
    assert exc_info.value.code == "runtime_inference_failed"


def test_online_processor_closes_committed_text_on_silence() -> None:
    """Validate silence closes a final candidate without model-side VAD."""
    backend = _FakeBackend(
        (
            _output((_word(0, 500, "hello"),), (500,)),
            _output((_word(0, 500, "hello"),), (500,)),
            _output((), ()),
        )
    )
    processor = WhisperStreamingOnlineProcessor(
        backend=backend,
        config=WhisperStreamingRuntimeConfig(
            segment_close_silence_ms=500,
            context_reset_silence_ms=2000,
        ),
    )

    processor.accept_waveform(_waveform(1000), start_ms=0, end_ms=1000)
    committed = processor.accept_waveform(
        _waveform(1000),
        start_ms=1000,
        end_ms=2000,
    )
    closed = processor.accept_waveform(
        _waveform(500, amplitude=0.0),
        start_ms=2000,
        end_ms=2500,
    )
    reset = processor.accept_waveform(
        _waveform(1500, amplitude=0.0),
        start_ms=2500,
        end_ms=4000,
    )

    assert committed.committed_partial.text == "hello"
    assert closed.final.text == "hello"
    assert reset.context_reset is True
    assert reset.final.is_empty is True


def test_online_processor_suppresses_empty_silence_final() -> None:
    """Validate blank silence does not create a final chunk."""
    backend = _FakeBackend(())
    processor = WhisperStreamingOnlineProcessor(
        backend=backend,
        config=WhisperStreamingRuntimeConfig(segment_close_silence_ms=500),
    )

    update = processor.accept_waveform(
        _waveform(500, amplitude=0.0),
        start_ms=0,
        end_ms=500,
    )

    assert update.final.is_empty is True
    assert backend.waveform_lengths == []


def test_online_processor_rejects_zero_duration_frames() -> None:
    """Validate stable runtime errors for invalid frame timing."""
    processor = WhisperStreamingOnlineProcessor(backend=_FakeBackend(()))

    with pytest.raises(WhisperStreamingRuntimeError) as exc_info:
        processor.accept_waveform((), start_ms=1000, end_ms=1000)

    assert exc_info.value.code == "runtime_inference_failed"


def _output(
    words: tuple[WhisperStreamingWord, ...],
    segment_end_ms: tuple[int, ...],
) -> WhisperStreamingModelOutput:
    return WhisperStreamingModelOutput(words=words, segment_end_ms=segment_end_ms)


def _word(start_ms: int, end_ms: int, text: str) -> WhisperStreamingWord:
    return WhisperStreamingWord(start_ms=start_ms, end_ms=end_ms, text=text)


def _waveform(duration_ms: int, *, amplitude: float = 0.2) -> tuple[float, ...]:
    sample_count = duration_ms * 16000 // 1000
    return (amplitude,) * sample_count
