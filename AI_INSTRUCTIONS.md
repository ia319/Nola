# AI Instructions - Nola Project

> This file helps AI quickly understand the project structure.

## Project Overview

| Key | Value |
|-----|-------|
| Name | Nola - Speech-to-text Software |
| Stack | Python (FastAPI) + React (Tauri) |

---

## Code Style

> [!IMPORTANT]
> **Comments must be:**
> - In English
> - Brief and objective
> - Imperative mood (e.g., "Return the config" not "Returns the config")

---

## Directory Structure

```
Nola/
├── core/                      # Python backend (Flat Layout)
│   ├── pyproject.toml         # Poetry config + ruff/mypy settings
│   ├── README.md              # Backend docs
│   ├── nola/                  # Main package
│   │   ├── __init__.py        # Version info (v0.1.0)
│   │   ├── main.py            # FastAPI entry point
│   │   ├── config/            # Configuration
│   │   │   ├── settings.py    # Pydantic Settings (paths, limits, model)
│   │   │   └── constants.py   # Validation constants (MIME types, extensions)
│   │   ├── utils/             # Utility functions
│   │   │   └── mime.py        # MIME type inference
│   │   ├── api/               # API layer
│   │   │   ├── deps.py        # Dependency injection
│   │   │   ├── routes/        # API endpoints
│   │   │   │   ├── files.py   # File upload/management
│   │   │   │   └── transcriptions.py  # Task + export endpoints
│   │   │   └── schemas/       # Pydantic request/response models
│   │   │       ├── files.py
│   │   │       ├── transcriptions.py  # incl. BatchExportRequest
│   │   │       └── validators.py      # Reusable schema validators
│   │   ├── engines/           # Transcription engines
│   │   │   ├── base.py        # Segment, EngineConfig, TranscriptionEngine
│   │   │   └── faster_whisper.py  # FasterWhisperEngine implementation
│   │   ├── models/            # Data models & Database
│   │   │   ├── database.py    # Schema & init
│   │   │   ├── files.py       # FileDatabase class
│   │   │   ├── tasks.py       # TaskDatabase (job queue)
│   │   │   └── utils.py       # SQLite utilities
│   │   └── services/          # Business logic
│   │       ├── worker.py      # Background worker process
│   │       └── formatters/    # Subtitle formatters
│   │           ├── base.py    # BaseFormatter, SegmentData
│   │           ├── srt.py     # SRT formatter
│   │           ├── vtt.py     # VTT formatter
│   │           ├── txt.py     # TXT formatter
│   │           ├── ass.py     # ASS formatter
│   │           └── __init__.py  # get_formatter() registry
│   └── tests/                 # Test directory
│       ├── test_api.py        # API endpoint tests
│       ├── test_engines.py    # Engine tests
│       ├── test_models.py     # Database tests
│       ├── test_worker.py     # Worker tests
│       └── test_formatters.py # Formatter tests
├── app/                       # Frontend GUI (TODO)
├── .pre-commit-config.yaml    # Pre-commit hooks
├── .editorconfig              # Editor config
├── .gitignore
└── AI_INSTRUCTIONS.md         # This file
```

---

## Database Conventions

> [!IMPORTANT]
> **Database Operations Must Follow:**
> 1.  **Context Managers**: Use `with sqlite3.connect(...) as conn:` to prevent leaks.
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

### core/nola/models/
Data persistence layer (SQLite):
- `database.py`: Schema initialization, connection management, and foreign key enforcement.
- `files.py`: `FileDatabase` for managing audio file metadata.
- `tasks.py`: `TaskDatabase` implementing the production-grade job queue (priority, heartbeat, retries).
- `utils/db.py`: Database utilities (e.g., `ensure_sqlite_version`).

