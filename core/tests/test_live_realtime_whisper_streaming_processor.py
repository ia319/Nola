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


def test_online_processor_confirms_segment_boundary_before_final() -> None:
    """Validate trailing silence can confirm the final word before closing."""
    backend = _FakeBackend(
        (
            _output(
                (
                    _word(0, 400, "need"),
                    _word(400, 800, "twenty"),
                ),
                (800,),
            ),
            _output(
                (
                    _word(0, 400, "need"),
                    _word(400, 800, "twenty"),
                    _word(800, 1200, "seconds"),
                ),
                (1200,),
            ),
            _output(
                (
                    _word(0, 400, "need"),
                    _word(400, 800, "twenty"),
                    _word(800, 1200, "seconds"),
                    _word(1200, 1600, "around"),
                ),
                (1600,),
            ),
        )
    )
    processor = WhisperStreamingOnlineProcessor(
        backend=backend,
        config=WhisperStreamingRuntimeConfig(segment_close_silence_ms=500),
    )

    processor.accept_waveform(_waveform(1000), start_ms=0, end_ms=1000)
    processor.accept_waveform(_waveform(1000), start_ms=1000, end_ms=2000)
    closed = processor.accept_waveform(
        _waveform(500, amplitude=0.0),
        start_ms=2000,
        end_ms=2500,
    )

    assert closed.processed is True
    assert closed.final.text == "need twenty seconds around"
    assert backend.waveform_lengths == [16000, 32000, 40000]
    assert backend.prompts == ["", "", ""]


def test_online_processor_confirms_boundary_on_long_silence_frame() -> None:
    """Validate long silent frames still confirm pending transcript boundaries."""
    backend = _FakeBackend(
        (
            _output(
                (
                    _word(0, 400, "need"),
                    _word(400, 800, "twenty"),
                ),
                (800,),
            ),
            _output(
                (
                    _word(0, 400, "need"),
                    _word(400, 800, "twenty"),
                    _word(800, 1200, "seconds"),
                ),
                (1200,),
            ),
            _output(
                (
                    _word(0, 400, "need"),
                    _word(400, 800, "twenty"),
                    _word(800, 1200, "seconds"),
                    _word(1200, 1600, "around"),
                ),
                (1600,),
            ),
        )
    )
    processor = WhisperStreamingOnlineProcessor(
        backend=backend,
        config=WhisperStreamingRuntimeConfig(
            min_chunk_ms=500,
            segment_close_silence_ms=500,
        ),
    )

    processor.accept_waveform(_waveform(1000), start_ms=0, end_ms=1000)
    processor.accept_waveform(_waveform(1000), start_ms=1000, end_ms=2000)
    closed = processor.accept_waveform(
        _waveform(1000, amplitude=0.0),
        start_ms=2000,
        end_ms=3000,
    )

    assert closed.processed is True
    assert closed.final.text == "need twenty seconds around"
    assert backend.waveform_lengths == [16000, 32000, 48000]


def test_online_processor_uses_tail_anchor_for_boundary_confirmation() -> None:
    """Validate boundary confirmation tolerates earlier wording corrections."""
    backend = _FakeBackend(
        (
            _output(
                (
                    _word(0, 200, "reading"),
                    _word(200, 400, "under"),
                    _word(400, 600, "ordinary"),
                    _word(600, 800, "speed"),
                ),
                (800,),
            ),
            _output(
                (
                    _word(0, 200, "reading"),
                    _word(200, 400, "under"),
                    _word(400, 600, "ordinary"),
                    _word(600, 800, "speed"),
                    _word(800, 1000, "and"),
                    _word(1000, 1200, "stable"),
                    _word(1200, 1400, "pacing"),
                    _word(1400, 1600, "needs"),
                    _word(1600, 1800, "20"),
                ),
                (1800,),
            ),
            _output(
                (
                    _word(0, 200, "reading"),
                    _word(200, 400, "with"),
                    _word(400, 600, "changed"),
                    _word(600, 800, "rhythm"),
                    _word(800, 1000, "needs"),
                    _word(1000, 1200, "20"),
                    _word(1200, 1400, "seconds"),
                ),
                (1400,),
            ),
        )
    )
    processor = WhisperStreamingOnlineProcessor(
        backend=backend,
        config=WhisperStreamingRuntimeConfig(segment_close_silence_ms=500),
    )

    processor.accept_waveform(_waveform(1000), start_ms=0, end_ms=1000)
    processor.accept_waveform(_waveform(1000), start_ms=1000, end_ms=2000)
    closed = processor.accept_waveform(
        _waveform(500, amplitude=0.0),
        start_ms=2000,
        end_ms=2500,
    )

    assert (
        closed.final.text
        == "reading under ordinary speed and stable pacing needs 20 seconds"
    )
    assert backend.waveform_lengths == [16000, 32000, 40000]


