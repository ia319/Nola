"""Define FastAPI application entry point."""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from nola import __version__
from nola.api.routes import (
    config_router,
    files_router,
    live_router,
    models_router,
    transcriptions_router,
)
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

if settings.cors_origin_list:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_methods=["*"],
        allow_headers=["*"],
        allow_credentials=False,
    )

app.include_router(config_router)
app.include_router(models_router)
app.include_router(transcriptions_router)
app.include_router(files_router)
app.include_router(live_router)


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
