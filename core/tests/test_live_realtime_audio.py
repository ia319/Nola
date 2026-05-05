"""Tests for live realtime audio standardization."""

import struct
import wave
from pathlib import Path

import pytest

from nola.application.live.realtime import (
    LiveRealtimeAudioFrameMetadata,
    LiveRealtimeSessionError,
    Pcm16WavWriter,
    build_pcm16le_frame,
    ensure_diagnostics_output_dir,
    pcm16le_to_float32_waveform,
)


def _metadata(
    *, duration_ms: int = 20, byte_length: int = 640
) -> LiveRealtimeAudioFrameMetadata:
    return LiveRealtimeAudioFrameMetadata(
        track_id="track-001",
        source="microphone",
        sequence=0,
        captured_at_ms=0,
        duration_ms=duration_ms,
        byte_length=byte_length,
    )


def test_pcm16le_to_float32_waveform_converts_boundary_values() -> None:
    """PCM16LE conversion should only scale signed samples by 32768."""
    payload = struct.pack("<hhhh", -32768, -1, 0, 32767)

    waveform = pcm16le_to_float32_waveform(payload)

    assert waveform == pytest.approx((-1.0, -1 / 32768.0, 0.0, 32767 / 32768.0))


def test_build_pcm16le_frame_rejects_byte_length_duration_mismatch() -> None:
    """PCM frame validation should reject metadata that cannot match the payload."""
    with pytest.raises(LiveRealtimeSessionError) as error:
        build_pcm16le_frame(metadata=_metadata(byte_length=638), payload=b"\x00" * 638)

    assert error.value.code == "audio_frame_invalid"


def test_build_pcm16le_frame_rejects_oversized_payload() -> None:
    """PCM frame validation should enforce the server frame duration limit."""
    with pytest.raises(LiveRealtimeSessionError) as error:
        build_pcm16le_frame(
            metadata=_metadata(duration_ms=101, byte_length=3232),
            payload=b"\x00" * 3232,
        )

    assert error.value.code == "audio_frame_too_large"


def test_pcm16_wav_writer_outputs_mono_16khz_wav(tmp_path: Path) -> None:
    """WAV writer should preserve PCM frames as mono 16 kHz samples."""
    path = tmp_path / "capture.wav"
    writer = Pcm16WavWriter(path)
    writer.write_frame(b"\x00" * 640, duration_ms=20)
    writer.close()

    with wave.open(str(path), "rb") as wav_file:
        assert wav_file.getnchannels() == 1
        assert wav_file.getsampwidth() == 2
        assert wav_file.getframerate() == 16000
        assert wav_file.getnframes() == 320
        assert wav_file.readframes(320) == b"\x00" * 640


def test_diagnostics_output_dir_rejects_repository_paths(tmp_path: Path) -> None:
    """Diagnostics output path validation should reject paths inside the repository."""
    repository_root = tmp_path / "repo"
    output_dir = repository_root / "diagnostics"

    with pytest.raises(LiveRealtimeSessionError) as error:
        ensure_diagnostics_output_dir(output_dir, repository_root=repository_root)

    assert error.value.code == "diagnostics_wav_output_invalid"
