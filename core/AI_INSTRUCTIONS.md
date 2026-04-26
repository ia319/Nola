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
│   │       ├── execution_config.py # Resolve task-level engine execution config
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
│   │   ├── session/           # Workbench session defaults aggregation
│   │   │   ├── __init__.py    # Session config exports
│   │   │   └── defaults.py    # Execution and transcription defaults helpers
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
│   │       ├── config.py      # Session defaults and export defaults schemas
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
│       ├── worker_engine.py   # Task-boundary engine fingerprint reload helper
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
    ├── test_task_execution_config.py # Task execution config resolution tests
    ├── test_task_use_cases.py # Application-layer task use-case tests
    ├── test_worker.py         # Worker tests
    ├── test_worker_engine.py  # Worker engine reload tests
    └── test_formatters.py     # Formatter tests
```

Keep generated or local-runtime directories such as `data/`, `__pycache__/`, `.pytest_cache/`, `.mypy_cache/`, and `.ruff_cache/` out of this tree.

### Recent Additions

- `nola/common/event_bus.py`: Process-wide in-memory event bus for model-download SSE.
- `nola/model_hub/`: Model registry, storage, downloader, and domain errors.
- `nola/api/routes/models.py` + `nola/api/schemas/models.py`: Model management and runtime download APIs.
- `nola/config/transcription/schema/`: Config-driven option schema for frontend controls and validation boundaries.
- `nola/config/export/`: Export defaults, export format contracts, and filename helpers.
- `nola/config/session/`: Workbench session defaults for execution and transcription.
- `nola/application/tasks/`: Task use-cases, payload builders, and export orchestration.
- `nola/application/tasks/execution_config.py`: Resolve task-level `model_id`, `engine_device`, and `engine_compute_type` before persistence.
- `nola/services/worker_engine.py`: Reuse or reload `FasterWhisperEngine` at task boundaries from a model/model-dir/device/compute-type fingerprint.

### Current Backend Guardrails

- Reject file deletion with `409` when any transcription task references the file.
- Return `404` when a file row disappears between lookup and delete; do not unlink and report success.
- Return `409` when a model download starts for an already-downloaded model.
- Treat Hugging Face repos with revisions as `downloaded` without scanning incomplete files.
- Remove metadata-only partial cache directories during stale artifact cleanup.
- Keep model registry descriptions keyed by `description_key`; let the frontend localize and fall back to backend `description`.
- Keep engine default tests config-driven; do not hardcode `small`, `default`, or device defaults.
- Keep worker engine reload at task boundaries; do not switch engine while `transcribe()` is running.
- Close the loaded transcription engine before replacing it; do not rely on reassignment or garbage collection as the only release path for model runtime resources.
- Keep `model_id`, `device`, and `compute_type` out of `TranscribeOptions` and task `options` JSON.
- Keep `restart_required` as a compatibility field returning `False` while task-boundary engine reload is supported; do not use it to signal manual worker restart.
- Keep VAD fields gated by the installed `faster-whisper` `VadOptions`; do not expose fields only present in local source unless the installed package supports them.
- Treat transcription progress as segment output coverage, not faster-whisper internal progress.

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
- `database.py`: Schema initialization, connection management, foreign key enforcement, and task execution config column migrations.
- `app_config.py`: `AppConfigDatabase` for persisted application defaults under `app_config`.
- `files.py`: `FileDatabase` for managing audio file metadata. Uses `FileRow` TypedDict.
- `tasks.py`: Keep `TaskDatabase` as facade and delegate to split repositories.
- `taskdb/task_queue.py`: Handle enqueue/dequeue/heartbeat/complete/fail/requeue flows; persist task `model_id`, `engine_device`, and `engine_compute_type`; clear stale `error` on successful completion; reset `progress` when requeueing failed/timeout/dead-worker tasks.
- `taskdb/task_store.py`: Handle get/list/count/cancel/delete persistence queries.
- `taskdb/query_helpers.py`: Keep query helper functions isolated from repository classes; validate decoded JSON shapes for `segments` and `options` before casting task rows.
- `taskdb/types.py`: Keep shared task statuses, sort fields, and task row TypedDict contracts including persisted execution config fields.
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
- `EngineDevice` / `EngineComputeType`: Literal engine initialization option contracts. Keep allowed values centralized in `engines/base.py`.
- `DEFAULT_ENGINE_DEVICE`: Keep the safe fallback as `auto`.
- `DEFAULT_ENGINE_COMPUTE_TYPE`: Keep the safe fallback as `default`.
- `Segment`: Data class for transcribed segment with timing.
- `EngineConfig`: Engine initialization configuration. Keep model size, model directory, device, and compute type here.
- `TranscribeOptions`: Full transcription options passed to `WhisperModel.transcribe(...)`; do not add engine initialization parameters here.
- `TranscriptionEngine`: Abstract interface for transcription engines, including explicit resource release through `close()`.
- `FasterWhisperEngine`: Faster-Whisper implementation. Report progress as segment output coverage only and release the underlying model reference on close.

### nola/api/
REST API layer:
- `deps.py`: Dependency injection for database singletons plus shared model storage, downloader, and event-bus singletons.
- `routes/config.py`: Aggregated config endpoints, session defaults management, transcription defaults management, and export defaults management.
- `routes/files.py`: File upload/list/delete with validation. Reject file deletion with `409` when tasks still reference the file; return `404` when a concurrent delete wins after the initial lookup. All endpoints use `response_model`.
- `routes/models.py`: Model list/detail/download/cancel/delete/select/settings endpoints, SSE event stream, active-download runtime summary, and `409` responses for both active downloads and already-downloaded models.
- `routes/transcriptions.py`: Canonical task router composition entry. Mount read/actions/export task route modules under `/api/transcription-tasks`.
- `routes/tasks/read.py`: Read endpoints for task list/detail; keep sync handlers for sync DB dependencies.
- `routes/tasks/actions.py`: Mutation endpoints for create/cancel/batch/retry/delete-record; resolve task execution config before task creation.
- `routes/tasks/export.py`: Single/batch export endpoints and OpenAPI response metadata; map use-case output to FastAPI `Response`/`StreamingResponse`.
- `routes/tasks/_errors.py`: Convert task use-case errors into HTTP exceptions.
- `schemas/config.py`: Config request/response schemas for session defaults and export defaults.
- `schemas/files.py`: 8 Pydantic response models (`FileResponse`, `FileListResponse`, etc.)
- `schemas/models.py`: Model management request/response models for list/detail/settings/download runtime. Include download conflict metadata in route OpenAPI responses.
- `schemas/responses.py`: 7 Pydantic response models (`TaskDetailResponse`, `CreateTaskResponse`, etc.); task read responses now expose persisted `model_id` context
- `schemas/transcriptions.py`: Request models (`TranscriptionRequest`, `TaskEngineRequest`, `BatchTaskActionRequest`, `BatchExportRequest`, `TranscriptionDefaultsUpdateRequest`) with typed `VadParametersRequest` and `extra=forbid`
- `schemas/validators.py`: Reusable validation functions for language, task options, temperature, and nested `vad_parameters` keys

### nola/application/
Application-layer orchestration:
- `tasks/contracts.py`: Protocol contracts for task/file gateways used by use-cases.
- `tasks/types.py`: TypedDict payload contracts for task use-case outputs and resolved task execution config.
- `tasks/execution_config.py`: Resolve task execution config from request values, Session defaults, settings, and model aliases before enqueue.
- `tasks/payloads.py`: Shared task payload builders (`to_task_summary_payload`, batch summary builder); preserve task `model_id` across list/detail/cancel responses.
- `tasks/actions/`: Write-side use-cases (`create_task`, `cancel_task`, `batch_cancel_tasks`, `batch_retry_tasks`, `delete_task_record`); create/retry paths preserve persisted execution config.
- `tasks/actions/_batch_action.py`: Reuse batch execution skeleton; keep per-task result semantics; return item-level failures instead of aborting whole batch.
- `tasks/queries/`: Read-side use-cases (`list_tasks`, `get_task`).
- `tasks/exports/`: Keep export use-cases (`export_task`, `batch_export_tasks`) and export option resolver; return framework-agnostic `BatchExportArchive` from batch use-case; map `save=true` write-path I/O failures to stable `TaskUseCaseError` details.

### nola/services/
Background services:
- `worker.py`: Independent worker process that dequeues and executes transcription tasks
  - Enters the queue loop without preloading an engine
  - Resolves the desired engine state before each claimed task
  - Releases the previous engine before loading a different fingerprint
  - Calls `worker_engine.ensure_engine_loaded()` after task-boundary reload checks
  - `build_transcribe_options()` merges engine defaults, app defaults, and task transcription overrides only
  - JSON options parsing with error handling
  - Rejects implicit model auto-download and requires cached models from model management
  - Persists canonical `worker.last_loaded_model_id`, `worker.last_loaded_model_dir`, `worker.last_loaded_device`, and `worker.last_loaded_compute_type` after engine load
  - Fails only the current task when engine resolution, model cache validation, engine release, or engine load fails
  - Marks dequeued tasks retryable when unexpected Python errors occur during engine preparation
- `worker_engine.py`: Task-boundary engine reload helper
  - Build desired engine state from persisted task execution config and current model directory settings.
  - Fallback legacy tasks through configured model/settings when persisted execution columns are missing.
  - Validate downloaded model cache before loading.
  - Close loaded engines before replacing a runtime fingerprint.
  - Reuse a loaded engine when the fingerprint matches.
  - Reload only between tasks when model, model directory, device, or compute type changes.
  - Ignore runtime state write failures after successful engine load.
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
- `GET /api/config/session-defaults` - Get Workbench session defaults
- `PATCH /api/config/session-defaults` - Persist Workbench session defaults
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
- `POST /api/models/{model_id}/select` - Select the configured default model for future tasks without forcing worker restart
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
- `session/defaults.py`: Resolve Workbench session defaults by combining execution defaults and transcription defaults.

### Transcription Rules
Apply config-driven schema as the only source for frontend option metadata and task option values.
Apply defaults precedence as `engine defaults < persisted app defaults < task overrides`.
Apply execution config precedence as request values, then Session defaults, then settings fallbacks.
Derive engine default assertions from `EngineConfig`/settings in tests; do not hardcode `small`, `default`, or device defaults.
Treat explicit `null` in `PATCH /api/config/transcription/defaults` as remove-override semantics.
Treat explicit `null` in `PATCH /api/config/session-defaults` execution fields as clear-override semantics.
Merge nested defaults objects in PATCH flows without replacing untouched subkeys.
Reject unknown top-level options and unknown `vad_parameters` keys at request validation with `422`.
Reject invalid task or Session default `device` / `compute_type` values at the boundary; read paths may ignore stale invalid persisted overrides and fall back safely.
Keep `engines/base.py` as pass-through for option values; do not add engine-side strict range enforcement.
Keep `api/schemas/*` as coarse guard; block clearly invalid payloads and return `422`.
Keep `config/transcription/schema/*` as UI constraint source; ensure UI ranges remain a subset of API acceptance.
Keep API coarse guards and UI schema constraints independent; do not force exact numeric-range equality across both layers.
Serialize infinity as `"inf"` at API boundaries and deserialize it back before engine invocation.
Use only `/api/transcription-tasks/*` for task APIs; do not add `/api/transcriptions/*` runtime aliases.
Use `/api/config/session-defaults` for Workbench execution defaults; do not add `/api/config/engine` as a parallel write path.
Persist resolved `model_id`, `engine_device`, and `engine_compute_type` on new tasks; do not let later default changes mutate already queued tasks.
Treat `worker.last_loaded_*` fields as recently loaded runtime state, not desired defaults.
Treat Default and Running model mismatch as normal after task-boundary reload.
Treat `restart_required` as a compatibility field that remains `false` under the current task-boundary reload architecture.
Close the current transcription engine before loading a different engine fingerprint.
Gate local-source-only VAD fields with the installed `faster-whisper` `VadOptions`.
Treat `FasterWhisperEngine` progress callbacks as output coverage estimates; do not call them faster-whisper internal progress.
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
| `/api/config/session-defaults` | GET | - | `SessionDefaultsResponse` |
| `/api/config/session-defaults` | PATCH | `SessionDefaultsUpdateRequest` | `SessionDefaultsResponse` |
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
