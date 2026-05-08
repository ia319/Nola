"""Unit tests for the Live WhisperStreaming transcriber adapter."""

from collections.abc import Sequence
from typing import cast

import pytest

from nola.application.live.realtime import (
    LiveRealtimeTranscriberFrame,
    LiveRealtimeTranscriptCommittedPartial,
    LiveRealtimeTranscriptFinalCandidate,
    LiveRealtimeTranscriptPreview,
)
from nola.application.live.realtime.whisper_streaming import (
    WhisperStreamingLiveTranscriber,
    WhisperStreamingModelOutput,
    WhisperStreamingOnlineProcessor,
    WhisperStreamingProcessorUpdate,
    WhisperStreamingRuntimeConfig,
    WhisperStreamingRuntimeError,
    WhisperStreamingTranscriptChunk,
    WhisperStreamingWord,
)
from nola.application.live.types import LiveTrackSource


class _FakeBackend:
    separator = " "

    def __init__(self, outputs: tuple[WhisperStreamingModelOutput, ...]) -> None:
        self._outputs = outputs
        self._call_index = 0
        self.close_count = 0

    def transcribe(
        self,
        waveform: Sequence[float],
        *,
        prompt: str,
        config: WhisperStreamingRuntimeConfig,
    ) -> WhisperStreamingModelOutput:
        del waveform, prompt, config
        output = self._outputs[self._call_index]
        self._call_index += 1
        return output

    def close(self) -> None:
        self.close_count += 1


class _CloseTrackingProcessorFactory:
    def __init__(self) -> None:
        self.processors: list[_CloseTrackingProcessor] = []

    def __call__(
        self,
        *,
        backend: object,
        config: WhisperStreamingRuntimeConfig | None = None,
        offset_ms: int = 0,
    ) -> WhisperStreamingOnlineProcessor:
        del backend, config, offset_ms
        processor = _CloseTrackingProcessor()
        self.processors.append(processor)
        return cast(WhisperStreamingOnlineProcessor, processor)


class _CloseTrackingProcessor:
    def __init__(self) -> None:
        self.finish_count = 0
        self.close_count = 0

    def accept_waveform(
        self,
        waveform: Sequence[float],
        *,
        start_ms: int,
        end_ms: int,
    ) -> WhisperStreamingProcessorUpdate:
        del waveform, start_ms, end_ms
        return _processor_update(
            preview=WhisperStreamingTranscriptChunk(
                start_ms=0,
                end_ms=200,
                text="preview",
            )
        )

    def finish(self) -> WhisperStreamingProcessorUpdate:
        self.finish_count += 1
        return _processor_update(
            final=WhisperStreamingTranscriptChunk(
                start_ms=0,
                end_ms=400,
                text="final",
            )
        )

    def close(self) -> None:
        self.close_count += 1


def test_whisper_streaming_live_transcriber_maps_preview_and_committed() -> None:
    """Map processor preview and committed chunks to Live transcript results."""
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
    transcriber = WhisperStreamingLiveTranscriber(backend=backend)

    first = transcriber.accept_frame(_frame(sequence=0, start_ms=0, end_ms=1000))
    second = transcriber.accept_frame(_frame(sequence=1, start_ms=1000, end_ms=2000))

    assert len(first) == 1
    assert isinstance(first[0], LiveRealtimeTranscriptPreview)
    assert first[0].preview_index == 1
    assert first[0].text == "hello"
    assert len(second) == 2
    assert isinstance(second[0], LiveRealtimeTranscriptCommittedPartial)
    assert second[0].committed_index == 1
    assert second[0].text == "hello"
    assert isinstance(second[1], LiveRealtimeTranscriptPreview)
    assert second[1].preview_index == 2
    assert second[1].text == "world"


def test_whisper_streaming_live_transcriber_flushes_track_final() -> None:
    """Flush one track processor into a final candidate."""
    backend = _FakeBackend((_output((_word(0, 600, "tail"),), (600,)),))
    transcriber = WhisperStreamingLiveTranscriber(backend=backend)

    transcriber.accept_frame(_frame(sequence=0, start_ms=0, end_ms=1000))
    results = transcriber.flush_track(track_id="track-001", source="microphone")
    repeated = transcriber.flush_track(track_id="track-001", source="microphone")

    assert len(results) == 1
    assert isinstance(results[0], LiveRealtimeTranscriptFinalCandidate)
    assert results[0].track_id == "track-001"
    assert results[0].source == "microphone"
    assert results[0].start_ms == 0
    assert results[0].end_ms == 600
    assert results[0].text == "tail"
    assert repeated == ()


