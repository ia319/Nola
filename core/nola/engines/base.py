"""Define base transcription engine interface."""

from abc import ABC, abstractmethod
from collections.abc import Callable, Generator
from dataclasses import dataclass, field

from nola.config import settings

# Progress callback type: receives progress percentage (0-100)
ProgressCallback = Callable[[float], None]


@dataclass
class Segment:
    """Represent a transcribed segment with timing."""

    start: float
    end: float
    text: str


@dataclass
class EngineConfig:
    """Engine initialization configuration."""

    model_size: str = field(default_factory=lambda: settings.model_size)
    device: str = field(default_factory=lambda: settings.device)
    compute_type: str = field(default_factory=lambda: settings.compute_type)


@dataclass
class TranscribeOptions:
    """Transcription options passed to transcribe method.

    All default values match faster-whisper defaults.
    """

    # Language settings
    language: str | None = None  # Auto-detect if None
    task: str = "transcribe"  # "transcribe" or "translate"

    # Decoding parameters
    beam_size: int = 5
    best_of: int = 5
    patience: float = 1.0
    length_penalty: float = 1.0
    repetition_penalty: float = 1.0
    no_repeat_ngram_size: int = 0
    temperature: float | list[float] = field(
        default_factory=lambda: [0.0, 0.2, 0.4, 0.6, 0.8, 1.0]
    )

    # Quality thresholds
    compression_ratio_threshold: float | None = 2.4
    log_prob_threshold: float | None = -1.0
    no_speech_threshold: float | None = 0.6

    # Context control
    condition_on_previous_text: bool = True
    prompt_reset_on_temperature: float = 0.5
    initial_prompt: str | None = None
    prefix: str | None = None
    hotwords: str | None = None

    # Token control
    suppress_blank: bool = True
    suppress_tokens: list[int] | None = field(default_factory=lambda: [-1])
    max_new_tokens: int | None = None

    # Timestamp settings
    without_timestamps: bool = False
    max_initial_timestamp: float = 1.0
    word_timestamps: bool = False
    prepend_punctuations: str = '"\'"¿([{-'
    append_punctuations: str = '"\'.。,，!！?？:：")]}、'

    # VAD settings
    vad_filter: bool = False
    vad_parameters: dict[str, object] | None = None

    # Advanced
    multilingual: bool = False
    clip_timestamps: str | list[float] = "0"
    hallucination_silence_threshold: float | None = None
    language_detection_threshold: float | None = 0.5
    language_detection_segments: int = 1


class TranscriptionEngine(ABC):
    """Define abstract interface for transcription engines."""

    @abstractmethod
    def transcribe(
        self,
        file_path: str,
        options: TranscribeOptions | None = None,
        on_progress: ProgressCallback | None = None,
    ) -> Generator[Segment, None, None]:
        """Transcribe audio file and yield segments.

        Args:
            file_path: Path to the audio file.
            options: Transcription options. Uses defaults if None.
            on_progress: Optional callback for progress updates (0-100).

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
