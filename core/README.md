# Nola Core

Nola backend subproject

FastAPI, SQLite, Faster-Whisper, Hugging Face Hub, and Pydantic Settings stack; API service, background transcription worker, model registry and cache, realtime transcription WebSocket, subtitle export.

## Quick Start

Prerequisites: [Requirements](#requirements).

Run the API service and Worker in separate terminals.

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

## Deployment Settings

Deployment target: one Nola Core node, one API service, one Worker process, one persistent data directory.

### Runtime Roles

- API service: HTTP API, file upload/download, model management, realtime transcription WebSocket runtime
- Worker process: queued offline file transcription tasks
- Realtime transcription: API WebSocket runtime, not the Worker process

Run the API service and Worker as separate processes. Both processes must use the same data directory.

### API Bind Address

Set the local network bind address with Uvicorn:

```bash
poetry run uvicorn nola.main:app --host 127.0.0.1 --port 8000
```

Set a service host address for remote deployment:

```bash
poetry run uvicorn nola.main:app --host 0.0.0.0 --port 8000
```

### Persistent Data

`NOLA_DATA_DIR`: backend data root. Default: `data`.

Data root contents:

```text
data/
  nola.db
  uploads/
  exports/
  models/
```

Persistent storage requirement: `NOLA_DATA_DIR` in local service, desktop node, and server deployment modes. Different API/Worker data roots: missing uploads, queued tasks, and transcription results.

### Model Cache Directory

Effective model cache directory priority:

1. `NOLA_MODEL_DIR`: deployment-level model cache lock
2. Stored `configured_model_dir`: model settings API and UI value
3. `NOLA_DATA_DIR/models`: default model cache root

`NOLA_MODEL_DIR` present: stored `configured_model_dir` remains saved but not effective. Persistent model cache requirement: offline Worker tasks and realtime API sessions.

### Configuration Layers

- `NOLA_DATA_DIR`: deployment-level data root for SQLite database, uploads, exports, and default model cache
- `NOLA_MODEL_DIR`: deployment-level model cache lock with priority over stored `configured_model_dir`
- `NOLA_CORS_ORIGINS`: browser origin allow-list
- `NOLA_MODEL_SIZE`: fallback model id when no stored `configured_model_id`
- `NOLA_DEVICE`: fallback execution device when no stored execution default
- `NOLA_COMPUTE_TYPE`: fallback execution compute type when no stored execution default
- Stored transcription defaults: application-level defaults over engine built-ins
- Stored Live realtime defaults: application-level defaults over Live built-ins
- Task and Live request overrides: per-session values over stored defaults

### Browser CORS

`NOLA_CORS_ORIGINS`: browser origin allow-list for cross-origin Web clients.

```bash
NOLA_CORS_ORIGINS=https://app.example.com,http://localhost:5173 \
poetry run uvicorn nola.main:app --host 0.0.0.0 --port 8000
```

Default CORS origins:

```text
http://localhost:5173,http://127.0.0.1:5173
```

### Remote Access Boundary

Remote Nola Node boundary: FastAPI API and realtime WebSocket endpoints over HTTPS/WSS. TLS termination: reverse proxy or hosting layer.

Built-in OAuth2/OIDC/API-token authentication: not included. Public/multi-user deployments: external authentication layer, network access control, or trusted private environment required.

Deployment model: single-node. Multi-machine API/Worker split requires shared database, uploaded-file storage, export storage, and model cache.

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
- Browser CORS default origins: `http://localhost:5173,http://127.0.0.1:5173`
- Remote access transport: HTTPS/WSS at the deployment boundary
- Built-in OAuth2/OIDC/API-token authentication: not included
- Maximum file size: 500 MB
- Upload formats: mp3, wav, flac, m4a, ogg, webm, aac, mp4, wma
- Export formats: srt, vtt, txt, ass
- Single batch task request limit: 500 task IDs
- Single batch file request limit: 500 file IDs
- Maximum task retries: 3
- Task processing timeout: 30 min
- Worker heartbeat timeout: 5 min
