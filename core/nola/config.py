"""Provide application configuration management."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Store application settings loaded from environment variables."""

    # Model settings
    model_size: str = "base"
    device: str = "auto"  # "auto", "cpu", "cuda"
    compute_type: str = "default"  # "default", "float16", "int8"

    # Server settings
    host: str = "127.0.0.1"
    port: int = 8000

    class Config:
        env_prefix = "NOLA_"


settings = Settings()
