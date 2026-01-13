"""Define FastAPI application entry point."""

from fastapi import FastAPI

from nola import __version__

app = FastAPI(
    title="Nola Core",
    description="Speech-to-text API powered by Faster Whisper",
    version=__version__,
)


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
