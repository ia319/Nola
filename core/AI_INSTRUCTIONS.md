# AI Instructions - Nola Core

> This file helps AI quickly understand the project structure.

## Project Overview

| Key | Value |
|-----|-------|
| Name | Nola Core - Speech-to-text Backend |
| Stack | Python (FastAPI) + SQLite + Faster-Whisper worker |

---

## Code Style

> [!IMPORTANT]
> **Comments must be:**
> - In English
> - Brief and objective
> - Imperative mood (e.g., "Return the config" not "Returns the config")

---

## Directory Structure

```text
core/
├── AI_INSTRUCTIONS.md         # This file
├── pyproject.toml             # Poetry config + ruff/mypy settings
├── README.md                  # Backend docs
├── nola/                      # Main package
│   ├── __init__.py            # Version info (v0.1.0)
│   ├── main.py                # FastAPI entry point
│   ├── config/                # Settings, constants, and transcription config contract
│   │   ├── settings.py        # Pydantic Settings (paths, limits, model)
│   │   ├── constants.py       # Validation constants (MIME types, extensions)
│   │   └── transcription/     # Config metadata, defaults, and language helpers
│   │       ├── __init__.py    # Transcription config package exports
│   │       ├── metadata.py    # Option schema models and grouped field metadata
│   │       ├── defaults.py    # Engine/effective defaults and sentinel conversion
│   │       └── languages.py   # Language capability mapping for effective options
│   ├── common/                # Shared backend helpers
│   │   ├── __init__.py        # Common helper package exports
│   │   └── merge.py           # Recursive deep-merge helper
│   ├── utils/                 # Utility functions
│   │   └── mime.py            # MIME type inference
│   ├── api/                   # API layer
│   │   ├── deps.py            # Dependency injection
│   │   ├── routes/            # API endpoints
│   │   │   ├── config.py      # Config aggregation and defaults endpoints
│   │   │   ├── files.py       # File upload/management
│   │   │   └── transcriptions.py  # Task + export endpoints
│   │   └── schemas/           # Pydantic request/response models
│   │       ├── files.py       # FileResponse, FileListResponse, etc.
│   │       ├── responses.py   # TaskDetailResponse, CreateTaskResponse, etc.
│   │       ├── transcriptions.py  # TranscriptionRequest, BatchExportRequest, defaults update
│   │       └── validators.py  # Reusable schema validators
│   ├── engines/               # Transcription engines
│   │   ├── base.py            # Segment, EngineConfig, TranscriptionEngine
│   │   └── faster_whisper.py  # FasterWhisperEngine implementation
│   ├── models/                # Data models & Database
│   │   ├── app_config.py      # AppConfigDatabase for persisted defaults
│   │   ├── database.py        # Schema & init
│   │   ├── files.py           # FileDatabase class
│   │   ├── tasks.py           # TaskDatabase (job queue)
│   │   └── utils.py           # SQLite utilities
│   └── services/              # Business logic
│       ├── worker.py          # Background worker process
│       └── formatters/        # Subtitle formatters
│           ├── base.py        # BaseFormatter, SegmentData
│           ├── srt.py         # SRT formatter
│           ├── vtt.py         # VTT formatter
│           ├── txt.py         # TXT formatter
│           ├── ass.py         # ASS formatter
│           └── __init__.py    # get_formatter() registry
└── tests/                     # Test directory
    ├── __init__.py            # Test package marker
    ├── conftest.py            # Shared pytest fixtures
    ├── test_api.py            # API endpoint tests
    ├── test_config_api.py     # Config endpoint contract tests
    ├── test_config_db.py      # App config persistence tests
    ├── test_engines.py        # Engine tests
    ├── test_models.py         # Database tests
    ├── test_transcription_config.py # Transcription metadata/defaults tests
    ├── test_transcription_schemas.py # Request schema validation tests
    ├── test_worker.py         # Worker tests
    └── test_formatters.py     # Formatter tests
```

---

## Database Conventions

> [!IMPORTANT]
> **Database Operations Must Follow:**
> 1.  **Connection Lifetime**: Do not rely on `with sqlite3.connect(...) as conn:` to close connections. Explicitly close SQLite connections, and preserve transaction semantics for write operations.
> 2.  **Atomic Updates**: Use `UPDATE ... WHERE ... RETURNING` for queue operations to avoid race conditions.
> 3.  **Poison Pill Protection**: Increment `retry_count` even when requeuing timeout/dead tasks.
> 4.  **Environment Check**: Verify `sqlite3` version >= 3.35.0 on startup.

