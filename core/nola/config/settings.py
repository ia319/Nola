"""Application configuration using Pydantic Settings."""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Store application settings loaded from environment variables."""

    model_config = SettingsConfigDict(env_prefix="NOLA_")

    # Model settings
    model_size: str = "small"
    model_dir: Path | None = None
    device: str = "auto"  # "auto", "cpu", "cuda"
    compute_type: str = "default"  # "default", "float16", "int8"

    # Live realtime settings
    live_realtime_transcriber: str = "mock"
    # Server settings
    host: str = "127.0.0.1"
    port: int = 8000

    # Data paths
    data_dir: Path = Path("data")
    max_file_size: int = 500 * 1024 * 1024  # 500 MB

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


settings = Settings()
