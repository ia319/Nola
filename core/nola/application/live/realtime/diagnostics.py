"""Write explicit live realtime WAV diagnostics."""

import json
import tempfile
import wave
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal, TypeAlias
from wave import Wave_write

from nola.application.live.realtime.audio import LiveRealtimePcm16Frame
from nola.application.live.realtime.errors import LiveRealtimeSessionError
from nola.application.live.realtime.protocol import (
    LIVE_REALTIME_AUDIO_CHANNEL_COUNT,
    LIVE_REALTIME_AUDIO_SAMPLE_RATE,
    LIVE_REALTIME_DIAGNOSTICS_WAV_DEFAULT_MAX_BYTES,
    LIVE_REALTIME_DIAGNOSTICS_WAV_DEFAULT_MAX_DURATION_MS,
    LIVE_REALTIME_DIAGNOSTICS_WAV_MAX_BYTES,
    LIVE_REALTIME_DIAGNOSTICS_WAV_MAX_DURATION_MS,
)
from nola.application.live.types import LiveTrackSource
from nola.common.types import JsonDict, JsonValue

LiveRealtimeDiagnosticsWavStopReason: TypeAlias = Literal[
    "client_stop",
    "session_finish",
    "connection_closed",
    "limit_exceeded",
    "write_failed",
]

_PCM16_SAMPLE_WIDTH_BYTES = 2
_WAV_HEADER_BYTES = 44


@dataclass(frozen=True)
class LiveRealtimeDiagnosticsWavStart:
    """Carry one diagnostics WAV start command."""

    max_duration_ms: int | None
    max_bytes: int | None
    track_ids: tuple[str, ...] | None


@dataclass(frozen=True)
class LiveRealtimeDiagnosticsWavFile:
    """Describe one written diagnostics WAV file."""

    track_id: str
    source: LiveTrackSource
    path: str
    duration_ms: int
    audio_byte_length: int
    file_byte_length: int

    def to_manifest(self) -> JsonDict:
        """Return a JSON-serializable file manifest entry."""
        return {
            "track_id": self.track_id,
            "source": self.source,
            "path": self.path,
            "duration_ms": self.duration_ms,
            "audio_byte_length": self.audio_byte_length,
            "file_byte_length": self.file_byte_length,
        }


@dataclass(frozen=True)
class LiveRealtimeDiagnosticsWavStarted:
    """Describe a started diagnostics WAV capture."""

    output_dir: str
    manifest_path: str
    max_duration_ms: int
    max_bytes: int
    track_ids: tuple[str, ...] | None


@dataclass(frozen=True)
class LiveRealtimeDiagnosticsWavStopped:
    """Describe a stopped diagnostics WAV capture."""

    output_dir: str
    manifest_path: str
    files: tuple[LiveRealtimeDiagnosticsWavFile, ...]
    total_file_byte_length: int
    reason: LiveRealtimeDiagnosticsWavStopReason


class Pcm16WavWriter:
    """Write PCM16LE frames as a mono 16 kHz WAV file."""

    def __init__(self, path: Path) -> None:
        self.path = path
        self._writer: Wave_write | None = None
        self._audio_byte_length = 0
        self._duration_ms = 0

    @property
    def duration_ms(self) -> int:
        """Return the accumulated audio duration."""
        return self._duration_ms

    @property
    def audio_byte_length(self) -> int:
        """Return the accumulated PCM payload byte length."""
        return self._audio_byte_length

    @property
    def file_byte_length(self) -> int:
        """Return the estimated WAV file byte length."""
        if self._audio_byte_length == 0:
            return 0
        return _WAV_HEADER_BYTES + self._audio_byte_length

    def write_frame(self, payload: bytes, *, duration_ms: int) -> None:
        """Append one PCM16LE frame."""
        writer = self._ensure_open()
        writer.writeframes(payload)
        self._audio_byte_length += len(payload)
        self._duration_ms += duration_ms

    def close(self) -> None:
        """Close the WAV file if it has been opened."""
        if self._writer is not None:
            self._writer.close()
            self._writer = None

    def to_file(
        self,
        *,
        track_id: str,
        source: LiveTrackSource,
    ) -> LiveRealtimeDiagnosticsWavFile:
        """Return the public metadata for this WAV file."""
        return LiveRealtimeDiagnosticsWavFile(
            track_id=track_id,
            source=source,
            path=str(self.path),
            duration_ms=self._duration_ms,
            audio_byte_length=self._audio_byte_length,
            file_byte_length=self.file_byte_length,
        )

    def _ensure_open(self) -> Wave_write:
        if self._writer is None:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            writer = wave.open(str(self.path), "wb")
            writer.setnchannels(LIVE_REALTIME_AUDIO_CHANNEL_COUNT)
            writer.setsampwidth(_PCM16_SAMPLE_WIDTH_BYTES)
            writer.setframerate(LIVE_REALTIME_AUDIO_SAMPLE_RATE)
            self._writer = writer
        return self._writer


