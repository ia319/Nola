# Core Docker Deployment

## Requirements

- Docker Engine
- Docker Compose v2

## Quick Start

```bash
make core-docker-up
```

```text
API address: http://127.0.0.1:8000
API health check: http://127.0.0.1:8000/health
API documentation: http://127.0.0.1:8000/docs
```

Stop the services:

```bash
make core-docker-down
```

Build the image separately:

```bash
make core-docker-build
```

## Compose Services

`compose.yaml` starts two backend services:

- `core-api`: FastAPI, file uploads, model management, the live transcription WebSocket, and export endpoints.
- `core-worker`: Worker for offline file transcription tasks.

Both services use the same locally built image and share the same set of Docker named volumes.

Default port binding:

```yaml
127.0.0.1:8000:8000
```

The default binding accepts local connections only. Expose remote access through a reverse proxy with HTTPS/WSS endpoints.

## Data Volumes

Compose defines two Docker named volumes:

```text
nola-core-data    -> /data
nola-core-models  -> /models
```

Contents of `/data`:

```text
nola.db
uploads/
exports/
```

Contents of `/models`:

```text
Hugging Face model cache
```

The API and Worker must mount the same `/data` volume to share the SQLite database, uploaded files, and exported files, and mount the same `/models` volume to share the model cache.

## Environment Variables

Compose defaults:

```yaml
NOLA_HOST: 0.0.0.0
NOLA_PORT: "8000"
NOLA_DATA_DIR: /data
NOLA_MODEL_DIR: /models
NOLA_CORS_ORIGINS: http://localhost:5173,http://127.0.0.1:5173
```

Common overrides:

- `NOLA_CORS_ORIGINS`: List of Web frontend origins allowed to access the API.
- `NOLA_MODEL_SIZE`: Default model.
- `NOLA_DEVICE`: `cpu`, `cuda`, or `auto`.
- `NOLA_COMPUTE_TYPE`: `default`, `float16`, or `int8`.
- `NOLA_LIVE_REALTIME_TRANSCRIBER`: Live transcription runtime.
- `NOLA_MAX_FILE_SIZE`: Upload file size limit in bytes.

Compose provides only the host, port, data directory, model directory, and CORS defaults shown above. Model selection, device, and compute type use task request overrides first; without a request override, they use saved application defaults, container environment variables, and source defaults in that order. Transcription parameters do not use container environment variables and resolve in this order: task request overrides, saved application defaults, and Core/Faster-Whisper defaults.

See [Windows Desktop Release](../release/windows-desktop.en.md) for the sidecar environment-variable rules in the desktop-integrated version.

## Health Check

The image includes a `/health` healthcheck:

```text
GET /health
```

The `version` in the response comes from the Core package's `__version__`:

```json
{"status":"ok","version":"<core-version>"}
```

Compose starts `core-worker` after `core-api` becomes healthy and disables the Worker's healthcheck.

## Image Scope

The Dockerfile builds a CPU runtime environment:

- The base image is `python:3.11.14-slim-bookworm`.
- The Python environment installs the Poetry `main` dependency group.
- The system environment includes FFmpeg and `libgomp1`.
- The API and Worker run as the non-root user `nola`.
- Core's configuration hierarchy resolves the device, compute type, and transcription parameters.

GPU execution requires a custom image with the CUDA 12 runtime, cuBLAS, cuDNN, and the Poetry `gpu` dependency group.

## Security Boundary

- Port `8000` is suitable for local machines or trusted internal networks.
- A public endpoint must provide TLS through a reverse proxy and use an external authentication layer that implements OAuth2, OIDC, or API token authentication.
- When a static Web site accesses a remote Core instance, use HTTPS/WSS and configure an explicit `NOLA_CORS_ORIGINS` value.

## GHCR Publishing

Core Docker images are distributed through GHCR:

```bash
docker pull ghcr.io/ia319/nola-core:<version>
```

GHCR version tags use the format `<major>.<minor>.<patch>[-prerelease]`.

Image platforms:

```text
linux/amd64
linux/arm64
```

A stable release publishes three tags:

```text
ghcr.io/ia319/nola-core:<version>
ghcr.io/ia319/nola-core:<major>.<minor>
ghcr.io/ia319/nola-core:latest
```

A prerelease publishes only the full version tag.
