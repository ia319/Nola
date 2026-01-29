"""Transcription-related Pydantic schemas."""

from typing import Any

from pydantic import BaseModel, Field


class TranscriptionRequest(BaseModel):
    """Transcription request with optional parameters.

    All parameters default to None, meaning "use engine default".
    See TranscribeOptions in engines/base.py for actual defaults.
    """

    file_id: str = Field(..., description="File ID from upload API")

    # Language settings
    language: str | None = Field(None, description="Language code (e.g., 'en', 'zh')")
    task: str | None = Field(None, description="'transcribe' or 'translate'")

    # Decoding parameters
    beam_size: int | None = Field(None, ge=1, le=10, description="Beam size for decoding")
    best_of: int | None = Field(None, ge=1, description="Number of candidates")
    patience: float | None = Field(None, ge=0, description="Beam search patience")
    length_penalty: float | None = Field(None, description="Length penalty")
    repetition_penalty: float | None = Field(None, ge=1, description="Repetition penalty")
    no_repeat_ngram_size: int | None = Field(None, ge=0, description="No repeat n-gram size")
    temperature: float | list[float] | None = Field(
        None, description="Sampling temperature(s)"
    )

    # Quality thresholds
    compression_ratio_threshold: float | None = Field(
        None, description="Compression ratio threshold"
    )
    log_prob_threshold: float | None = Field(None, description="Log probability threshold")
    no_speech_threshold: float | None = Field(None, description="No speech threshold")

    # Context control
    condition_on_previous_text: bool | None = Field(
        None, description="Condition on previous text"
    )
    prompt_reset_on_temperature: float | None = Field(
        None, description="Reset prompt on temperature"
    )
    initial_prompt: str | None = Field(None, description="Initial prompt for context")
    prefix: str | None = Field(None, description="Prefix for each segment")
    hotwords: str | None = Field(None, description="Hotwords to boost recognition")

    # Token control
    suppress_blank: bool | None = Field(None, description="Suppress blank outputs")
    suppress_tokens: list[int] | None = Field(None, description="Token IDs to suppress")
    max_new_tokens: int | None = Field(None, description="Max new tokens per segment")

    # Timestamp settings
    without_timestamps: bool | None = Field(None, description="Disable timestamps")
    max_initial_timestamp: float | None = Field(None, description="Max initial timestamp")
    word_timestamps: bool | None = Field(None, description="Enable word-level timestamps")
    prepend_punctuations: str | None = Field(None, description="Punctuations to prepend")
    append_punctuations: str | None = Field(None, description="Punctuations to append")

    # VAD settings
    vad_filter: bool | None = Field(None, description="Enable VAD filtering")
    vad_parameters: dict[str, Any] | None = Field(None, description="VAD parameters")

    # Advanced
    multilingual: bool | None = Field(None, description="Enable multilingual mode")
    clip_timestamps: str | list[float] | None = Field(
        None, description="Clip timestamps"
    )
    hallucination_silence_threshold: float | None = Field(
        None, description="Hallucination silence threshold"
    )
    language_detection_threshold: float | None = Field(
        None, description="Language detection threshold"
    )
    language_detection_segments: int | None = Field(
        None, description="Segments for language detection"
    )

    def get_options_dict(self) -> dict[str, Any]:
        """Return non-None options as dict for storage."""
        return {
            k: v
            for k, v in self.model_dump(exclude={"file_id"}).items()
            if v is not None
        }
