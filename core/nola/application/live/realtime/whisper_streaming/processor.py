"""Run track-scoped WhisperStreaming online processing."""

from collections.abc import Sequence
from difflib import SequenceMatcher

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
    WhisperStreamingSilenceUpdate,
)
from nola.application.live.realtime.whisper_streaming.types import (
    WhisperStreamingInferenceBackend,
    WhisperStreamingModelOutput,
    WhisperStreamingProcessorUpdate,
    WhisperStreamingTranscriptChunk,
    WhisperStreamingWord,
)

_BOUNDARY_PREFIX_RATIO = 0.82
_BOUNDARY_TAIL_PREFIX_RATIO = 0.65
_MIN_BOUNDARY_ANCHOR_CHARS = 6
_STRONG_BOUNDARY_TAIL_CHARS = 7
_SENTENCE_END_CHARS = ".!?。！？"


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
        self._boundary_final_chunk: WhisperStreamingTranscriptChunk | None = None
        self._samples_since_process = 0
        self._speech_seen_since_process = False
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
        if not silence_update.is_silence:
            self._speech_seen_since_process = True

        update = _empty_update()
        skipped_silent_process = False
        if self._should_process():
            if self._should_skip_silent_process(silence_update):
                skipped_silent_process = True
                self._samples_since_process = 0
            else:
                update = self._process_iter()

        # Keep boundary-close behavior explicit: long silent frames can mark the
        # update processed before close/reset and skip the anchor check below.
        # Add a hallucinated-tail regression before changing this experimental path.
        if silence_update.context_reset:
            update = self._process_boundary_if_needed(update)
            final = self._close_pending_segment(
                include_unconfirmed=True,
            )
            self._reset_context(offset_ms=end_ms)
            update = _with_context_reset(_with_final(update, final))
        elif silence_update.segment_close:
            update = self._process_boundary_if_needed(update)
            final = self._close_pending_segment(
                include_unconfirmed=True,
            )
            update = _with_final(update, final)

        if skipped_silent_process and not self._has_pending_transcript():
            self._reset_processing_window(offset_ms=end_ms)

        return update

    def build_prompt(self) -> tuple[str, str]:
        """Return the prompt and in-buffer committed context."""
        separator = self._backend.separator
        # TODO: Validate the prompt split before using context output; the upstream
        # len-1 split can keep one scrolled-out word out of the prompt [2026-05-08].
        # Keep the current split temporarily until boundary handling is finalized.
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

        # TODO: Verify track-stop audio shorter than min_chunk_ms before changing
        # finish; upstream-style flush can skip unprocessed tail audio [2026-05-08].
        # Keep the current finish path temporarily until boundary handling is finalized.
        final = self._close_pending_segment(
            include_unconfirmed=True,
        )
        self._closed = True
        return _with_final(_empty_update(), final)

    def close(self) -> None:
        """Close the processor and clear connection-local buffers."""
        self._closed = True
        self._audio_buffer.clear()
        self._committed_history.clear()
        self._pending_final_words.clear()
        self._boundary_final_chunk = None
        self._hypothesis.reset(offset_ms=self._buffer_time_offset_ms)
        self._samples_since_process = 0
        self._speech_seen_since_process = False

    def _process_boundary_if_needed(
        self,
        update: WhisperStreamingProcessorUpdate,
    ) -> WhisperStreamingProcessorUpdate:
        if update.processed or not self._should_process_boundary():
            return update

        stable_words = (*self._pending_final_words, *self._hypothesis.complete())
        model_output = self._transcribe(prompt="")
        self._samples_since_process = 0
        self._speech_seen_since_process = False
        confirmed_words = _offset_words(
            model_output.words,
            offset_ms=self._buffer_time_offset_ms,
        )
        boundary_final = _build_boundary_final_chunk(
            stable_words=stable_words,
            confirmed_words=confirmed_words,
            separator=self._backend.separator,
        )
        if boundary_final is None:
            return _with_processed(update)

        self._boundary_final_chunk = boundary_final
        return _with_processed(update)

    def _process_iter(self) -> WhisperStreamingProcessorUpdate:
        prompt, _ = self.build_prompt()
        model_output = self._transcribe(prompt=prompt)
        self._samples_since_process = 0
        self._speech_seen_since_process = False

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
        hypothesis_words = list(self._hypothesis.complete())
        if include_unconfirmed:
            words.extend(hypothesis_words)

        final = self._boundary_final_chunk or _to_chunk(
            tuple(words),
            self._backend.separator,
        )
        self._pending_final_words.clear()
        self._boundary_final_chunk = None
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
        self._speech_seen_since_process = False

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

    def _should_process_boundary(self) -> bool:
        return bool(self._pending_final_words) and self._samples_since_process > 0

    def _should_skip_silent_process(
        self,
        silence_update: WhisperStreamingSilenceUpdate,
    ) -> bool:
        return (
            silence_update.is_silence
            and not self._speech_seen_since_process
            and not self._has_pending_transcript()
        )

    def _has_pending_transcript(self) -> bool:
        return bool(self._pending_final_words or self._hypothesis.complete())

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