---

## Dependencies

| Package | Version |
|---------|---------|
| fastapi | 0.128.0 |
| uvicorn | 0.40.0 |
| faster-whisper | 1.2.1 |
| pydantic-settings | 2.12.0 |
| Python | ^3.10 |

### Dev Dependencies

| Package | Version |
|---------|---------|
| ruff | 0.14.11 |
| mypy | 1.19.1 |
| pre-commit | 4.5.1 |
| pytest | 9.0.2 |

---

## Detailed Module Overview

### nola/models/
Data persistence layer (SQLite):
- `database.py`: Schema initialization, connection management, and foreign key enforcement.
- `app_config.py`: `AppConfigDatabase` for persisted application defaults under `app_config`.
- `files.py`: `FileDatabase` for managing audio file metadata. Uses `FileRow` TypedDict.
- `tasks.py`: `TaskDatabase` implementing the production-grade job queue. Uses `TaskRowRaw`/`TaskRow` TypedDicts.
- `utils.py`: Database utilities (e.g., `ensure_sqlite_version`).

### nola/common/
Shared backend helper layer:
- `merge.py`: Provide recursive deep-merge behavior for defaults composition.

### nola/engines/
Transcription engine layer:
- `Segment`: Data class for transcribed segment with timing
- `EngineConfig`: Engine initialization configuration
- `TranscribeOptions`: Full transcription options (language, beam_size, vad_filter, etc.)
- `TranscriptionEngine`: Abstract interface for transcription engines
- `FasterWhisperEngine`: Faster-Whisper implementation

### nola/api/
REST API layer:
- `deps.py`: Dependency injection for database instances (singletons)
- `routes/config.py`: Aggregated config endpoints and transcription-defaults management.
- `routes/files.py`: File upload/list/delete with validation. All endpoints use `response_model`.
- `routes/transcriptions.py`: Task CRUD + export endpoints. CRUD endpoints use `response_model`.
- `schemas/files.py`: 8 Pydantic response models (`FileResponse`, `FileListResponse`, etc.)
- `schemas/responses.py`: 7 Pydantic response models (`TaskDetailResponse`, `CreateTaskResponse`, etc.)
- `schemas/transcriptions.py`: Request models (`TranscriptionRequest`, `BatchExportRequest`, `TranscriptionDefaultsUpdateRequest`) with typed `VadParametersRequest` and `extra=forbid`
- `schemas/validators.py`: Reusable validation functions for language, task options, temperature, and nested `vad_parameters` keys

### nola/services/
Background services:
- `worker.py`: Independent worker process that dequeues and executes transcription tasks
  - Loads engine once for performance
  - `build_transcribe_options()` merges engine defaults, app defaults, and task overrides
  - JSON options parsing with error handling
- `formatters/`: Subtitle export formatters (SRT, VTT, TXT, ASS)
  - `get_formatter(format, include_timestamps)` factory function
  - Static registry pattern for format discovery

### nola/main.py
FastAPI entry point with lifespan management:
- `GET /` - API info
- `GET /health` - Health check
- `GET /api/config` - Aggregated frontend-facing configuration
- `GET /api/config/transcription/engine-defaults` - Raw engine defaults
- `PATCH /api/config/transcription/defaults` - Persist transcription default overrides
- `DELETE /api/config/transcription/defaults` - Reset persisted transcription defaults
- `POST /api/files/` - Upload audio file
- `GET /api/files/` - List all files
- `GET /api/files/{file_id}` - Get file metadata
- `DELETE /api/files/{file_id}` - Delete file
- `GET /api/files/check-integrity` - Check database-file consistency
- `POST /api/files/cleanup` - Remove orphan database records
- `POST /api/transcriptions/` - Create transcription task
- `GET /api/transcriptions/` - List tasks (with filtering)
- `GET /api/transcriptions/{task_id}` - Get task status/result
- `DELETE /api/transcriptions/{task_id}` - Cancel task
- `GET /api/transcriptions/{task_id}/export` - Export as subtitle (SRT/VTT/TXT/ASS)
- `POST /api/transcriptions/export/batch` - Batch export as ZIP

### nola/config/
Configuration and constants:
- `settings.py`: Pydantic Settings (data_dir, exports_dir, max_file_size, model defaults, host/port)
- `constants.py`: Validation constants (MIME/extension allowlists, language set, batch limits)
- `transcription/`: Backend source of truth for config metadata, defaults, and language options