class LiveRealtimeWavDiagnosticsSession:
    """Manage one explicit real-capture WAV diagnostic session."""

    def __init__(
        self,
        *,
        session_id: str,
        output_dir: Path,
        manifest_path: Path,
        max_duration_ms: int,
        max_bytes: int,
        track_ids: tuple[str, ...] | None,
    ) -> None:
        self._session_id = session_id
        self._output_dir = output_dir
        self._manifest_path = manifest_path
        self._max_duration_ms = max_duration_ms
        self._max_bytes = max_bytes
        self._track_ids = track_ids
        self._started_at = _utc_timestamp()
        self._stopped_at: str | None = None
        self._active = True
        self._writers: dict[str, tuple[LiveTrackSource, Pcm16WavWriter]] = {}

    @property
    def active(self) -> bool:
        """Return whether diagnostics capture is active."""
        return self._active

    @property
    def total_file_byte_length(self) -> int:
        """Return the total estimated WAV file byte length."""
        return sum(writer.file_byte_length for _, writer in self._writers.values())

    @classmethod
    def start(
        cls,
        *,
        session_id: str,
        output_base_dir: Path | None,
        repository_root: Path | None,
        command: LiveRealtimeDiagnosticsWavStart,
    ) -> "LiveRealtimeWavDiagnosticsSession":
        """Create a diagnostics session under an output directory outside the repo."""
        max_duration_ms = _resolve_max_duration_ms(command.max_duration_ms)
        max_bytes = _resolve_max_bytes(command.max_bytes)
        base_dir = ensure_diagnostics_output_dir(
            output_base_dir or default_diagnostics_output_dir(),
            repository_root=repository_root,
        )
        output_dir = base_dir / _diagnostics_session_name(session_id)
        try:
            output_dir.mkdir(parents=True, exist_ok=True)
        except OSError as error:
            raise LiveRealtimeSessionError(
                code="diagnostics_wav_write_failed",
                message="Diagnostics WAV output directory could not be created",
            ) from error

        manifest_path = output_dir / "manifest.json"
        session = cls(
            session_id=session_id,
            output_dir=output_dir,
            manifest_path=manifest_path,
            max_duration_ms=max_duration_ms,
            max_bytes=max_bytes,
            track_ids=command.track_ids,
        )
        session._write_manifest(status="started", reason=None)
        return session

    def started_event(self) -> LiveRealtimeDiagnosticsWavStarted:
        """Return public metadata for a started diagnostics session."""
        return LiveRealtimeDiagnosticsWavStarted(
            output_dir=str(self._output_dir),
            manifest_path=str(self._manifest_path),
            max_duration_ms=self._max_duration_ms,
            max_bytes=self._max_bytes,
            track_ids=self._track_ids,
        )

    def record_frame(self, frame: LiveRealtimePcm16Frame) -> None:
        """Write one validated PCM frame to its track WAV file."""
        if not self._active or not self._should_write_track(frame.track_id):
            return

        writer_entry = self._writers.get(frame.track_id)
        writer = writer_entry[1] if writer_entry is not None else None
        current_duration_ms = writer.duration_ms if writer is not None else 0
        projected_duration_ms = current_duration_ms + frame.duration_ms
        if projected_duration_ms > self._max_duration_ms:
            self.close_silently(reason="limit_exceeded")
            raise LiveRealtimeSessionError(
                code="diagnostics_wav_limit_exceeded",
                message="Diagnostics WAV duration limit was exceeded",
            )

        projected_bytes = self.total_file_byte_length + len(frame.payload)
        if writer is None:
            projected_bytes += _WAV_HEADER_BYTES
        if projected_bytes > self._max_bytes:
            self.close_silently(reason="limit_exceeded")
            raise LiveRealtimeSessionError(
                code="diagnostics_wav_limit_exceeded",
                message="Diagnostics WAV file size limit was exceeded",
            )

        if writer is None:
            writer = Pcm16WavWriter(
                self._output_dir
                / f"{_safe_filename(frame.track_id)}-{frame.source}.wav"
            )
            self._writers[frame.track_id] = (frame.source, writer)

        try:
            writer.write_frame(frame.payload, duration_ms=frame.duration_ms)
        except (OSError, wave.Error) as error:
            self.close_silently(reason="write_failed")
            raise LiveRealtimeSessionError(
                code="diagnostics_wav_write_failed",
                message="Diagnostics WAV frame could not be written",
            ) from error

    def stop(
        self,
        *,
        reason: LiveRealtimeDiagnosticsWavStopReason,
    ) -> LiveRealtimeDiagnosticsWavStopped:
        """Stop diagnostics capture and update the manifest."""
        self._active = False
        self._stopped_at = _utc_timestamp()
        try:
            for _, writer in self._writers.values():
                writer.close()
            self._write_manifest(status="stopped", reason=reason)
        except (OSError, wave.Error) as error:
            raise LiveRealtimeSessionError(
                code="diagnostics_wav_write_failed",
                message="Diagnostics WAV manifest could not be written",
            ) from error

        return self._stopped_event(reason=reason)

    def close_silently(
        self,
        *,
        reason: LiveRealtimeDiagnosticsWavStopReason,
    ) -> None:
        """Close writers without replacing the caller's original failure."""
        self._active = False
        self._stopped_at = _utc_timestamp()
        for _, writer in self._writers.values():
            try:
                writer.close()
            except (OSError, wave.Error):
                pass
        try:
            self._write_manifest(status="stopped", reason=reason)
        except (OSError, wave.Error):
            pass

    def _should_write_track(self, track_id: str) -> bool:
        return self._track_ids is None or track_id in self._track_ids

    def _files(self) -> tuple[LiveRealtimeDiagnosticsWavFile, ...]:
        files: list[LiveRealtimeDiagnosticsWavFile] = []
        for track_id, (source, writer) in self._writers.items():
            files.append(writer.to_file(track_id=track_id, source=source))
        return tuple(files)

    def _stopped_event(
        self,
        *,
        reason: LiveRealtimeDiagnosticsWavStopReason,
    ) -> LiveRealtimeDiagnosticsWavStopped:
        return LiveRealtimeDiagnosticsWavStopped(
            output_dir=str(self._output_dir),
            manifest_path=str(self._manifest_path),
            files=self._files(),
            total_file_byte_length=self.total_file_byte_length,
            reason=reason,
        )

    def _write_manifest(self, *, status: str, reason: str | None) -> None:
        track_ids: list[JsonValue] | None = (
            list(self._track_ids) if self._track_ids is not None else None
        )
        manifest: JsonDict = {
            "session_id": self._session_id,
            "status": status,
            "reason": reason,
            "started_at": self._started_at,
            "stopped_at": self._stopped_at,
            "max_duration_ms": self._max_duration_ms,
            "max_bytes": self._max_bytes,
            "track_ids": track_ids,
            "total_file_byte_length": self.total_file_byte_length,
            "files": [file.to_manifest() for file in self._files()],
        }
        with self._manifest_path.open("w", encoding="utf-8") as manifest_file:
            json.dump(manifest, manifest_file, ensure_ascii=False, indent=2)
            manifest_file.write("\n")


