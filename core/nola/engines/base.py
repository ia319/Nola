"""Define base transcription engine interface."""

from abc import ABC, abstractmethod
from collections.abc import Generator
from dataclasses import dataclass


@dataclass
class Segment:
    """Represent a transcribed segment with timing."""

    start: float
    end: float
    text: str


@dataclass
class EngineConfig:
    """Engine initialization configuration."""

    model_size: str = "base"
    device: str = "auto"
    compute_type: str = "default"


class TranscriptionEngine(ABC):
    """Define abstract interface for transcription engines."""

    @abstractmethod
    def transcribe(self, file_path: str) -> Generator[Segment, None, None]:
        """Transcribe audio file and yield segments.

        Args:
            file_path: Path to the audio file.

        Yields:
            Segment objects with start time, end time, and text.
        """
        pass

    @abstractmethod
    def transcribe_stream(self, audio_chunk: bytes) -> str | None:
        """Process audio chunk for real-time transcription.

        Args:
            audio_chunk: Raw audio bytes to process.

        Returns:
            Transcribed text or None if no speech detected.
        """
        pass
