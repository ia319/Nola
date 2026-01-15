"""Implement FasterWhisperEngine for transcription."""

from collections.abc import Generator

from faster_whisper import WhisperModel

from nola.engines.base import EngineConfig, Segment, TranscriptionEngine


class FasterWhisperEngine(TranscriptionEngine):
    """Faster Whisper implementation of TranscriptionEngine."""

    def __init__(self, config: EngineConfig | None = None) -> None:
        """Initialize engine with configuration.

        Args:
            config: Engine configuration. Uses defaults if None.
        """
        cfg = config or EngineConfig()
        self.model = WhisperModel(
            cfg.model_size,
            device=cfg.device,
            compute_type=cfg.compute_type,
        )
        self._config = cfg

    def transcribe(self, file_path: str) -> Generator[Segment, None, None]:
        """Transcribe audio file and yield segments.

        Args:
            file_path: Path to the audio file.

        Yields:
            Segment objects with start time, end time, and text.
        """
        segments, _ = self.model.transcribe(file_path, vad_filter=True)
        for seg in segments:
            yield Segment(start=seg.start, end=seg.end, text=seg.text.strip())

    def transcribe_stream(self, audio_chunk: bytes) -> str | None:
        """Process audio chunk for real-time transcription.

        Note:
            Not implemented yet. Will be added in Phase 6.

        Raises:
            NotImplementedError: Always raised, streaming not yet supported.
        """
        raise NotImplementedError("Streaming transcription not implemented yet")
