"""Adapt WhisperStreaming runtime output to the Live transcriber contract."""

import logging
from dataclasses import dataclass
from typing import Protocol

from nola.application.live.realtime.protocol import LiveRealtimeErrorCode
from nola.application.live.realtime.transcriber import (
    LiveRealtimeTranscriberFrame,
    LiveRealtimeTranscriberResult,
    LiveRealtimeTranscriptCommittedPartial,
    LiveRealtimeTranscriptFinalCandidate,
    LiveRealtimeTranscriptPreview,
)
from nola.application.live.realtime.whisper_streaming.config import (
    WhisperStreamingRuntimeConfig,
    validate_whisper_streaming_runtime_config,
)
from nola.application.live.realtime.whisper_streaming.errors import (
    WhisperStreamingRuntimeError,
)
from nola.application.live.realtime.whisper_streaming.loader import (
    WhisperStreamingRuntimeLoader,
)
from nola.application.live.realtime.whisper_streaming.processor import (
    WhisperStreamingOnlineProcessor,
)
from nola.application.live.realtime.whisper_streaming.types import (
    WhisperStreamingInferenceBackend,
    WhisperStreamingProcessorUpdate,
    WhisperStreamingTranscriptChunk,
)
from nola.application.live.types import LiveTrackSource

logger = logging.getLogger(__name__)


class WhisperStreamingProcessorFactory(Protocol):
    """Create one track-scoped WhisperStreaming processor."""

    def __call__(
        self,
        *,
        backend: WhisperStreamingInferenceBackend,
        config: WhisperStreamingRuntimeConfig | None = None,
        offset_ms: int = 0,
    ) -> WhisperStreamingOnlineProcessor:
        """Return a processor for one Live track."""
        ...


@dataclass
class _TrackTranscriberState:
    """Keep one track-scoped processor and event counters."""

    source: LiveTrackSource
    processor: WhisperStreamingOnlineProcessor
    preview_index: int = 0
    committed_index: int = 0