### core/nola/engines/
Transcription engine layer:
- `Segment`: Data class for transcribed segment with timing
- `EngineConfig`: Engine initialization configuration
- `TranscribeOptions`: Full transcription options (language, beam_size, vad_filter, etc.)
- `TranscriptionEngine`: Abstract interface for transcription engines
- `FasterWhisperEngine`: Faster-Whisper implementation

### core/nola/api/
REST API layer:
- `deps.py`: Dependency injection for database instances (singletons)
- `routes/files.py`: File upload/list/delete with validation (500MB limit, MIME checks)
- `routes/transcriptions.py`: Task creation, status query, cancellation, defaults
- `schemas/files.py`: Pydantic models for file operations
- `schemas/transcriptions.py`: TranscriptionRequest and BatchExportRequest models
- `schemas/validators.py`: Reusable validation functions (e.g., language, temperature)

### core/nola/services/
Background services:
- `worker.py`: Independent worker process that dequeues and executes transcription tasks
  - Loads engine once for performance
  - `build_transcribe_options()` filters invalid option keys
  - JSON options parsing with error handling
- `formatters/`: Subtitle export formatters (SRT, VTT, TXT, ASS)
  - `get_formatter(format, include_timestamps)` factory function
  - Static registry pattern for format discovery

### core/nola/main.py
FastAPI entry point with lifespan management:
- `GET /` - API info
- `GET /health` - Health check
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
- `GET /api/transcriptions/options/defaults` - Get default options
- `GET /api/transcriptions/{task_id}/export` - Export as subtitle (SRT/VTT/TXT/ASS)
- `POST /api/transcriptions/export/batch` - Batch export as ZIP

### core/nola/config/
Configuration and constants:
- `settings.py`: Pydantic Settings (data_dir, exports_dir, max_file_size, model defaults, host/port)
- `constants.py`: Validation constants (MIME/extension allowlists, language set, batch limits)

### core/nola/utils/
Utility functions:
- `mime.py`: MIME type inference from file extension

---

## Dev Commands

```bash
# Install dependencies
cd core && poetry install

# Start dev server
poetry run uvicorn nola.main:app --reload

# Run linter
poetry run ruff check .

# Run type checker
poetry run mypy nola

# Run tests
poetry run pytest

# Auto-fix lint issues
poetry run ruff check . --fix

# Format code
poetry run ruff format .

# Start worker (in a separate terminal)
poetry run python -m nola.services.worker
```

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

### Files API

| Endpoint | Method | Body/Query | Response |
|----------|--------|------------|----------|
| `/api/files/` | POST | `file: UploadFile` | `{file_id, filename, size, content_type}` |
| `/api/files/` | GET | `?limit=&offset=` | `{files: [], total, limit, offset}` |
| `/api/files/{file_id}` | GET | - | `{file_id, filename, path, size, content_type, created_at}` |
| `/api/files/{file_id}` | DELETE | - | `{message}` |
| `/api/files/check-integrity` | GET | - | `{status, missing_files, missing_count}` |
| `/api/files/cleanup` | POST | - | `{message, deleted_count, deleted_files}` |

### Transcriptions API

| Endpoint | Method | Body/Query | Response |
|----------|--------|------------|----------|
| `/api/transcriptions/` | POST | `{file_id, language?, task?, ...options}` | `{task_id, file_id, filename, status}` |
| `/api/transcriptions/` | GET | `?status=&limit=&offset=` | `{tasks: [], total, limit, offset}` |
| `/api/transcriptions/{task_id}` | GET | - | `{task_id, file_id, status, progress, duration, segments, error, ...}` |
| `/api/transcriptions/{task_id}` | DELETE | - | `{task_id, status, message}` |
| `/api/transcriptions/options/defaults` | GET | - | `{language, beam_size, vad_filter, ...all_options}` |
| `/api/transcriptions/{task_id}/export` | GET | `?format=srt&save=false` | SRT/VTT/TXT/ASS file or `{saved_path}` |
| `/api/transcriptions/export/batch` | POST | `{task_ids, format, zip_name?}` | ZIP file (application/zip) |

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