def _build_boundary_final_chunk(
    *,
    stable_words: tuple[WhisperStreamingWord, ...],
    confirmed_words: tuple[WhisperStreamingWord, ...],
    separator: str,
) -> WhisperStreamingTranscriptChunk | None:
    if not stable_words or not confirmed_words:
        return None

    stable_text = _join_words(stable_words, separator).strip()
    confirmed_text = _join_words(confirmed_words, separator).strip()
    anchor_text = _strip_trailing_sentence_end(stable_text)
    if len(anchor_text) < _MIN_BOUNDARY_ANCHOR_CHARS:
        return None

    prefix_end = _find_confirmed_prefix_end(
        anchor_text=anchor_text,
        confirmed_text=confirmed_text,
    )
    if prefix_end is None:
        return None

    extension_text = confirmed_text[prefix_end:].strip()
    if _ends_with_sentence_end(stable_text):
        extension_text = _trim_after_first_sentence_end(extension_text)
        extension_text = _trim_repeated_anchor_extension(
            anchor_text=anchor_text,
            extension_text=extension_text,
            separator=separator,
        )
    if not extension_text:
        return None

    final_text = _combine_boundary_text(
        anchor_text=anchor_text,
        extension_text=extension_text,
        separator=separator,
    )
    if final_text == stable_text:
        return None

    end_ms = _word_end_for_text_prefix(
        confirmed_words,
        separator=separator,
        char_count=prefix_end + len(extension_text),
    )
    return WhisperStreamingTranscriptChunk(
        start_ms=stable_words[0].start_ms,
        end_ms=end_ms,
        text=final_text,
    )


def _offset_words(
    words: tuple[WhisperStreamingWord, ...],
    *,
    offset_ms: int,
) -> tuple[WhisperStreamingWord, ...]:
    return tuple(
        WhisperStreamingWord(
            start_ms=word.start_ms + offset_ms,
            end_ms=word.end_ms + offset_ms,
            text=word.text,
        )
        for word in words
    )


def _join_words(words: tuple[WhisperStreamingWord, ...], separator: str) -> str:
    return separator.join(word.text for word in words)


def _strip_trailing_sentence_end(text: str) -> str:
    stripped = text.rstrip()
    while stripped and stripped[-1] in _SENTENCE_END_CHARS:
        stripped = stripped[:-1].rstrip()
    return stripped


def _ends_with_sentence_end(text: str) -> bool:
    stripped = text.rstrip()
    return bool(stripped) and stripped[-1] in _SENTENCE_END_CHARS


def _find_confirmed_prefix_end(
    *,
    anchor_text: str,
    confirmed_text: str,
) -> int | None:
    if not confirmed_text:
        return None

    similar_prefix_end = _find_similar_prefix_end(
        anchor_text=anchor_text,
        confirmed_text=confirmed_text,
    )
    if similar_prefix_end is not None:
        return similar_prefix_end

    return _find_tail_anchor_prefix_end(
        anchor_text=anchor_text,
        confirmed_text=confirmed_text,
    )


