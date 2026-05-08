"""Run track-scoped WhisperStreaming online processing."""

from collections.abc import Sequence

from nola.application.live.realtime.protocol import LiveRealtimeErrorCode
from nola.application.live.realtime.whisper_streaming.config import (
    WHISPER_STREAMING_SAMPLE_RATE,
    WhisperStreamingRuntimeConfig,
    validate_whisper_streaming_runtime_config,
)
from nola.application.live.realtime.whisper_streaming.errors import (
    WhisperStreamingRuntimeError,
)
from nola.application.live.realtime.whisper_streaming.hypothesis import (
    LocalAgreementHypothesisBuffer,
)
from nola.application.live.realtime.whisper_streaming.silence import (
    WhisperStreamingSilenceDetector,
)
from nola.application.live.realtime.whisper_streaming.types import (
    WhisperStreamingInferenceBackend,
    WhisperStreamingModelOutput,
    WhisperStreamingProcessorUpdate,
    WhisperStreamingTranscriptChunk,
    WhisperStreamingWord,
)


class WhisperStreamingOnlineProcessor:
    """Manage one track-scoped WhisperStreaming online state."""

    def __init__(
        self,
        *,
        backend: WhisperStreamingInferenceBackend,
        config: WhisperStreamingRuntimeConfig | None = None,
        offset_ms: int = 0,
    ) -> None:
        self._backend = backend
        self._config = validate_whisper_streaming_runtime_config(
            config or WhisperStreamingRuntimeConfig()
        )
        self._audio_buffer: list[float] = []
        self._buffer_time_offset_ms = offset_ms
        self._hypothesis = LocalAgreementHypothesisBuffer(
            config=self._config,
            offset_ms=offset_ms,
        )
        self._silence = WhisperStreamingSilenceDetector(config=self._config)
        self._committed_history: list[WhisperStreamingWord] = []
        self._pending_final_words: list[WhisperStreamingWord] = []
        self._samples_since_process = 0
        self._started = False
        self._closed = False

    @property
    def closed(self) -> bool:
        """Return whether the processor rejects new audio."""
        return self._closed

    @property
    def buffer_time_offset_ms(self) -> int:
        """Return the session timestamp for the first buffered sample."""
        return self._buffer_time_offset_ms

    @property
    def audio_buffer_duration_ms(self) -> int:
        """Return the current audio buffer duration."""
        return _samples_to_ms(len(self._audio_buffer))

    def accept_waveform(
        self,
        waveform: Sequence[float],
        *,
        start_ms: int,
        end_ms: int,
    ) -> WhisperStreamingProcessorUpdate:
        """Accept one 16 kHz mono waveform frame and emit transcript updates."""
        self._ensure_open()
        if end_ms <= start_ms:
            raise _runtime_error(
                code="runtime_inference_failed",
                message="WhisperStreaming frame timing is invalid",
            )

        if not self._started:
            self._started = True
            self._buffer_time_offset_ms = start_ms
            self._hypothesis.reset(offset_ms=start_ms)

        self._audio_buffer.extend(waveform)
        self._samples_since_process += len(waveform)
        silence_update = self._silence.inspect(
            waveform,
            duration_ms=end_ms - start_ms,
        )

        update = _empty_update()
        if self._should_process():
            update = self._process_iter()

        if silence_update.context_reset:
            final = self._close_pending_segment(include_unconfirmed=True)
            self._reset_context(offset_ms=end_ms)
            update = _with_context_reset(_with_final(update, final))
        elif silence_update.segment_close:
            final = self._close_pending_segment(include_unconfirmed=True)
            update = _with_final(update, final)

        return update

    def build_prompt(self) -> tuple[str, str]:
        """Return the prompt and in-buffer committed context."""
        separator = self._backend.separator
        split_index = max(0, len(self._committed_history) - 1)
        while (
            split_index > 0
            and self._committed_history[split_index - 1].end_ms
            > self._buffer_time_offset_ms
        ):
            split_index -= 1

        prompt_candidates = list(self._committed_history[:split_index])
        prompt_words: list[str] = []
        prompt_length = 0
        while prompt_candidates and prompt_length < self._config.prompt_max_chars:
            text = prompt_candidates.pop().text
            prompt_length += len(text) + 1
            prompt_words.append(text)

        context_words = self._committed_history[split_index:]
        return (
            separator.join(reversed(prompt_words)),
            separator.join(word.text for word in context_words),
        )

    def finish(self) -> WhisperStreamingProcessorUpdate:
        """Flush remaining text at an explicit track or session boundary."""
        if self._closed:
            return _empty_update()

        final = self._close_pending_segment(include_unconfirmed=True)
        self._closed = True
        return _with_final(_empty_update(), final)

    def close(self) -> None:
        """Close the processor and clear connection-local buffers."""
        if self._closed:
            return
        self._closed = True
        self._audio_buffer.clear()
        self._committed_history.clear()
        self._pending_final_words.clear()
        self._hypothesis.reset(offset_ms=self._buffer_time_offset_ms)

    def _process_iter(self) -> WhisperStreamingProcessorUpdate:
        prompt, _ = self.build_prompt()
        model_output = self._transcribe(prompt=prompt)
        self._samples_since_process = 0

        self._hypothesis.insert(
            model_output.words,
            offset_ms=self._buffer_time_offset_ms,
        )
        committed_words = self._hypothesis.flush()
        if committed_words:
            self._committed_history.extend(committed_words)
            self._pending_final_words.extend(committed_words)

        preview = _to_chunk(self._hypothesis.complete(), self._backend.separator)
        committed_partial = _to_chunk(committed_words, self._backend.separator)
        self._trim_completed_segment(model_output)
        return WhisperStreamingProcessorUpdate(
            processed=True,
            preview=preview,
            committed_partial=committed_partial,
            final=_empty_chunk(),
        )

    def _transcribe(self, *, prompt: str) -> WhisperStreamingModelOutput:
        try:
            return self._backend.transcribe(
                tuple(self._audio_buffer),
                prompt=prompt,
                config=self._config,
            )
        except WhisperStreamingRuntimeError:
            raise
        except Exception as error:
            raise _runtime_error(
                code="runtime_inference_failed",
                message="WhisperStreaming inference failed",
            ) from error

    def _trim_completed_segment(
        self,
        model_output: WhisperStreamingModelOutput,
    ) -> None:
        if (
            self.audio_buffer_duration_ms <= self._config.buffer_trimming_ms
            or not self._committed_history
            or len(model_output.segment_end_ms) <= 1
        ):
            return

        segment_ends = list(model_output.segment_end_ms)
        last_committed_end_ms = self._committed_history[-1].end_ms
        candidate_end_ms = segment_ends[-2] + self._buffer_time_offset_ms
        while len(segment_ends) > 2 and candidate_end_ms > last_committed_end_ms:
            segment_ends.pop()
            candidate_end_ms = segment_ends[-2] + self._buffer_time_offset_ms

        if candidate_end_ms <= last_committed_end_ms:
            self._chunk_at(candidate_end_ms)

    def _close_pending_segment(
        self,
        *,
        include_unconfirmed: bool,
    ) -> WhisperStreamingTranscriptChunk:
        words = list(self._pending_final_words)
        if include_unconfirmed:
            words.extend(self._hypothesis.complete())

        final = _to_chunk(tuple(words), self._backend.separator)
        self._pending_final_words.clear()
        if not final.is_empty and final.end_ms is not None:
            self._reset_processing_window(offset_ms=final.end_ms)
        return final

    def _reset_context(self, *, offset_ms: int) -> None:
        self._committed_history.clear()
        self._pending_final_words.clear()
        self._reset_processing_window(offset_ms=offset_ms)

    def _reset_processing_window(self, *, offset_ms: int) -> None:
        self._chunk_at(offset_ms)
        self._hypothesis.reset(offset_ms=self._buffer_time_offset_ms)
        self._samples_since_process = 0

    def _chunk_at(self, time_ms: int) -> None:
        if time_ms <= self._buffer_time_offset_ms:
            return

        cut_ms = time_ms - self._buffer_time_offset_ms
        cut_samples = min(len(self._audio_buffer), _ms_to_samples(cut_ms))
        del self._audio_buffer[:cut_samples]
        self._buffer_time_offset_ms = time_ms
        self._hypothesis.pop_committed(self._buffer_time_offset_ms)

    def _should_process(self) -> bool:
        return _samples_to_ms(self._samples_since_process) >= self._config.min_chunk_ms

    def _ensure_open(self) -> None:
        if self._closed:
            raise _runtime_error(
                code="runtime_inference_failed",
                message="WhisperStreaming processor is closed",
            )


