"""Maintain LocalAgreement hypothesis state."""

from dataclasses import replace
from typing import Final

from nola.application.live.realtime.whisper_streaming.config import (
    WhisperStreamingRuntimeConfig,
)
from nola.application.live.realtime.whisper_streaming.types import (
    WhisperStreamingWord,
)

DUPLICATE_LOOKBACK_WINDOW_MS: Final = 1000


class LocalAgreementHypothesisBuffer:
    """Commit words shared by two consecutive model hypotheses."""

    def __init__(
        self,
        *,
        config: WhisperStreamingRuntimeConfig,
        offset_ms: int = 0,
    ) -> None:
        self._config = config
        # TODO: Validate pop(0) cost before replacing upstream list semantics with
        # deque [2026-05-08].
        self._committed_in_buffer: list[WhisperStreamingWord] = []
        self._buffer: list[WhisperStreamingWord] = []
        self._new: list[WhisperStreamingWord] = []
        self._last_committed_end_ms = offset_ms

    @property
    def last_committed_end_ms(self) -> int:
        """Return the latest committed word end timestamp."""
        return self._last_committed_end_ms

    def insert(
        self,
        words: tuple[WhisperStreamingWord, ...],
        *,
        offset_ms: int,
    ) -> None:
        """Insert one model hypothesis after mapping timestamps to session time."""
        mapped_words = tuple(_apply_offset(word, offset_ms) for word in words)
        boundary_ms = self._last_committed_end_ms - self._config.timestamp_tolerance_ms
        self._new = [word for word in mapped_words if word.start_ms > boundary_ms]
        self._drop_duplicate_head()

    def flush(self) -> tuple[WhisperStreamingWord, ...]:
        """Return words confirmed by the current and previous hypotheses."""
        committed: list[WhisperStreamingWord] = []
        while self._new and self._buffer:
            candidate = self._new[0]
            previous = self._buffer[0]
            if candidate.text != previous.text:
                break

            self._new.pop(0)
            self._buffer.pop(0)
            monotonic_candidate = self._to_monotonic_word(candidate)
            if monotonic_candidate is None:
                continue

            committed.append(monotonic_candidate)
            self._last_committed_end_ms = monotonic_candidate.end_ms

        self._buffer = self._new
        self._new = []
        self._committed_in_buffer.extend(committed)
        return tuple(committed)

    def complete(self) -> tuple[WhisperStreamingWord, ...]:
        """Return the current unconfirmed hypothesis."""
        return tuple(self._buffer)

    def pop_committed(self, end_ms: int) -> None:
        """Remove committed words that scrolled out of the audio buffer."""
        while (
            self._committed_in_buffer and self._committed_in_buffer[0].end_ms <= end_ms
        ):
            self._committed_in_buffer.pop(0)

    def reset(self, *, offset_ms: int) -> None:
        """Reset hypothesis state at an explicit processing boundary."""
        self._committed_in_buffer.clear()
        self._buffer.clear()
        self._new.clear()
        self._last_committed_end_ms = offset_ms

    def _drop_duplicate_head(self) -> None:
        if not self._new or not self._committed_in_buffer:
            return

        first_new = self._new[0]
        if (
            abs(first_new.start_ms - self._last_committed_end_ms)
            >= DUPLICATE_LOOKBACK_WINDOW_MS
        ):
            return

        max_ngram = min(
            len(self._committed_in_buffer),
            len(self._new),
            self._config.max_duplicate_ngram,
        )
        # TODO: Validate longest-match duplicate trimming with repeated words; the
        # upstream smallest-match scan can leave a boundary duplicate [2026-05-08].
        for ngram_size in range(1, max_ngram + 1):
            committed_tail = _join_text(tuple(self._committed_in_buffer[-ngram_size:]))
            new_head = _join_text(tuple(self._new[:ngram_size]))
            if committed_tail == new_head:
                del self._new[:ngram_size]
                break

    def _to_monotonic_word(
        self,
        word: WhisperStreamingWord,
    ) -> WhisperStreamingWord | None:
        if word.end_ms <= self._last_committed_end_ms:
            return None
        if word.start_ms >= self._last_committed_end_ms:
            return word
        return replace(word, start_ms=self._last_committed_end_ms)


def _apply_offset(
    word: WhisperStreamingWord,
    offset_ms: int,
) -> WhisperStreamingWord:
    return replace(
        word,
        start_ms=word.start_ms + offset_ms,
        end_ms=word.end_ms + offset_ms,
    )


def _join_text(words: tuple[WhisperStreamingWord, ...]) -> str:
    return " ".join(word.text for word in words)


__all__ = ["LocalAgreementHypothesisBuffer"]