def _find_similar_prefix_end(
    *,
    anchor_text: str,
    confirmed_text: str,
) -> int | None:
    anchor_length = len(anchor_text)
    window = max(4, anchor_length // 5)
    start = max(1, anchor_length - window)
    end = min(len(confirmed_text), anchor_length + window)
    best_end: int | None = None
    best_ratio = 0.0
    best_distance = anchor_length
    for candidate_end in range(start, end + 1):
        ratio = SequenceMatcher(
            None,
            anchor_text,
            confirmed_text[:candidate_end],
        ).ratio()
        distance = abs(candidate_end - anchor_length)
        if ratio > best_ratio or (ratio == best_ratio and distance < best_distance):
            best_end = candidate_end
            best_ratio = ratio
            best_distance = distance

    if best_end is None or best_ratio < _BOUNDARY_PREFIX_RATIO:
        return None
    return best_end


def _find_tail_anchor_prefix_end(
    *,
    anchor_text: str,
    confirmed_text: str,
) -> int | None:
    anchor_length = len(anchor_text)
    max_distance = max(4, anchor_length // 2)
    max_tail_length = min(anchor_length, len(confirmed_text))
    for tail_length in range(
        max_tail_length,
        _MIN_BOUNDARY_ANCHOR_CHARS - 1,
        -1,
    ):
        tail = anchor_text[-tail_length:]
        tail_start = confirmed_text.rfind(tail)
        while tail_start >= 0:
            candidate_end = tail_start + tail_length
            if (
                abs(candidate_end - anchor_length) <= max_distance
                and (
                    tail_length >= _STRONG_BOUNDARY_TAIL_CHARS
                    or tail_length == anchor_length
                )
            ) or (
                abs(candidate_end - anchor_length) <= max_distance
                and _has_similar_tail_prefix(
                    anchor_text=anchor_text,
                    confirmed_text=confirmed_text,
                    anchor_tail_length=tail_length,
                    confirmed_tail_start=tail_start,
                )
            ):
                return candidate_end
            tail_start = confirmed_text.rfind(tail, 0, tail_start)
    return None


def _has_similar_tail_prefix(
    *,
    anchor_text: str,
    confirmed_text: str,
    anchor_tail_length: int,
    confirmed_tail_start: int,
) -> bool:
    anchor_prefix = anchor_text[: len(anchor_text) - anchor_tail_length].strip()
    confirmed_prefix = confirmed_text[:confirmed_tail_start].strip()
    if len(anchor_prefix) < _MIN_BOUNDARY_ANCHOR_CHARS:
        return True

    ratio = SequenceMatcher(None, anchor_prefix, confirmed_prefix).ratio()
    return ratio >= _BOUNDARY_TAIL_PREFIX_RATIO


def _trim_after_first_sentence_end(text: str) -> str:
    for index, character in enumerate(text):
        if character in _SENTENCE_END_CHARS:
            return text[: index + 1]
    return text


def _trim_repeated_anchor_extension(
    *,
    anchor_text: str,
    extension_text: str,
    separator: str,
) -> str:
    anchor_prefix = _repeat_anchor_prefix(anchor_text, separator)
    if len(anchor_prefix) < _MIN_BOUNDARY_ANCHOR_CHARS:
        return extension_text

    repeat_start = extension_text.find(anchor_prefix)
    if repeat_start <= 0:
        return extension_text
    return extension_text[:repeat_start].strip()


def _repeat_anchor_prefix(text: str, separator: str) -> str:
    if separator:
        parts = [part for part in text.split(separator) if part]
        if len(parts) >= 2:
            return separator.join(parts[:2])
    return text[: min(len(text), 12)]


def _word_end_for_text_prefix(
    words: tuple[WhisperStreamingWord, ...],
    *,
    separator: str,
    char_count: int,
) -> int:
    consumed = 0
    for index, word in enumerate(words):
        if index > 0:
            consumed += len(separator)
        consumed += len(word.text)
        if consumed >= char_count:
            return word.end_ms
    return words[-1].end_ms


def _combine_boundary_text(
    *,
    anchor_text: str,
    extension_text: str,
    separator: str,
) -> str:
    if not separator or not anchor_text or not extension_text:
        return f"{anchor_text}{extension_text}"
    if extension_text[0] in _SENTENCE_END_CHARS:
        return f"{anchor_text}{extension_text}"
    return f"{anchor_text}{separator}{extension_text}"


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


def _with_processed(
    update: WhisperStreamingProcessorUpdate,
) -> WhisperStreamingProcessorUpdate:
    if update.processed:
        return update
    return WhisperStreamingProcessorUpdate(
        processed=True,
        preview=update.preview,
        committed_partial=update.committed_partial,
        final=update.final,
        context_reset=update.context_reset,
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
