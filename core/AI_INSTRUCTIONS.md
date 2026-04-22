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
├── poetry.lock                # Poetry lockfile
├── pyproject.toml             # Poetry config + ruff/mypy settings
├── README.md                  # Backend docs
├── nola/                      # Main package
│   ├── __init__.py            # Version info (v0.1.0)
│   ├── main.py                # FastAPI entry point
│   ├── application/           # Application-layer use-cases
│   │   ├── __init__.py        # Application package exports
│   │   └── tasks/             # Task use-cases and shared payload contracts
│   │       ├── __init__.py    # Task use-case exports
│   │       ├── contracts.py   # Task/file gateway protocols
│   │       ├── errors.py      # Application-layer error model
│   │       ├── payloads.py    # Shared task response payload builders
│   │       ├── types.py       # TypedDict payload contracts
│   │       ├── actions/       # Write-side use-cases (create/cancel/batch/delete)
│   │       │   ├── __init__.py # Action use-case exports
│   │       │   ├── _batch_action.py # Shared batch action executor
│   │       │   ├── batch_cancel_tasks.py # Batch cancel use-case
│   │       │   ├── batch_retry_tasks.py # Batch retry use-case
│   │       │   ├── cancel_task.py # Single task cancel use-case
│   │       │   ├── create_task.py # Task creation use-case
│   │       │   └── delete_task_record.py # Terminal task-record deletion use-case
│   │       ├── queries/       # Read-side use-cases (list/detail)
│   │       │   ├── __init__.py # Query use-case exports
│   │       │   ├── get_task.py # Task detail query use-case
│   │       │   └── list_tasks.py # Task list query use-case
│   │       └── exports/       # Export use-cases (single/batch)
│   │           ├── __init__.py # Export use-case exports
│   │           ├── batch_export_tasks.py # Batch export archive use-case
│   │           ├── export_common.py # Shared export payload and error helpers
│   │           └── export_task.py # Single task export use-case
│   ├── config/                # Settings, constants, and config modules
│   │   ├── __init__.py        # Config exports
│   │   ├── settings.py        # Pydantic Settings (paths, limits, model)
│   │   ├── constants.py       # Validation constants (MIME types, extensions, batch limits)
│   │   ├── common/            # Shared config patch/type helpers
│   │   │   ├── __init__.py    # Common config exports
│   │   │   ├── patch.py       # Recursive PATCH semantics helper
│   │   │   └── types.py       # ConfigMap/ConfigValue type aliases
│   │   ├── export/            # Export defaults and filename helpers
│   │   │   ├── __init__.py    # Export config package exports
│   │   │   ├── defaults.py    # Export defaults resolution helpers
│   │   │   ├── filenames.py   # Export filename sanitize/unique-write helpers
│   │   │   ├── metadata.py    # Export config response models
│   │   │   └── types.py       # Shared export format enum/contracts
│   │   └── transcription/     # Transcription contracts/defaults/languages/schema
│   │       ├── __init__.py    # Transcription config package exports
│   │       ├── contracts.py   # Shared transcription option contracts
│   │       ├── defaults.py    # Engine/effective defaults and sentinel conversion
│   │       ├── languages.py   # Language capability mapping for effective options
│   │       └── schema/        # Schema models/registry/response assembly
│   │           ├── __init__.py
│   │           ├── models.py
│   │           ├── registry.py
│   │           └── responses.py
│   ├── common/                # Shared backend helpers
│   │   ├── __init__.py        # Common helper package exports
│   │   ├── merge.py           # Recursive deep-merge helper
│   │   ├── event_bus.py       # Process-wide in-memory event bus
│   │   └── types.py           # Shared recursive JSON type aliases
│   ├── utils/                 # Utility functions
│   │   ├── __init__.py        # Utility package exports
│   │   └── mime.py            # MIME type inference
│   ├── api/                   # API layer
│   │   ├── __init__.py        # API package exports
│   │   ├── deps.py            # Dependency injection
│   │   ├── routes/            # API endpoints
│   │   │   ├── __init__.py    # Route package exports
│   │   │   ├── _model_helpers.py # Shared model-route helper functions
│   │   │   ├── config.py      # Config aggregation and defaults endpoints
│   │   │   ├── files.py       # File upload/management
│   │   │   ├── models.py      # Model management and download runtime endpoints
│   │   │   ├── transcriptions.py  # Canonical task route composition entry
│   │   │   └── tasks/         # Task route modules grouped by responsibility
│   │   │       ├── __init__.py  # Task route package exports
│   │   │       ├── read.py    # Task list/detail endpoints
│   │   │       ├── actions.py # Task mutation endpoints
│   │   │       ├── export.py  # Task export endpoints
│   │   │       └── _errors.py # Task use-case error mapping helper
│   │   └── schemas/           # Pydantic request/response models
│   │       ├── __init__.py    # Schema package exports
│   │       ├── config.py      # Export defaults update request schema
│   │       ├── files.py       # FileResponse, FileListResponse, etc.
│   │       ├── models.py      # Model request/response schema set
│   │       ├── responses.py   # TaskDetailResponse, CreateTaskResponse, etc.
│   │       ├── transcriptions.py  # TranscriptionRequest, BatchExportRequest, defaults update
│   │       └── validators.py  # Reusable schema validators
│   ├── engines/               # Transcription engines
│   │   ├── __init__.py        # Engine package exports
│   │   ├── base.py            # Segment, EngineConfig, TranscriptionEngine
│   │   └── faster_whisper.py  # FasterWhisperEngine implementation
│   ├── models/                # Data models & Database
│   │   ├── __init__.py        # Model package exports
│   │   ├── app_config.py      # AppConfigDatabase for persisted defaults
│   │   ├── database.py        # Schema & init
│   │   ├── files.py           # FileDatabase class
│   │   ├── tasks.py           # TaskDatabase facade over taskdb repositories
│   │   ├── taskdb/            # Split repositories and task row contracts
│   │   │   ├── __init__.py    # taskdb package exports
│   │   │   ├── base.py        # Shared repository base + connection helper
│   │   │   ├── query_helpers.py # Search query helper functions
│   │   │   ├── task_queue.py  # Queue state transitions and worker coordination
│   │   │   ├── task_store.py  # Query/list/count/cancel/delete data access
│   │   │   └── types.py       # Task TypedDict/types/constants
│   │   └── utils/             # SQLite utility module
│   │       ├── __init__.py    # Utility exports
│   │       └── db.py          # sqlite version and connection checks
│   ├── model_hub/             # Managed model registry, storage, and downloads
│   │   ├── __init__.py        # Model-hub exports
│   │   ├── contracts.py       # Shared model metadata and download contracts
│   │   ├── downloader.py      # Subprocess-backed model downloads
│   │   ├── errors.py          # Model-hub domain errors
│   │   ├── registry.py        # Curated model registry and alias lookup
│   │   ├── storage.py         # Cache inspection and deletion helpers
│   │   ├── _download_constants.py # Shared download allow-pattern constants
│   │   ├── _download_messages.py # Download IPC message contracts
│   │   ├── _download_worker.py # Subprocess download worker entry
│   │   └── _hf_api.py         # Thin Hugging Face hub wrappers
│   └── services/              # Business logic
│       ├── __init__.py        # Service package exports
│       ├── worker.py          # Background worker process
│       └── formatters/        # Subtitle formatters
│           ├── __init__.py    # formatter registry exports
│           ├── base.py        # BaseFormatter, SegmentData
│           ├── srt.py         # SRT formatter
│           ├── vtt.py         # VTT formatter
│           ├── txt.py         # TXT formatter
│           └── ass.py         # ASS formatter
└── tests/                     # Test directory
    ├── __init__.py            # Test package marker
    ├── conftest.py            # Shared pytest fixtures
    ├── test_api.py            # API endpoint tests
    ├── test_config_api.py     # Config endpoint contract tests
    ├── test_config_db.py      # App config persistence tests
    ├── test_engines.py        # Engine tests
    ├── test_event_bus.py      # Event-bus publish/subscribe tests
    ├── test_export_filenames.py # Export filename helper tests
    ├── test_models.py         # Database tests
    ├── test_model_downloader.py # Model downloader tests
    ├── test_model_registry.py # Model registry tests
    ├── test_model_storage.py  # Model storage tests
    ├── test_task_repositories.py # taskdb repository tests
    ├── test_transcription_config.py # Transcription schema/defaults tests
    ├── test_transcription_contracts.py # Transcription contract consistency tests
    ├── test_transcription_schemas.py # Request schema validation tests
    ├── test_task_use_cases.py # Application-layer task use-case tests
    ├── test_worker.py         # Worker tests
    └── test_formatters.py     # Formatter tests
