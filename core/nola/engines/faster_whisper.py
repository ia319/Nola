"""Implement FasterWhisperEngine for transcription."""

from collections.abc import Generator
from dataclasses import asdict

from faster_whisper import WhisperModel

from nola.engines.base import (
    EngineConfig,
    Segment,
    TranscribeOptions,
    TranscriptionEngine,
)


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

    def transcribe(
        self,
        file_path: str,
        options: TranscribeOptions | None = None,
    ) -> Generator[Segment, None, None]:
        """Transcribe audio file and yield segments.

        Args:
            file_path: Path to the audio file.
            options: Transcription options. Uses defaults if None.

        Yields:
            Segment objects with start time, end time, and text.
        """
        opts = options or TranscribeOptions()

        # Convert dataclass to dict, excluding None values for optional params
        opts_dict = {k: v for k, v in asdict(opts).items() if v is not None}

        segments, _ = self.model.transcribe(file_path, **opts_dict)
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
