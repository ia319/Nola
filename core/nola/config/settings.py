"""Application configuration using Pydantic Settings."""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Store application settings loaded from environment variables."""

    model_config = SettingsConfigDict(env_prefix="NOLA_")

    # Model settings
    model_size: str = "small"
    device: str = "cpu"  # "auto", "cpu", "cuda"
    compute_type: str = "default"  # "default", "float16", "int8"

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


settings = Settings()