class WhisperStreamingLiveTranscriber:
    """Map Live waveform frames to track-scoped WhisperStreaming processors."""

    def __init__(
        self,
        *,
        backend: WhisperStreamingInferenceBackend,
        config: WhisperStreamingRuntimeConfig | None = None,
        processor_factory: WhisperStreamingProcessorFactory = (
            WhisperStreamingOnlineProcessor
        ),
    ) -> None:
        self._backend = backend
        self._config = validate_whisper_streaming_runtime_config(
            config or WhisperStreamingRuntimeConfig()
        )
        self._processor_factory = processor_factory
        self._tracks: dict[str, _TrackTranscriberState] = {}
        self._released = False

    @classmethod
    def from_loader(
        cls,
        loader: WhisperStreamingRuntimeLoader,
        *,
        config: WhisperStreamingRuntimeConfig | None = None,
    ) -> "WhisperStreamingLiveTranscriber":
        """Create a transcriber from a resolved Live runtime loader."""
        return cls(backend=loader.load_backend(), config=config)

    def accept_frame(
        self,
        frame: LiveRealtimeTranscriberFrame,
    ) -> tuple[LiveRealtimeTranscriberResult, ...]:
        """Accept one waveform frame and emit Live transcript results."""
        self._ensure_open()
        state = self._get_or_create_track_state(frame)
        update = self._accept_processor_frame(state=state, frame=frame)
        return self._update_to_results(
            track_id=frame.track_id,
            source=frame.source,
            state=state,
            update=update,
        )

    def flush_track(
        self,
        *,
        track_id: str,
        source: LiveTrackSource,
    ) -> tuple[LiveRealtimeTranscriberResult, ...]:
        """Flush and remove one track processor."""
        self._ensure_open()
        state = self._tracks.get(track_id)
        if state is None:
            return ()
        if state.source != source:
            raise _runtime_error(
                code="invalid_track",
                message="WhisperStreaming track source does not match",
            )

        try:
            update = self._finish_processor(state)
            return self._update_to_results(
                track_id=track_id,
                source=source,
                state=state,
                update=update,
            )
        finally:
            self._tracks.pop(track_id, None)
            state.processor.close()

    def flush_all(self) -> tuple[LiveRealtimeTranscriberResult, ...]:
        """Flush and remove every open track processor."""
        self._ensure_open()
        results: list[LiveRealtimeTranscriberResult] = []
        for track_id, state in tuple(self._tracks.items()):
            try:
                update = self._finish_processor(state)
                results.extend(
                    self._update_to_results(
                        track_id=track_id,
                        source=state.source,
                        state=state,
                        update=update,
                    )
                )
            finally:
                self._tracks.pop(track_id, None)
                state.processor.close()
        return tuple(results)

    def release(self) -> None:
        """Release all processors and the shared model backend once."""
        if self._released:
            return

        self._released = True
        for state in tuple(self._tracks.values()):
            try:
                state.processor.close()
            except Exception:
                logger.warning(
                    "WhisperStreaming processor close failed during release",
                    exc_info=True,
                )
        self._tracks.clear()
        try:
            self._backend.close()
        except Exception:
            logger.warning(
                "WhisperStreaming backend close failed during release",
                exc_info=True,
            )

    def _get_or_create_track_state(
        self,
        frame: LiveRealtimeTranscriberFrame,
    ) -> _TrackTranscriberState:
        state = self._tracks.get(frame.track_id)
        if state is not None:
            if state.source != frame.source:
                raise _runtime_error(
                    code="invalid_track",
                    message="WhisperStreaming track source does not match",
                )
            return state

        processor = self._processor_factory(
            backend=self._backend,
            config=self._config,
            offset_ms=frame.start_ms,
        )
        state = _TrackTranscriberState(
            source=frame.source,
            processor=processor,
        )
        self._tracks[frame.track_id] = state
        return state

    def _accept_processor_frame(
        self,
        *,
        state: _TrackTranscriberState,
        frame: LiveRealtimeTranscriberFrame,
    ) -> WhisperStreamingProcessorUpdate:
        try:
            return state.processor.accept_waveform(
                frame.waveform,
                start_ms=frame.start_ms,
                end_ms=frame.end_ms,
            )
        except WhisperStreamingRuntimeError:
            raise
        except Exception as error:
            raise _runtime_error(
                code="runtime_inference_failed",
                message="WhisperStreaming inference failed",
            ) from error

    def _finish_processor(
        self,
        state: _TrackTranscriberState,
    ) -> WhisperStreamingProcessorUpdate:
        try:
            return state.processor.finish()
        except WhisperStreamingRuntimeError:
            raise
        except Exception as error:
            raise _runtime_error(
                code="runtime_inference_failed",
                message="WhisperStreaming track flush failed",
            ) from error

    def _update_to_results(
        self,
        *,
        track_id: str,
        source: LiveTrackSource,
        state: _TrackTranscriberState,
        update: WhisperStreamingProcessorUpdate,
    ) -> tuple[LiveRealtimeTranscriberResult, ...]:
        results: list[LiveRealtimeTranscriberResult] = []

        if not update.committed_partial.is_empty:
            state.committed_index += 1
            start_ms, end_ms = _require_chunk_bounds(update.committed_partial)
            results.append(
                LiveRealtimeTranscriptCommittedPartial(
                    track_id=track_id,
                    source=source,
                    committed_index=state.committed_index,
                    start_ms=start_ms,
                    end_ms=end_ms,
                    text=_clean_text(update.committed_partial),
                    language=None,
                    confidence=None,
                )
            )

        if not update.preview.is_empty:
            state.preview_index += 1
            start_ms, end_ms = _require_chunk_bounds(update.preview)
            results.append(
                LiveRealtimeTranscriptPreview(
                    track_id=track_id,
                    source=source,
                    preview_index=state.preview_index,
                    start_ms=start_ms,
                    end_ms=end_ms,
                    text=_clean_text(update.preview),
                    language=None,
                    confidence=None,
                )
            )

        if not update.final.is_empty:
            start_ms, end_ms = _require_chunk_bounds(update.final)
            results.append(
                LiveRealtimeTranscriptFinalCandidate(
                    track_id=track_id,
                    source=source,
                    start_ms=start_ms,
                    end_ms=end_ms,
                    text=_clean_text(update.final),
                    language=None,
                    confidence=None,
                )
            )

        return tuple(results)

    def _ensure_open(self) -> None:
        if self._released:
            raise _runtime_error(
                code="runtime_inference_failed",
                message="WhisperStreaming transcriber is released",
            )


def _require_chunk_bounds(chunk: WhisperStreamingTranscriptChunk) -> tuple[int, int]:
    if chunk.start_ms is None or chunk.end_ms is None:
        raise _runtime_error(
            code="runtime_inference_failed",
            message="WhisperStreaming transcript timing is invalid",
        )
    return chunk.start_ms, chunk.end_ms


def _clean_text(chunk: WhisperStreamingTranscriptChunk) -> str:
    return chunk.text.strip()


def _runtime_error(
    *,
    code: LiveRealtimeErrorCode,
    message: str,
) -> WhisperStreamingRuntimeError:
    return WhisperStreamingRuntimeError(code=code, message=message)


__all__ = ["WhisperStreamingLiveTranscriber", "WhisperStreamingProcessorFactory"]