def test_whisper_streaming_live_transcriber_closes_flushed_track_processor() -> None:
    """Close a flushed track processor when it leaves adapter ownership."""
    backend = _FakeBackend(())
    processor_factory = _CloseTrackingProcessorFactory()
    transcriber = WhisperStreamingLiveTranscriber(
        backend=backend,
        processor_factory=processor_factory,
    )

    transcriber.accept_frame(_frame(sequence=0, start_ms=0, end_ms=1000))
    results = transcriber.flush_track(track_id="track-001", source="microphone")
    transcriber.release()

    assert len(results) == 1
    assert processor_factory.processors[0].finish_count == 1
    assert processor_factory.processors[0].close_count == 1


def test_whisper_streaming_live_transcriber_flushes_all_tracks() -> None:
    """Flush independent track processors through one shared backend."""
    backend = _FakeBackend(
        (
            _output((_word(0, 500, "mic"),), (500,)),
            _output((_word(0, 500, "system"),), (500,)),
        )
    )
    transcriber = WhisperStreamingLiveTranscriber(backend=backend)
    transcriber.accept_frame(
        _frame(
            track_id="track-mic",
            source="microphone",
            sequence=0,
            start_ms=0,
            end_ms=1000,
        )
    )
    transcriber.accept_frame(
        _frame(
            track_id="track-system",
            source="system",
            sequence=0,
            start_ms=0,
            end_ms=1000,
        )
    )

    results = transcriber.flush_all()

    assert [result.track_id for result in results] == ["track-mic", "track-system"]
    assert [result.text for result in results] == ["mic", "system"]
    assert all(
        isinstance(result, LiveRealtimeTranscriptFinalCandidate) for result in results
    )


def test_whisper_streaming_live_transcriber_closes_all_flushed_processors() -> None:
    """Close every flushed processor when flushing all tracks."""
    backend = _FakeBackend(())
    processor_factory = _CloseTrackingProcessorFactory()
    transcriber = WhisperStreamingLiveTranscriber(
        backend=backend,
        processor_factory=processor_factory,
    )
    transcriber.accept_frame(
        _frame(
            track_id="track-mic",
            source="microphone",
            sequence=0,
            start_ms=0,
            end_ms=1000,
        )
    )
    transcriber.accept_frame(
        _frame(
            track_id="track-system",
            source="system",
            sequence=0,
            start_ms=0,
            end_ms=1000,
        )
    )

    results = transcriber.flush_all()
    transcriber.release()

    assert [result.track_id for result in results] == ["track-mic", "track-system"]
    assert [processor.finish_count for processor in processor_factory.processors] == [
        1,
        1,
    ]
    assert [processor.close_count for processor in processor_factory.processors] == [
        1,
        1,
    ]


def test_whisper_streaming_live_transcriber_release_is_idempotent() -> None:
    """Release processors and backend once."""
    backend = _FakeBackend((_output((_word(0, 500, "hello"),), (500,)),))
    transcriber = WhisperStreamingLiveTranscriber(backend=backend)
    transcriber.accept_frame(_frame(sequence=0, start_ms=0, end_ms=1000))

    transcriber.release()
    transcriber.release()

    assert backend.close_count == 1
    with pytest.raises(WhisperStreamingRuntimeError) as exc_info:
        transcriber.accept_frame(_frame(sequence=1, start_ms=1000, end_ms=2000))
    assert exc_info.value.code == "runtime_inference_failed"


def _frame(
    *,
    track_id: str = "track-001",
    source: LiveTrackSource = "microphone",
    sequence: int,
    start_ms: int,
    end_ms: int,
) -> LiveRealtimeTranscriberFrame:
    return LiveRealtimeTranscriberFrame(
        track_id=track_id,
        source=source,
        sequence=sequence,
        start_ms=start_ms,
        end_ms=end_ms,
        duration_ms=end_ms - start_ms,
        waveform=(0.2,) * ((end_ms - start_ms) * 16000 // 1000),
    )


def _output(
    words: tuple[WhisperStreamingWord, ...],
    segment_end_ms: tuple[int, ...],
) -> WhisperStreamingModelOutput:
    return WhisperStreamingModelOutput(words=words, segment_end_ms=segment_end_ms)


def _processor_update(
    *,
    preview: WhisperStreamingTranscriptChunk | None = None,
    final: WhisperStreamingTranscriptChunk | None = None,
) -> WhisperStreamingProcessorUpdate:
    empty = WhisperStreamingTranscriptChunk(start_ms=None, end_ms=None, text="")
    return WhisperStreamingProcessorUpdate(
        processed=True,
        preview=preview or empty,
        committed_partial=empty,
        final=final or empty,
    )


def _word(start_ms: int, end_ms: int, text: str) -> WhisperStreamingWord:
    return WhisperStreamingWord(start_ms=start_ms, end_ms=end_ms, text=text)
