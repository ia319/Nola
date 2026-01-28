"""Define FastAPI application entry point."""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from nola import __version__
from nola.api.files import router as files_router
from nola.api.transcriptions import router as transcriptions_router
from nola.config import settings
from nola.models import init_db


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Initialize on startup."""
    init_db()
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(
    title="Nola Core",
    description="Speech-to-text API powered by Faster Whisper",
    version=__version__,
    lifespan=lifespan,
)

# Register routers
app.include_router(transcriptions_router)
app.include_router(files_router)


@app.get("/health")
def health_check() -> dict[str, str]:
    """Return health status."""
    return {"status": "ok", "version": __version__}


@app.get("/")
def root() -> dict[str, str]:
    """Return API information."""
    return {
        "name": "Nola Core",
        "version": __version__,
        "docs": "/docs",
    }