def test_online_processor_trims_repeated_sentence_after_boundary_tail() -> None:
    """Validate boundary confirmation keeps only the anchored tail extension."""
    backend = _FakeBackend(
        (
            _output(
                (
                    _word(0, 400, "alpha"),
                    _word(400, 800, "beta"),
                ),
                (800,),
            ),
            _output(
                (
                    _word(0, 400, "alpha"),
                    _word(400, 800, "beta"),
                    _word(800, 1200, "gamma."),
                ),
                (1200,),
            ),
            _output(
                (
                    _word(0, 400, "alpha"),
                    _word(400, 800, "beta"),
                    _word(800, 1200, "gamma"),
                    _word(1200, 1600, "delta"),
                    _word(1600, 2000, "alpha"),
                    _word(2000, 2400, "beta"),
                    _word(2400, 2800, "gamma"),
                    _word(2800, 3200, "delta"),
                ),
                (3200,),
            ),
        )
    )
    processor = WhisperStreamingOnlineProcessor(
        backend=backend,
        config=WhisperStreamingRuntimeConfig(segment_close_silence_ms=500),
    )

    processor.accept_waveform(_waveform(1000), start_ms=0, end_ms=1000)
    processor.accept_waveform(_waveform(1000), start_ms=1000, end_ms=2000)
    closed = processor.accept_waveform(
        _waveform(500, amplitude=0.0),
        start_ms=2000,
        end_ms=2500,
    )

    assert closed.final.text == "alpha beta gamma delta"
    assert backend.waveform_lengths == [16000, 32000, 40000]


def test_online_processor_rejects_unanchored_boundary_confirmation() -> None:
    """Validate boundary confirmation cannot rewrite or append unrelated text."""
    backend = _FakeBackend(
        (
            _output((_word(0, 500, "current"),), (500,)),
            _output(
                (
                    _word(0, 500, "current"),
                    _word(500, 1000, "phrase."),
                ),
                (1000,),
            ),
            _output(
                (
                    _word(0, 500, "previous"),
                    _word(500, 1000, "context"),
                    _word(1000, 1500, "noise"),
                ),
                (1500,),
            ),
        )
    )
    processor = WhisperStreamingOnlineProcessor(
        backend=backend,
        config=WhisperStreamingRuntimeConfig(segment_close_silence_ms=500),
    )

    processor.accept_waveform(_waveform(1000), start_ms=0, end_ms=1000)
    processor.accept_waveform(_waveform(1000), start_ms=1000, end_ms=2000)
    closed = processor.accept_waveform(
        _waveform(500, amplitude=0.0),
        start_ms=2000,
        end_ms=2500,
    )

    assert closed.final.text == "current phrase."
    assert backend.waveform_lengths == [16000, 32000, 40000]


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


def test_online_processor_skips_initial_silence_window() -> None:
    """Validate initial silence does not enter model inference."""
    backend = _FakeBackend(())
    processor = WhisperStreamingOnlineProcessor(
        backend=backend,
        config=WhisperStreamingRuntimeConfig(segment_close_silence_ms=500),
    )

    update = processor.accept_waveform(
        _waveform(1000, amplitude=0.0),
        start_ms=0,
        end_ms=1000,
    )

    assert update.processed is False
    assert update.preview.is_empty is True
    assert update.final.is_empty is True
    assert backend.waveform_lengths == []


def test_online_processor_skips_silent_tail_without_new_speech() -> None:
    """Validate silence after a final chunk does not re-enter inference."""
    backend = _FakeBackend(
        (
            _output((_word(0, 500, "wait"),), (500,)),
            _output((_word(0, 500, "hallucination"),), (500,)),
        )
    )
    processor = WhisperStreamingOnlineProcessor(
        backend=backend,
        config=WhisperStreamingRuntimeConfig(segment_close_silence_ms=500),
    )

    preview = processor.accept_waveform(_waveform(1000), start_ms=0, end_ms=1000)
    closed = processor.accept_waveform(
        _waveform(500, amplitude=0.0),
        start_ms=1000,
        end_ms=1500,
    )
    tail = processor.accept_waveform(
        _waveform(1000, amplitude=0.0),
        start_ms=1500,
        end_ms=2500,
    )

    assert preview.preview.text == "wait"
    assert closed.final.text == "wait"
    assert tail.processed is False
    assert tail.final.is_empty is True
    assert backend.waveform_lengths == [16000]


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