def _to_chunk(
    words: tuple[WhisperStreamingWord, ...],
    separator: str,
) -> WhisperStreamingTranscriptChunk:
    if not words:
        return _empty_chunk()
    return WhisperStreamingTranscriptChunk(
        start_ms=words[0].start_ms,
        end_ms=words[-1].end_ms,
        text=separator.join(word.text for word in words),
    )


def _empty_chunk() -> WhisperStreamingTranscriptChunk:
    return WhisperStreamingTranscriptChunk(start_ms=None, end_ms=None, text="")


def _empty_update() -> WhisperStreamingProcessorUpdate:
    return WhisperStreamingProcessorUpdate(
        processed=False,
        preview=_empty_chunk(),
        committed_partial=_empty_chunk(),
        final=_empty_chunk(),
    )


def _with_final(
    update: WhisperStreamingProcessorUpdate,
    final: WhisperStreamingTranscriptChunk,
) -> WhisperStreamingProcessorUpdate:
    if final.is_empty:
        return update
    return WhisperStreamingProcessorUpdate(
        processed=update.processed,
        preview=update.preview,
        committed_partial=update.committed_partial,
        final=final,
        context_reset=update.context_reset,
    )


def _with_context_reset(
    update: WhisperStreamingProcessorUpdate,
) -> WhisperStreamingProcessorUpdate:
    return WhisperStreamingProcessorUpdate(
        processed=update.processed,
        preview=update.preview,
        committed_partial=update.committed_partial,
        final=update.final,
        context_reset=True,
    )


def _samples_to_ms(sample_count: int) -> int:
    return sample_count * 1000 // WHISPER_STREAMING_SAMPLE_RATE


def _ms_to_samples(duration_ms: int) -> int:
    return duration_ms * WHISPER_STREAMING_SAMPLE_RATE // 1000


def _runtime_error(
    *,
    code: LiveRealtimeErrorCode,
    message: str,
) -> WhisperStreamingRuntimeError:
    return WhisperStreamingRuntimeError(code=code, message=message)


__all__ = ["WhisperStreamingOnlineProcessor"]
