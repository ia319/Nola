"""Application configuration using Pydantic Settings."""

from pathlib import Path
from typing import Literal, TypeAlias

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

LiveRealtimeTranscriberSetting: TypeAlias = Literal["mock", "whisper_streaming"]

DEFAULT_CORS_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173"


def _parse_cors_origins(value: str) -> list[str]:
    """Return normalized CORS origins from a comma-delimited setting value."""
    return [origin.strip() for origin in value.split(",") if origin.strip()]


class Settings(BaseSettings):
    """Store application settings loaded from environment variables."""

    model_config = SettingsConfigDict(env_prefix="NOLA_")

    # Model settings
    model_size: str = "small"
    model_dir: Path | None = None
    device: str = "auto"  # "auto", "cpu", "cuda"
    compute_type: str = "default"  # "default", "float16", "int8"

    # Live realtime settings
    # Keep mock internal; do not expose it as a product option for now.
    live_realtime_transcriber: LiveRealtimeTranscriberSetting = "whisper_streaming"
    # Server settings
    host: str = "127.0.0.1"
    port: int = 8000
    cors_origins: str = DEFAULT_CORS_ORIGINS

    # Data paths
    data_dir: Path = Path("data")
    max_file_size: int = 500 * 1024 * 1024  # 500 MB

    @property
    def cors_origin_list(self) -> list[str]:
        """Allowed browser origins for cross-origin frontend runtimes."""
        return _parse_cors_origins(self.cors_origins)

    @property
    def upload_dir(self) -> Path:
        """Directory for uploaded files."""
        return self.data_dir / "uploads"

    @property
    def db_path(self) -> Path:
        """Path to SQLite database."""
        return self.data_dir / "nola.db"

    @property
    def exports_dir(self) -> Path:
        """Directory for exported subtitle files."""
        return self.data_dir / "exports"

    @property
    def default_model_dir(self) -> Path:
        """Directory for managed model cache files."""
        return self.data_dir / "models"

    @field_validator("live_realtime_transcriber", mode="before")
    @classmethod
    def normalize_live_realtime_transcriber(cls, value: object) -> object:
        """Normalize the Live realtime transcriber before Literal validation."""
        if isinstance(value, str):
            return value.strip().casefold()
        return value

    @field_validator("cors_origins")
    @classmethod
    def validate_cors_origins(cls, value: str) -> str:
        """Validate comma-delimited CORS origins."""
        invalid_origins = [
            origin for origin in _parse_cors_origins(value) if "://" not in origin
        ]
        if invalid_origins:
            invalid_display = ", ".join(invalid_origins)
            msg = (
                "CORS origins must include a scheme such as http:// or "
                f"tauri://: {invalid_display}"
            )
            raise ValueError(msg)
        return value


settings = Settings()