### Transcription Rules
Apply config-driven schema as the only source for frontend option metadata and task option values.
Apply defaults precedence as `engine defaults < persisted app defaults < task overrides`.
Treat explicit `null` in `PATCH /api/config/transcription/defaults` as remove-override semantics.
Merge nested defaults objects in PATCH flows without replacing untouched subkeys.
Reject unknown top-level options and unknown `vad_parameters` keys at request validation with `422`.
Apply the same schema-level range validation in `POST /api/transcriptions` and `PATCH /api/config/transcription/defaults`, and return `422` for out-of-range values.
Serialize infinity as `"inf"` at API boundaries and deserialize it back before engine invocation.

### nola/utils/
Utility functions:
- `mime.py`: MIME type inference from file extension

---

## Dev Commands

```bash
# Install dependencies
poetry install

# Start dev server
poetry run uvicorn nola.main:app --reload

# Run linter
poetry run ruff check nola tests

# Check format (same as CI)
poetry run ruff format --check nola tests

# Run type checker
poetry run mypy nola

# Run tests
poetry run pytest tests -v --tb=short

# Auto-fix lint issues
poetry run ruff check nola tests --fix

# Format code
poetry run ruff format nola tests

# Start worker (in a separate terminal)
poetry run python -m nola.services.worker
```

> From repository root, use `poetry -C core run ...` equivalents.

---

## CI Contract

- Workflow entry: `.github/workflows/ci.yml`
- Core quality commands:
  - `poetry -C core run ruff check nola tests`
  - `poetry -C core run ruff format --check nola tests`
  - `poetry -C core run mypy nola`
- Core test command:
  - `poetry -C core run pytest tests -v --tb=short`
- Schema-drift backend startup command:
  - `poetry -C core run uvicorn nola.main:app --host 127.0.0.1 --port 8000`

---

## Architecture

```
Client ──▶ FastAPI Server ──▶ SQLite DB ◀── Worker Process
                                  │              │
                                  │       FasterWhisperEngine
                                  ▼
                            data/nola.db
                            data/uploads/
```

---

## API Reference

### Config API

| Endpoint | Method | Body/Query | Response Model |
|----------|--------|------------|----------------|
| `/api/config` | GET | - | `AppConfigResponse` |
| `/api/config/transcription/engine-defaults` | GET | - | `EngineDefaultsResponse` |
| `/api/config/transcription/defaults` | PATCH | `TranscriptionDefaultsUpdateRequest` | `TranscriptionDefaultsPatchResponse` |
| `/api/config/transcription/defaults` | DELETE | - | `204 No Content` |

### Files API

| Endpoint | Method | Body/Query | Response Model |
|----------|--------|------------|----------------|
| `/api/files/` | POST | `file: UploadFile` | `FileUploadResponse` |
| `/api/files/` | GET | `?limit=&offset=` | `FileListResponse` |
| `/api/files/{file_id}` | GET | - | `FileResponse` |
| `/api/files/{file_id}` | DELETE | - | `DeleteResponse` |
| `/api/files/check-integrity` | GET | - | `IntegrityCheckResponse` |
| `/api/files/cleanup` | POST | - | `CleanupResponse` |

### Transcriptions API

| Endpoint | Method | Body/Query | Response Model |
|----------|--------|------------|----------------|
| `/api/transcriptions/` | POST | `TranscriptionRequest` | `CreateTaskResponse` |
| `/api/transcriptions/` | GET | `?status=&limit=&offset=` | `TaskListResponse` |
| `/api/transcriptions/{task_id}` | GET | - | `TaskDetailResponse` |
| `/api/transcriptions/{task_id}` | DELETE | - | `CancelTaskResponse` |
| `/api/transcriptions/{task_id}/export` | GET | `?format=srt&save=false` | Binary or `{saved_path}` |
| `/api/transcriptions/export/batch` | POST | `BatchExportRequest` | ZIP binary |

---

## Task Lifecycle

```
pending ──▶ processing ──▶ completed
                │
                ├──▶ failed (auto-retry up to 3x)
                │
                └──▶ cancelled (cooperative, per-segment check)
```

- **Timeout**: Tasks processing > 30 min are requeued
- **Dead Worker**: Tasks from dead workers are requeued
- **Cancellation**: Checked every segment (~2-5s granularity)

---

## Limits

| Item | Limit |
|------|-------|
| File size | 500 MB |
| Formats | mp3, wav, flac, m4a, ogg, webm, aac, mp4 |
| Max retries | 3 |
| Task timeout | 30 min |
| Heartbeat timeout | 5 min |