```

Keep generated or local-runtime directories such as `data/`, `__pycache__/`, `.pytest_cache/`, `.mypy_cache/`, and `.ruff_cache/` out of this tree.

### Recent Additions

- `nola/common/event_bus.py`: Process-wide in-memory event bus for model-download SSE.
- `nola/model_hub/`: Model registry, storage, downloader, and domain errors.
- `nola/api/routes/models.py` + `nola/api/schemas/models.py`: Model management and runtime download APIs.
- `nola/config/transcription/schema/`: Config-driven option schema for frontend controls and validation boundaries.
- `nola/config/export/`: Export defaults, export format contracts, and filename helpers.
- `nola/application/tasks/`: Task use-cases, payload builders, and export orchestration.

### Current Backend Guardrails

- Reject file deletion with `409` when any transcription task references the file.
- Return `404` when a file row disappears between lookup and delete; do not unlink and report success.
- Return `409` when a model download starts for an already-downloaded model.
- Treat Hugging Face repos with revisions as `downloaded` without scanning incomplete files.
- Remove metadata-only partial cache directories during stale artifact cleanup.
- Keep model registry descriptions keyed by `description_key`; let the frontend localize and fall back to backend `description`.
- Keep engine default tests config-driven; do not hardcode `small`, `default`, or device defaults.

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
- `tasks.py`: Keep `TaskDatabase` as facade and delegate to split repositories.
- `taskdb/task_queue.py`: Handle enqueue/dequeue/heartbeat/complete/fail/requeue flows; clear stale `error` on successful completion; reset `progress` when requeueing failed/timeout/dead-worker tasks.
- `taskdb/task_store.py`: Handle get/list/count/cancel/delete persistence queries.
- `taskdb/query_helpers.py`: Keep query helper functions isolated from repository classes; validate decoded JSON shapes for `segments` and `options` before casting task rows.
- `taskdb/types.py`: Keep shared task statuses, sort fields, and TypedDict contracts.
- `utils/db.py`: Database utilities (e.g., `ensure_sqlite_version`).

### nola/common/
Shared backend helper layer:
- `merge.py`: Provide recursive deep-merge behavior for defaults composition.
- `types.py`: Provide recursive JSON-compatible type aliases for shared config code.
- `event_bus.py`: Publish and subscribe process-wide model-download events for SSE streaming.

### nola/model_hub/
Model lifecycle management:
- `registry.py`: Keep the curated model registry and canonical/alias lookup helpers.
- `storage.py`: Resolve model cache roots, inspect Hugging Face cache state, short-circuit revision-backed repos as downloaded, and delete full or partial cache artifacts.
- Treat metadata-only repo cache directories with no revisions as partial artifacts; remove them during stale-artifact cleanup.
- Do not scan the full cache tree for incomplete files once tracked revisions exist.
- `downloader.py`: Run subprocess-backed downloads, aggregate real byte progress and speed, and expose active download snapshots.
- `contracts.py`: Keep shared model metadata and download/runtime value objects.
- `errors.py`: Define model-hub domain errors for API mapping and worker startup guards.

### nola/engines/
Transcription engine layer:
- `Segment`: Data class for transcribed segment with timing
- `EngineConfig`: Engine initialization configuration
- `TranscribeOptions`: Full transcription options (language, beam_size, vad_filter, etc.)
- `TranscriptionEngine`: Abstract interface for transcription engines
- `FasterWhisperEngine`: Faster-Whisper implementation

### nola/api/
REST API layer:
- `deps.py`: Dependency injection for database singletons plus shared model storage, downloader, and event-bus singletons.
- `routes/config.py`: Aggregated config endpoints, transcription defaults management, and export defaults management.
- `routes/files.py`: File upload/list/delete with validation. Reject file deletion with `409` when tasks still reference the file; return `404` when a concurrent delete wins after the initial lookup. All endpoints use `response_model`.
- `routes/models.py`: Model list/detail/download/cancel/delete/select/settings endpoints, SSE event stream, active-download runtime summary, and `409` responses for both active downloads and already-downloaded models.
- `routes/transcriptions.py`: Canonical task router composition entry. Mount read/actions/export task route modules under `/api/transcription-tasks`.
- `routes/tasks/read.py`: Read endpoints for task list/detail; keep sync handlers for sync DB dependencies.
- `routes/tasks/actions.py`: Mutation endpoints for create/cancel/batch/retry/delete-record.
- `routes/tasks/export.py`: Single/batch export endpoints and OpenAPI response metadata; map use-case output to FastAPI `Response`/`StreamingResponse`.
- `routes/tasks/_errors.py`: Convert task use-case errors into HTTP exceptions.
- `schemas/config.py`: Export defaults update request schema.
- `schemas/files.py`: 8 Pydantic response models (`FileResponse`, `FileListResponse`, etc.)
- `schemas/models.py`: Model management request/response models for list/detail/settings/download runtime. Include download conflict metadata in route OpenAPI responses.
- `schemas/responses.py`: 7 Pydantic response models (`TaskDetailResponse`, `CreateTaskResponse`, etc.); task read responses now expose persisted `model_id` context
- `schemas/transcriptions.py`: Request models (`TranscriptionRequest`, `BatchTaskActionRequest`, `BatchExportRequest`, `TranscriptionDefaultsUpdateRequest`) with typed `VadParametersRequest` and `extra=forbid`
- `schemas/validators.py`: Reusable validation functions for language, task options, temperature, and nested `vad_parameters` keys

### nola/application/
Application-layer orchestration:
- `tasks/contracts.py`: Protocol contracts for task/file gateways used by use-cases.
- `tasks/types.py`: TypedDict payload contracts for task use-case outputs, including persisted task `model_id` in read payloads.
- `tasks/payloads.py`: Shared task payload builders (`to_task_summary_payload`, batch summary builder); preserve task `model_id` across list/detail/cancel responses.
- `tasks/actions/`: Write-side use-cases (`create_task`, `cancel_task`, `batch_cancel_tasks`, `batch_retry_tasks`, `delete_task_record`).
- `tasks/actions/_batch_action.py`: Reuse batch execution skeleton; keep per-task result semantics; return item-level failures instead of aborting whole batch.
- `tasks/queries/`: Read-side use-cases (`list_tasks`, `get_task`).
- `tasks/exports/`: Keep export use-cases (`export_task`, `batch_export_tasks`) and export option resolver; return framework-agnostic `BatchExportArchive` from batch use-case; map `save=true` write-path I/O failures to stable `TaskUseCaseError` details.

### nola/services/
Background services:
- `worker.py`: Independent worker process that dequeues and executes transcription tasks
  - Loads engine once for performance
  - `build_transcribe_options()` merges engine defaults, app defaults, and task overrides
  - JSON options parsing with error handling
  - Resolves `configured_model_id` and effective `model_dir` before engine startup; validate explicit configured ids instead of silently replacing them
  - Rejects implicit model auto-download and requires cached models from model management
  - Persists canonical `worker.last_loaded_model_id` and `worker.last_loaded_model_dir` for runtime config state
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
- `GET /api/config/export` - Get effective export defaults
- `PATCH /api/config/export/defaults` - Persist export default overrides
- `DELETE /api/config/export/defaults` - Reset persisted export defaults
- `GET /api/models` - List registered models with local and download state
- `GET /api/models/downloads` - List active downloads with real current speed
- `GET /api/models/settings` - Read model directory and configured-model settings
- `PATCH /api/models/settings` - Update model directory settings
- `GET /api/models/events` - Stream model download SSE events
- `GET /api/models/{model_id}` - Get one model detail
- `POST /api/models/{model_id}/download` - Start model download; return `409` when the model is already downloading or already cached
- `POST /api/models/{model_id}/cancel` - Cancel active model download
- `DELETE /api/models/{model_id}` - Delete local model cache
- `POST /api/models/{model_id}/select` - Select configured model for next worker startup
- `POST /api/files/` - Upload audio file
- `GET /api/files/` - List all files
- `GET /api/files/{file_id}` - Get file metadata
- `DELETE /api/files/{file_id}` - Delete file only when no transcription task still references it
- `GET /api/files/check-integrity` - Check database-file consistency
- `POST /api/files/cleanup` - Remove orphan database records
- `POST /api/transcription-tasks/` - Create transcription task
- `GET /api/transcription-tasks/` - List tasks with status/search/sort/pagination
- `GET /api/transcription-tasks/{task_id}` - Get task status/result
- `DELETE /api/transcription-tasks/{task_id}` - Cancel task
- `POST /api/transcription-tasks/batch/cancel` - Batch cancel tasks
- `POST /api/transcription-tasks/batch/retry` - Batch retry tasks
- `DELETE /api/transcription-tasks/{task_id}/record` - Delete terminal task record
- `GET /api/transcription-tasks/{task_id}/export` - Export as subtitle (SRT/VTT/TXT/ASS)
- `POST /api/transcription-tasks/export/batch` - Batch export as ZIP

### nola/config/
Configuration and constants:
- `settings.py`: Pydantic Settings (data_dir, exports_dir, max_file_size, model defaults, host/port)
- `constants.py`: Validation constants (MIME/extension allowlists, language set, batch limits via `MAX_BATCH_TASK_IDS`)
- `common/`: Shared config patch helper and config value types
- `transcription/contracts.py`: Keep shared option keys/contracts for API validators and schema assembly.
- `transcription/schema/models.py`: Keep field/group schema models; enforce numeric invariants (`min <= max`, `step > 0`) and select option-source one-of rules.
- `transcription/schema/registry.py`: Build transcription schema registry and grouped response view.
- `transcription/schema/responses.py`: Assemble config response models and defaults response payloads.
- `transcription/defaults.py` + `transcription/languages.py`: Resolve effective defaults and effective language list.
- `export/types.py`: Keep shared `ExportFormat` enum for config and formatter layers.
- `export/`: Keep export defaults and filename handling without introducing `config -> services` reverse dependency.

### Transcription Rules
Apply config-driven schema as the only source for frontend option metadata and task option values.
Apply defaults precedence as `engine defaults < persisted app defaults < task overrides`.
Derive engine default assertions from `EngineConfig`/settings in tests; do not hardcode `small`, `default`, or device defaults.
Treat explicit `null` in `PATCH /api/config/transcription/defaults` as remove-override semantics.
Merge nested defaults objects in PATCH flows without replacing untouched subkeys.
Reject unknown top-level options and unknown `vad_parameters` keys at request validation with `422`.
Keep `engines/base.py` as pass-through for option values; do not add engine-side strict range enforcement.
Keep `api/schemas/*` as coarse guard; block clearly invalid payloads and return `422`.
Keep `config/transcription/schema/*` as UI constraint source; ensure UI ranges remain a subset of API acceptance.
Keep API coarse guards and UI schema constraints independent; do not force exact numeric-range equality across both layers.
Serialize infinity as `"inf"` at API boundaries and deserialize it back before engine invocation.
Use only `/api/transcription-tasks/*` for task APIs; do not add `/api/transcriptions/*` runtime aliases.
Apply export defaults precedence as `built-in export defaults < persisted export defaults < request overrides`.
Map export write-path `OSError` and `UnicodeError` failures to stable API error details; do not widen this mapping to catch-all exceptions.
Keep batch export error output sanitized; write stable task-level reasons to `_errors.txt` and do not write raw exception text into archives.
Record `no_segments` as task-level batch export failure; return `400` only when every selected task fails.

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

```text
Client ──▶ FastAPI routes ──▶ application use-cases ──▶ SQLite DB ◀── Worker Process
                                   │                          │              │
                                   │                          │       FasterWhisperEngine
                                   ▼                          ▼
                              API schemas               data/nola.db
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
| `/api/config/export` | GET | - | `ExportConfigResponse` |
| `/api/config/export/defaults` | PATCH | `ExportDefaultsUpdateRequest` | `ExportDefaultsPatchResponse` |
| `/api/config/export/defaults` | DELETE | - | `204 No Content` |

### Files API

| Endpoint | Method | Body/Query | Response Model |
|----------|--------|------------|----------------|
| `/api/files/` | POST | `file: UploadFile` | `FileUploadResponse` |
| `/api/files/` | GET | `?limit=&offset=` | `FileListResponse` |
| `/api/files/{file_id}` | GET | - | `FileResponse` |
| `/api/files/{file_id}` | DELETE | - | `DeleteResponse` |
| `/api/files/check-integrity` | GET | - | `IntegrityCheckResponse` |
| `/api/files/cleanup` | POST | - | `CleanupResponse` |

File deletion contract: return `409` when transcription tasks still reference the file; return `404` when the row disappears before delete finishes.

### Models API

| Endpoint | Method | Body/Query | Response Model |
|----------|--------|------------|----------------|
| `/api/models` | GET | - | `ModelListResponse` |
| `/api/models/downloads` | GET | - | `ActiveModelDownloadsResponse` |
| `/api/models/settings` | GET | - | `ModelSettingsResponse` |
| `/api/models/settings` | PATCH | `ModelSettingsUpdateRequest` | `ModelSettingsResponse` |
| `/api/models/events` | GET | SSE | model-download event stream |
| `/api/models/{model_id}` | GET | - | `ModelDetailResponse` |
| `/api/models/{model_id}/download` | POST | - | `ModelDownloadStartedResponse` or `409` |
| `/api/models/{model_id}/cancel` | POST | - | `ModelCancelResponse` |
| `/api/models/{model_id}` | DELETE | - | `ModelDeleteResponse` |
| `/api/models/{model_id}/select` | POST | - | `ModelSelectResponse` |

Model download contract: return `409` for both duplicate active downloads and already-cached models; expose both cases in OpenAPI route metadata.

### Transcription Tasks API

| Endpoint | Method | Body/Query | Response Model |
|----------|--------|------------|----------------|
| `/api/transcription-tasks/` | POST | `TranscriptionRequest` | `CreateTaskResponse` |
| `/api/transcription-tasks/` | GET | `?status=&q=&sort_by=&order=&limit=&offset=` | `TaskListResponse` |
| `/api/transcription-tasks/{task_id}` | GET | - | `TaskDetailResponse` |
| `/api/transcription-tasks/{task_id}` | DELETE | - | `CancelTaskResponse` |
| `/api/transcription-tasks/batch/cancel` | POST | `BatchTaskActionRequest` | `BatchTaskActionResponse` |
| `/api/transcription-tasks/batch/retry` | POST | `BatchTaskActionRequest` | `BatchTaskActionResponse` |
| `/api/transcription-tasks/{task_id}/record` | DELETE | - | `DeleteTaskRecordResponse` |
| `/api/transcription-tasks/{task_id}/export` | GET | `?format=&include_timestamps=&filename=&save=` | Binary or `SavedExportResponse` |
| `/api/transcription-tasks/export/batch` | POST | `BatchExportRequest` | ZIP binary |

---

## Task Lifecycle

```text
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
| Formats | mp3, wav, flac, m4a, ogg, webm, aac, mp4, wma |
| Max retries | 3 |
| Task timeout | 30 min |
| Heartbeat timeout | 5 min |
