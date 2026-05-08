"""Unit tests for WhisperStreaming LocalAgreement hypothesis behavior."""

from nola.application.live.realtime.whisper_streaming import (
    LocalAgreementHypothesisBuffer,
    WhisperStreamingRuntimeConfig,
    WhisperStreamingWord,
)


def test_local_agreement_commits_shared_prefix_after_second_insert() -> None:
    """Validate LocalAgreement commits only repeated hypothesis prefixes."""
    buffer = LocalAgreementHypothesisBuffer(config=WhisperStreamingRuntimeConfig())

    buffer.insert(
        (
            _word(0, 400, "hello"),
            _word(400, 800, "world"),
        ),
        offset_ms=1000,
    )

    assert buffer.flush() == ()
    assert buffer.complete() == (
        _word(1000, 1400, "hello"),
        _word(1400, 1800, "world"),
    )

    buffer.insert(
        (
            _word(0, 400, "hello"),
            _word(400, 850, "world"),
            _word(850, 1200, "again"),
        ),
        offset_ms=1000,
    )

    assert buffer.flush() == (
        _word(1000, 1400, "hello"),
        _word(1400, 1850, "world"),
    )
    assert buffer.complete() == (_word(1850, 2200, "again"),)


def test_local_agreement_drops_committed_tail_duplicate_from_new_head() -> None:
    """Validate boundary n-gram deduplication."""
    buffer = LocalAgreementHypothesisBuffer(config=WhisperStreamingRuntimeConfig())
    stable_words = (
        _word(0, 500, "hello"),
        _word(500, 1000, "world"),
    )

    buffer.insert(stable_words, offset_ms=0)
    assert buffer.flush() == ()
    buffer.insert(stable_words, offset_ms=0)
    assert buffer.flush() == stable_words

    buffer.insert(
        (
            _word(950, 1000, "hello"),
            _word(1000, 1100, "world"),
            _word(1100, 1300, "again"),
        ),
        offset_ms=0,
    )

    assert buffer.flush() == ()
    assert buffer.complete() == (_word(1100, 1300, "again"),)


def test_local_agreement_ignores_non_monotonic_commits() -> None:
    """Validate Nola timestamp protection for unstable model output."""
    buffer = LocalAgreementHypothesisBuffer(config=WhisperStreamingRuntimeConfig())
    stable_word = (_word(0, 1000, "stable"),)

    buffer.insert(stable_word, offset_ms=0)
    assert buffer.flush() == ()
    buffer.insert(stable_word, offset_ms=0)
    assert buffer.flush() == stable_word

    non_monotonic = (_word(950, 980, "next"),)
    buffer.insert(non_monotonic, offset_ms=0)
    assert buffer.flush() == ()
    buffer.insert(non_monotonic, offset_ms=0)

    assert buffer.flush() == ()
    assert buffer.last_committed_end_ms == 1000
    assert buffer.complete() == ()


def _word(start_ms: int, end_ms: int, text: str) -> WhisperStreamingWord:
    return WhisperStreamingWord(start_ms=start_ms, end_ms=end_ms, text=text)