def default_diagnostics_output_dir() -> Path:
    """Return the default diagnostics output base outside the repository."""
    return Path(tempfile.gettempdir()) / "nola-live-diagnostics"


def ensure_diagnostics_output_dir(
    output_dir: Path,
    *,
    repository_root: Path | None,
) -> Path:
    """Return a writable diagnostics output directory outside the repository."""
    resolved_output_dir = output_dir.expanduser().resolve()
    resolved_repository_root = _resolve_repository_root(repository_root)
    try:
        resolved_output_dir.relative_to(resolved_repository_root)
    except ValueError:
        pass
    else:
        raise LiveRealtimeSessionError(
            code="diagnostics_wav_output_invalid",
            message="Diagnostics WAV output directory must be outside the repository",
        )

    if resolved_output_dir.exists() and not resolved_output_dir.is_dir():
        raise LiveRealtimeSessionError(
            code="diagnostics_wav_output_invalid",
            message="Diagnostics WAV output path must be a directory",
        )

    try:
        resolved_output_dir.mkdir(parents=True, exist_ok=True)
    except OSError as error:
        raise LiveRealtimeSessionError(
            code="diagnostics_wav_write_failed",
            message="Diagnostics WAV output directory could not be created",
        ) from error
    return resolved_output_dir


def _resolve_repository_root(repository_root: Path | None) -> Path:
    if repository_root is not None:
        return repository_root.expanduser().resolve()

    current = Path(__file__).resolve()
    for parent in current.parents:
        if (parent / ".git").exists():
            return parent
    return current.parents[5]


def _resolve_max_duration_ms(value: int | None) -> int:
    max_duration_ms = value or LIVE_REALTIME_DIAGNOSTICS_WAV_DEFAULT_MAX_DURATION_MS
    if max_duration_ms > LIVE_REALTIME_DIAGNOSTICS_WAV_MAX_DURATION_MS:
        raise LiveRealtimeSessionError(
            code="diagnostics_wav_limit_exceeded",
            message="Diagnostics WAV duration limit exceeds the server maximum",
        )
    return max_duration_ms


def _resolve_max_bytes(value: int | None) -> int:
    max_bytes = value or LIVE_REALTIME_DIAGNOSTICS_WAV_DEFAULT_MAX_BYTES
    if max_bytes > LIVE_REALTIME_DIAGNOSTICS_WAV_MAX_BYTES:
        raise LiveRealtimeSessionError(
            code="diagnostics_wav_limit_exceeded",
            message="Diagnostics WAV file size limit exceeds the server maximum",
        )
    return max_bytes


def _diagnostics_session_name(session_id: str) -> str:
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    return f"{_safe_filename(session_id)}-{timestamp}"


def _safe_filename(value: str) -> str:
    safe = "".join(
        char if char.isalnum() or char in {"-", "_", "."} else "_" for char in value
    ).strip("._")
    return safe or "diagnostics"


def _utc_timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()
