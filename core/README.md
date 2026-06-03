# Nola Core

Nola backend subproject

FastAPI, SQLite, Faster-Whisper, Hugging Face Hub, and Pydantic Settings stack; API service, background transcription worker, model registry and cache, realtime transcription WebSocket, subtitle export.

## Quick Startup

Prerequisites: `Requirements` section.

```bash
# Backend dependency installation
poetry install
```

```bash
# FastAPI backend service
poetry run uvicorn nola.main:app --reload --host 127.0.0.1 --port 8000
```

```text
API address: http://127.0.0.1:8000
API docs: http://127.0.0.1:8000/docs
```

```bash
# Background transcription worker
poetry run python -m nola.services.worker
```

## Requirements

- Python 3.10+
- Poetry 2.x
- SQLite 3.35+
- CPU inference: no CUDA
- NVIDIA GPU inference: CUDA 12.x, cuBLAS for CUDA 12, cuDNN 9 for CUDA 12

## Development Commands

```bash
# Ruff lint check
poetry run ruff check nola tests

# Ruff format check
poetry run ruff format --check nola tests

# Mypy type check
poetry run mypy nola

# Pytest tests
poetry run pytest tests -v --tb=short

# Ruff lint fixes
poetry run ruff check nola tests --fix

# Ruff formatting
poetry run ruff format nola tests
```

## Current Limits

- Default backend address: `127.0.0.1:8000`
- Maximum file size: 500 MB
- Upload formats: mp3, wav, flac, m4a, ogg, webm, aac, mp4, wma
- Export formats: srt, vtt, txt, ass
- Single batch task request limit: 500 task IDs
- Single batch file request limit: 500 file IDs
- Maximum task retries: 3
- Task processing timeout: 30 min
- Worker heartbeat timeout: 5 min
