# AI Instructions - Nola Core

> Backend project reference for AI-assisted navigation and human onboarding.

## Project Overview

| Key | Value |
|-----|-------|
| Name | Nola Core - Speech-to-text Backend |
| Stack | Python (FastAPI) + SQLite + Faster-Whisper worker + Live WebSocket runtime |

---

## Reference Style

> **Reference text and code comment standards**
>
> - Reference language: English.
> - Reference tone: brief, objective, result-state.
> - Reference shape: noun phrases, stable contracts, concrete paths.
> - Reference wording: objective noun phrases over command-style instructions.
> - Function docs: concise behavior summary, no tense markers.

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
│   ├── application/           # Application-layer workflows
│   │   ├── __init__.py        # Application package exports
│   │   ├── files/             # File upload/list/delete workflows
│   │   │   ├── __init__.py    # File workflow exports
│   │   │   ├── contracts.py   # File store and upload stream protocols
│   │   │   ├── errors.py      # File workflow error model
│   │   │   ├── payloads.py    # File response payload builders
│   │   │   ├── types.py       # File TypedDict payload contracts
│   │   │   ├── actions/       # File write-side workflows
│   │   │   │   ├── __init__.py # File action exports
│   │   │   │   ├── batch_delete_uploaded_files.py # Batch file delete workflow
│   │   │   │   ├── cleanup_orphan_files.py # Orphan cleanup workflow
│   │   │   │   ├── delete_uploaded_file.py # Single file delete workflow
│   │   │   │   └── upload_uploaded_file.py # Upload validation/storage workflow
│   │   │   └── queries/       # File read-side workflows
│   │   │       ├── __init__.py # File query exports
│   │   │       ├── check_file_integrity.py # File integrity query
│   │   │       ├── get_uploaded_file.py # File detail query
│   │   │       └── list_uploaded_files.py # File list query
│   │   ├── models/            # Model registry/cache/download workflows
│   │   │   ├── __init__.py    # Model workflow exports
│   │   │   ├── contracts.py   # Model storage/downloader/config protocols
│   │   │   ├── errors.py      # Model workflow error model
│   │   │   ├── operation_locks.py # Per-model mutation locks
│   │   │   ├── payloads.py    # Model response payload builders
│   │   │   ├── types.py       # Model TypedDict payload contracts
│   │   │   ├── values.py      # Model query value helpers
│   │   │   ├── actions/       # Model write-side workflows
│   │   │   │   ├── __init__.py # Model action exports
│   │   │   │   ├── cancel_model_download.py # Cancel download workflow
│   │   │   │   ├── delete_model_cache.py # Delete cached model workflow
│   │   │   │   ├── select_configured_model.py # Select default model workflow
│   │   │   │   ├── start_model_download.py # Start download workflow
│   │   │   │   └── update_model_settings.py # Update model settings workflow
│   │   │   └── queries/       # Model read-side workflows
│   │   │       ├── __init__.py # Model query exports
│   │   │       ├── get_model_detail.py # Model detail query
│   │   │       ├── get_model_settings.py # Model settings query
│   │   │       ├── list_active_downloads.py # Active download query
│   │   │       └── list_models.py # Model list query
│   │   ├── live/              # Live transcription session workflows
│   │   │   ├── __init__.py    # Live workflow exports
│   │   │   ├── _clock.py      # UTC timestamp helper
│   │   │   ├── contracts.py   # Live repository protocols
│   │   │   ├── errors.py      # Live workflow error model
│   │   │   ├── payloads.py    # Live response payload builders
│   │   │   ├── runtime_config.py # Live realtime config snapshot resolution
│   │   │   ├── types.py       # Live TypedDict payloads, literals, and pagination limits
│   │   │   ├── values.py      # Live value and pagination validators
│   │   │   ├── actions/       # Live write-side workflows
│   │   │   │   ├── __init__.py # Live action exports
│   │   │   │   ├── batch_delete_live_sessions.py # Batch terminal live-record delete workflow
│   │   │   │   ├── create_live_session.py # Active Live session creation
│   │   │   │   ├── delete_live_session.py # Single terminal live-record delete workflow
│   │   │   │   ├── fail_live_session.py # Active Live session failure transition
│   │   │   │   └── finish_live_session.py # Active Live session finish transition
│   │   │   ├── exports/       # Live export workflows (single/batch)
│   │   │   │   ├── __init__.py # Live export workflow exports
│   │   │   │   ├── batch_export_live_sessions.py # Batch live export archive workflow
│   │   │   │   ├── export_common.py # Shared live export payload and segment helpers
│   │   │   │   └── export_live_session.py # Single live session export workflow
│   │   │   ├── queries/       # Live read-side workflows
│   │   │   │   ├── __init__.py # Live query exports
│   │   │   │   ├── get_live_session.py # Live detail query with segment pagination
│   │   │   │   └── list_live_sessions.py # Live session list query
│   │   │   └── realtime/      # Live WebSocket runtime services
│   │   │       ├── __init__.py # Realtime service exports
│   │   │       ├── audio.py   # PCM16 frame validation and float32 conversion
│   │   │       ├── connection_registry.py # Single-worker live stream writer registry
│   │   │       ├── diagnostics.py # Explicit WAV diagnostics writer and manifest handling
│   │   │       ├── errors.py  # Realtime runtime error type
│   │   │       ├── mock_transcriber.py # Deterministic Mock committed/final generator
│   │   │       ├── protocol.py # Protocol constants, event order, and error codes
│   │   │       ├── session.py # Per-WebSocket Live realtime session state machine
│   │   │       ├── transcriber.py # Realtime transcriber contracts
│   │   │       └── whisper_streaming/ # WhisperStreaming / LocalAgreement Live runtime
│   │   │           ├── __init__.py # Runtime package exports
│   │   │           ├── README.md   # Upstream source, module purpose, data flow, and boundaries
│   │   │           ├── adapter.py  # Live transcriber adapter over track processors
│   │   │           ├── backend.py  # faster-whisper backend for accumulated waveform inference
│   │   │           ├── config.py   # Runtime defaults and validation
│   │   │           ├── errors.py   # Stable WhisperStreaming runtime errors
│   │   │           ├── hypothesis.py # LocalAgreement hypothesis buffer
│   │   │           ├── loader.py   # Configured model, cache, and backend loader
│   │   │           ├── processor.py # Track-scoped online processor and trimming
│   │   │           ├── silence.py  # Silence state for segment close/context reset
│   │   │           └── types.py    # Runtime internal contracts
│   │   └── tasks/             # Task workflows and shared payload contracts
│   │       ├── __init__.py    # Task workflow exports
│   │       ├── contracts.py   # Task/file gateway protocols
│   │       ├── errors.py      # Task workflow error model
│   │       ├── execution_config.py # Task-level engine execution config resolution
│   │       ├── payloads.py    # Shared task response payload builders
│   │       ├── runtime_config.py # Task runtime config snapshot resolution
│   │       ├── types.py       # TypedDict payload contracts
│   │       ├── actions/       # Write-side workflows (create/cancel/batch/delete)
│   │       │   ├── __init__.py # Action workflow exports
│   │       │   ├── _batch_action.py # Shared batch action executor
│   │       │   ├── batch_cancel_tasks.py # Batch cancel workflow
│   │       │   ├── batch_delete_task_records.py # Batch terminal-record delete workflow
│   │       │   ├── batch_retry_tasks.py # Batch retry workflow
│   │       │   ├── cancel_task.py # Single task cancel workflow
│   │       │   ├── create_task.py # Task creation workflow
│   │       │   └── delete_task_record.py # Terminal task-record deletion workflow
│   │       ├── queries/       # Read-side workflows (list/detail)
│   │       │   ├── __init__.py # Query workflow exports
│   │       │   ├── get_task.py # Task detail query workflow
│   │       │   └── list_tasks.py # Task list query workflow
│   │       └── exports/       # Export workflows (single/batch)
│   │           ├── __init__.py # Export workflow exports
│   │           ├── batch_export_tasks.py # Batch export archive workflow
│   │           ├── export_common.py # Shared export payload and error helpers
│   │           └── export_task.py # Single task export workflow
│   ├── config/                # Settings, constants, and config modules
│   │   ├── __init__.py        # Config exports
│   │   ├── settings.py        # Pydantic Settings (paths, limits, model, Live runtime mode)
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
│   │   ├── live_realtime/     # Live realtime defaults, schema, and types
│   │   │   ├── __init__.py    # Live realtime config exports
│   │   │   ├── defaults.py    # Built-in/effective defaults and prefix helpers
│   │   │   ├── schema.py      # Schema metadata for Settings controls
│   │   │   └── types.py       # Defaults and field schema contracts
│   │   ├── session/           # Workbench session defaults aggregation
│   │   │   ├── __init__.py    # Session config exports
│   │   │   ├── defaults.py    # Execution and transcription defaults helpers
│   │   │   └── schema.py      # Execution option schema metadata
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
│   │   ├── deps.py            # Dependency injection and runtime factories
│   │   ├── routes/            # API endpoints
│   │   │   ├── __init__.py    # Route package exports
│   │   │   ├── _live_realtime_events.py # Live WebSocket server event builders
│   │   │   ├── _model_helpers.py # Shared model-route helper functions
│   │   │   ├── config.py      # Config aggregation and defaults endpoints
│   │   │   ├── files.py       # File upload/management
│   │   │   ├── live.py        # Live session REST endpoints and WebSocket stream
│   │   │   ├── models.py      # Model management and download runtime endpoints
│   │   │   ├── transcriptions.py  # Canonical task route composition entry
│   │   │   └── tasks/         # Task route modules grouped by responsibility
│   │   │       ├── __init__.py  # Task route package exports
│   │   │       ├── read.py    # Task list/detail endpoints
│   │   │       ├── actions.py # Task mutation endpoints
│   │   │       ├── export.py  # Task export endpoints
│   │   │       └── _errors.py # Task workflow error mapping helper
│   │   └── schemas/           # Pydantic request/response models
│   │       ├── __init__.py    # Schema package exports
│   │       ├── config.py      # Session defaults and export defaults schemas
│   │       ├── files.py       # File schemas, batch delete, integrity, cleanup responses
│   │       ├── live.py        # Live request/response schemas
│   │       ├── live_realtime.py # Live WebSocket protocol schemas
│   │       ├── live_realtime_config.py # Live realtime defaults and override schemas
│   │       ├── models.py      # Model request/response schema set
│   │       ├── responses.py   # TaskDetailResponse, CreateTaskResponse, etc.
│   │       ├── transcriptions.py  # TranscriptionRequest, BatchExportRequest, defaults update
│   │       └── validators.py  # Reusable schema validators
│   ├── engines/               # Transcription engines
│   │   ├── __init__.py        # Engine package exports
│   │   ├── base.py            # Segment, EngineConfig, TranscriptionEngine
│   │   ├── faster_whisper_defaults.py # Neutral faster-whisper default introspection
│   │   ├── faster_whisper.py  # FasterWhisperEngine implementation
│   │   └── faster_whisper_runtime.py # Shared faster-whisper model lifecycle helpers
│   ├── models/                # Data models & Database
│   │   ├── __init__.py        # Model package exports
│   │   ├── app_config.py      # AppConfigDatabase for persisted defaults
│   │   ├── database.py        # Schema & init
│   │   ├── files.py           # FileDatabase class
│   │   ├── live.py            # LiveDatabase for sessions, tracks, and segments
│   │   ├── query_helpers.py   # Shared SQLite contains-search helpers
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
    ├── test_file_use_cases.py # File application workflow tests
    ├── test_formatters.py     # Formatter tests
    ├── test_faster_whisper_runtime.py # Shared faster-whisper lifecycle tests
    ├── test_live_api.py      # Live REST and WebSocket API tests
    ├── test_live_database.py # Live database tests
    ├── test_live_realtime_audio.py # Live realtime PCM and WAV tests
    ├── test_live_realtime_config.py # Live realtime config defaults/schema tests
    ├── test_live_realtime_mock_transcriber.py # Live realtime Mock transcriber tests
    ├── test_live_realtime_protocol.py # Live realtime protocol schema tests
    ├── test_live_realtime_session.py # Live realtime runtime tests
    ├── test_live_realtime_whisper_streaming_adapter.py # Live WhisperStreaming adapter tests
    ├── test_live_realtime_whisper_streaming_backend.py # Live WhisperStreaming faster-whisper backend tests
    ├── test_live_realtime_whisper_streaming_hypothesis.py # LocalAgreement hypothesis tests
    ├── test_live_realtime_whisper_streaming_loader.py # Live WhisperStreaming loader tests
    ├── test_live_realtime_whisper_streaming_package.py # Live WhisperStreaming package tests
    ├── test_live_realtime_whisper_streaming_processor.py # Live WhisperStreaming processor tests
    ├── test_live_realtime_whisper_streaming_silence.py # Live WhisperStreaming silence tests
    ├── test_live_runtime_config.py # Live runtime config resolver tests
    ├── test_live_use_cases.py # Live application workflow tests
    ├── test_model_use_cases.py # Model application workflow tests
    ├── test_models.py         # Database tests
    ├── test_model_downloader.py # Model downloader tests
    ├── test_model_registry.py # Model registry tests
    ├── test_model_storage.py  # Model storage tests
    ├── test_session_defaults.py # Session defaults tests
    ├── test_settings.py       # Settings validation tests
    ├── test_task_execution_config.py # Task execution config resolution tests
    ├── test_task_repositories.py # taskdb repository tests
    ├── test_task_use_cases.py # Application-layer task workflow tests
    ├── test_transcription_config.py # Transcription schema/defaults tests
    ├── test_transcription_contracts.py # Transcription contract consistency tests
    ├── test_transcription_schemas.py # Request schema validation tests
    ├── test_worker.py         # Worker tests
    └── test_worker_engine.py  # Worker engine reload tests
```

### Workspace Exclusions

- `data/`: local runtime data.
- `__pycache__/`: Python bytecode cache.
- `.pytest_cache/`: pytest cache.
- `.mypy_cache/`: mypy cache.
- `.ruff_cache/`: ruff cache.

## Backend Architecture Contracts

> Backend boundary contract. Directory tree: file-level map. This section: layer ownership, persistence, runtime boundaries, API contracts.

### Layer Ownership

- API route layer: FastAPI adapters for query/path/body parsing, dependency injection, `response_model`, error mapping.
- File application layer: `nola/application/files`; upload, list, integrity, cleanup, single delete, batch delete orchestration.
- Task application layer: `nola/application/tasks`; creation, cancellation, retry, deletion, payloads, runtime snapshots, exports.
- Live REST application layer: `nola/application/live`; lifecycle, payload validation, pagination, export, delete orchestration.
- Live realtime runtime layer: `nola/application/live/realtime`; WebSocket state, PCM validation, diagnostics, Mock transcript orchestration, WhisperStreaming runtime.
- Model application layer: `nola/application/models`; list, detail, settings, download, cancellation, deletion, selection orchestration.
- Model hub layer: `nola/model_hub`; registry, cache inspection, storage cleanup, Hugging Face download wrappers, downloader IPC.
- Offline engine runtime: `nola/engines`; `FasterWhisperEngine` and neutral faster-whisper lifecycle helpers.
- Live WhisperStreaming runtime: `nola/application/live/realtime/whisper_streaming`; Live-specific ownership. Placement in `nola/engines` or `nola/services` unsupported.
- Worker runtime: `nola/services/worker.py`, `nola/services/worker_engine.py`; queued task execution and task-boundary engine reload.
- Shared helper layer: `nola/common` for cross-domain helpers; `nola/utils` for generic utilities.

### API Namespaces and Adapters

- Task runtime namespace: `/api/transcription-tasks/*`.
- Unsupported task runtime aliases: `/api/transcriptions/*`.
- Live namespace: `/api/live/*`; Live REST and WebSocket APIs.
- Unsupported Live lifecycle aliases: `/api/transcription-tasks/*`.
- Workbench defaults endpoint: `/api/config/session-defaults`.
- Unsupported parallel engine write path: `/api/config/engine`.
- Execution option metadata source: `/api/config.engine.schema`; `device` and `compute_type` options.
- Task detail/create response snapshots: persisted `request_overrides`, persisted `runtime_config`.
- Task list response state: summary-only.
- Live create/detail/finish response snapshots: `request_overrides`, `runtime_config`.
- Live list response state: summary-only.
- Route error payloads: mapped HTTP responses; raw Python exception text unsupported in clients.
- Live WebSocket endpoint: `/api/live/sessions/{session_id}/stream`.
- Live WebSocket frames: JSON text frames for control/events; binary frames for PCM payloads.

### Persistence and Snapshot Contracts

- Task runtime snapshots: complete resolved transcription `runtime_config` on new tasks; worker execution source.
- Task default recomputation: unsupported for rows with task runtime snapshots.
- Task request override snapshots: accepted request values only.
- Unsupported Task request override sources: `runtime_config`, task `options`, current defaults.
- Legacy task fallback: rows with no `runtime_config` only.
- Malformed task snapshots: non-retryable task data failure.
- Task execution config columns: resolved `model_id`, `engine_device`, `engine_compute_type` on new tasks.
- Queued task immutability: later default changes outside already queued task snapshots.
- Live runtime snapshots: resolved Live realtime `runtime_config` on session creation; WebSocket construction source.
- Live request override snapshots: accepted request values only.
- Unsupported Live request override sources: `runtime_config`, session overrides, current defaults.
- Active Live session without snapshot: structured runtime config error; no rebuild from current defaults.
- Live storage: independent `live_*` tables; no Live data in `transcription_tasks`.
- Live timestamps: timezone-aware UTC ISO strings.
- Live segment `track_id`: optional; same-session ownership requirement when present.
- SQLite integrity: Live foreign keys enabled; bounded segment reads.

### Transcription Task Contracts

- Defaults precedence: `engine defaults < persisted app defaults < task overrides`.
- Execution precedence: request values, then Session defaults, then settings fallbacks.
- Request validation failures: unknown top-level options and unknown `vad_parameters` keys with `422`.
- Device and compute type validation: task and Session default boundary checks; stale read-path override fallback allowed.
- Engine initialization fields: `model_id`, `device`, `compute_type`; outside `TranscribeOptions` and task `options` JSON.
- Engine default test source: `EngineConfig` and settings; hardcoded `small`, `default`, or device defaults unsupported.
- API numeric guards: boundary validation.
- UI schema ranges: UI constraint source; subset of API acceptance.
- Exact API/UI numeric-range equality: unsupported requirement.
- Infinity API representation: `"inf"`; deserialization before engine invocation.
- Failure categories: configuration validation failures separate from runtime engine load failures.
- Runtime engine construction failure before transcription start: retryable category.
- Worker reload timing: task boundaries only.
- Engine replacement sequence: current transcription engine closed before new fingerprint load.
- Worker runtime state fields: `worker.last_loaded_*`; last loaded state, not desired defaults.
- `restart_required`: compatibility field; `false` under task-boundary reload.
- Progress callback meaning: segment output coverage estimate; not faster-whisper internal progress.
- Windows CUDA cleanup setting: `CT2_CUDA_ALLOCATOR=cub_caching` default in `nola/__init__.py` until CTranslate2 CUDA cleanup stability.

### Live Realtime Contracts

- Runtime mode source: `NOLA_LIVE_REALTIME_TRANSCRIBER`; supported values `mock`, `whisper_streaming`.
- Unsupported runtime modes: `runtime_config_invalid`.
- Mock mode state: independent from persisted Live realtime defaults; explicit per-session runtime overrides rejected.
- Live realtime defaults prefix: `live_realtime.`.
- Unsupported Live defaults sources: Workbench Session defaults, transcription task defaults.
- Live realtime override precedence: `built-in defaults < persisted Live realtime defaults < per-session runtime_overrides`.
- Static prompt controls: absent from Live realtime schemas and runtime overrides.
- Faster-whisper `initial_prompt`: internal dynamic WhisperStreaming context only.
- Non-configurable frontend override fields: `word_timestamps`, audio contract fields, model paths, cache roots, arbitrary Hugging Face ids, `local_files_only`.
- Blank Live realtime language: `None` before inference.
- Audio input contract: PCM16LE, 16 kHz, mono.
- Unsupported default audio processing: denoise, gain normalization, compression, EQ, trimming.
- Protocol state: versioned structured events.
- Transcript event names: `transcript.preview`, `transcript.committed_partial`, `transcript.final`.
- Persisted transcript history: final Live segments only.
- WebSocket-only transcript feedback: preview and committed partials.
- Diagnostics controls: explicit `diagnostics.wav.start` and `diagnostics.wav.stop`; default-off.
- Diagnostics storage: backend-controlled directory outside repository or test temporary directory; collision-resistant unique suffix.
- Diagnostics event metadata: `capture_id`, `manifest_name`, `file_name`.
- Unsupported diagnostics event fields: `output_dir`, `manifest_path`, WAV paths, server absolute paths.
- Diagnostics write/limit failure: `diagnostics.wav.stopped`; realtime session continuation.
- Session finish track state: open tracks closed; no finished-session tracks with `ended_at = NULL`.
- WhisperStreaming track state: processor state, hypothesis buffers, audio buffers, silence state, boundary confirmation all track-scoped.
- Silent inference skip condition: no speech and no pending transcript.
- Model ownership: one connection-local transcriber instance.
- Unsupported model ownership: process-wide model pool without explicit ref-count and release design.
- Model loading sources: model registry, configured model id, configured model directory, cache inspection.
- Unsupported WebSocket path behavior: model auto-download.
- Live WhisperStreaming device and compute-type defaults: settings-backed `EngineConfig` values; no Workbench Session default reuse.
- Transcriber factory construction: threadpool boundary for WhisperStreaming model loading.
- Processor release: flushed processors closed on track removal or all-track flush; idempotent adapter `release()`.
- Connection registry scope: single API worker process coordination only.
- Multi-worker Live WebSockets: distributed coordination requirement.
- Realtime release: idempotent route cleanup target.
- Backend device enumeration APIs: unsupported for browser or desktop user devices.
- Device inventory owner: client runtime adapters.

### File, Export, and Model Contracts

- File deletion conflict: `409` when transcription tasks reference the file.
- File disappearing during delete: `404`; no unlink success response.
- Post-database filesystem cleanup: best-effort unlink; no API failure after deleted row.
- Upload validation source: resolved content type after filename inference.
- Partial upload cleanup cases: stream read, write, size-limit, cancellation failures.
- Upload stream close failure: suppressed outcome replacement.
- Blocking upload work: thread offload for file writes and metadata writes.
- File and task search helpers: shared SQLite contains-search helpers.
- Model registry search: in-memory inside `application/models` until another in-memory search domain exists.
- Model operation lock scope: canonical model id; download start and cache deletion.
- Download conflict responses: `409` for duplicate active downloads and already-cached models.
- OpenAPI download conflict metadata: both conflict cases.
- Hugging Face revision cache state: tracked revisions as downloaded state.
- Partial cache cleanup: metadata-only repo cache directories without revisions.
- Full cache incomplete-file scan after tracked revisions: unsupported.
- Model descriptions: `description_key`; frontend localization with backend `description` fallback.
- Export defaults precedence: `built-in export defaults < persisted export defaults < request overrides`.
- Export filename helpers: shared Task and Live helpers; path segment stripping; endpoint-selected extension.
- Export write-path mapped failures: `OSError`, `UnicodeError`.
- Export catch-all write failure mapping: unsupported.
- Batch export error archive: sanitized `_errors.txt`; no raw exception text.
- Batch task export all-fail status: `400` only when every selected task has task-level failures such as `no_segments`.

## Database Contracts

> **SQLite and persistence invariants**
>
> - Connection lifetime: explicit SQLite connection close.
> - Write transactions: preserved transaction semantics.
> - Queue atomic updates: `UPDATE ... WHERE ... RETURNING`.
> - Timeout/dead-task requeue: `retry_count` increment.
> - SQLite minimum version: `3.35.0`.
> - Live foreign keys: enabled.
> - Live segment integrity: segment `track_id` within the same `session_id`.
> - Segment reads: bounded pagination.
> - Runtime snapshots: JSON snapshots for Live sessions and transcription tasks.
> - Legacy runtime snapshots: `NULL`, no fabricated current-default history.
> - Request override snapshots: accepted user override JSON only.
> - Missing request override snapshots: `NULL`, no derivation from runtime snapshots.

---

## Dependencies

| Package | Version |
|---------|---------|
| fastapi | 0.128.0 |
| uvicorn | 0.40.0 |
| faster-whisper | 1.2.1 |
| pydantic-settings | 2.12.0 |
| typing-extensions | 4.15.0 |
| Python | ^3.10 |

### Dev Dependencies

| Package | Version |
|---------|---------|
| ruff | 0.14.11 |
| mypy | 1.19.1 |
| pre-commit | 4.5.1 |
| pytest | 9.0.2 |

---

## Module Extension Notes

Directory tree: file-level location map. This section: module boundaries, data flow, runtime state, and cross-layer relationships.

### nola/models

- Layer: SQLite persistence.
- Main facade: `TaskDatabase` over split `taskdb` repositories.
- Task queue: queue transitions, worker coordination, heartbeat, timeout/dead-worker recovery.
- Task store: list, detail, count, cancel, terminal-record delete persistence.
- Task JSON fields: `segments`, `options`, `runtime_config`, `request_overrides`; decoded shape validation before row casting.
- Live repository: sessions, tracks, segments, list filters, terminal deletes, paginated final-segment reads.
- Live JSON fields: invalid runtime/request snapshots nulled with warnings.
- Config persistence: `AppConfigDatabase` under `app_config`.
- File persistence: uploaded file metadata and integrity state.
- Shared search: SQLite contains-search helpers.
- SQLite utilities: version checks and connection helpers.

### nola/common and nola/utils

- `nola/common/merge.py`: recursive defaults merge behavior.
- `nola/common/types.py`: recursive JSON-compatible aliases.
- `nola/common/event_bus.py`: process-wide model-download SSE event bus.
- `nola/utils/mime.py`: MIME inference from filename extension.

### nola/model_hub

- Layer: model registry, local cache state, download runtime.
- Registry: curated model metadata, canonical ids, aliases, description keys.
- Storage: cache root resolution, Hugging Face cache inspection, full/partial cache deletion.
- Revision-backed repositories: downloaded state through tracked revisions.
- Partial artifact cleanup: metadata-only cache directories without revisions.
- Downloader: subprocess-backed downloads, byte progress, speed snapshots, IPC messages.
- Domain errors: API mapping and worker startup guards.

### nola/engines

- Layer: offline transcription engine contracts and neutral faster-whisper helpers.
- `EngineConfig`: model size, model directory, device, compute type.
- `TranscribeOptions`: transcription options only; engine initialization fields outside this object.
- `FasterWhisperEngine`: faster-whisper implementation, segment output coverage progress, explicit close behavior.
- Faster-whisper defaults: installed package default and VAD key introspection.
- Faster-whisper runtime helpers: shared model creation and close lifecycle for offline and Live backend runtimes.
- Windows CTranslate2 compatibility: `CT2_CUDA_ALLOCATOR=cub_caching` default in `nola/__init__.py`.

### nola/api

- Layer: HTTP/WebSocket adapter surface.
- `deps.py`: database singletons, model storage/downloader, event bus, Live diagnostics path, Live stream registry, Live transcriber factory.
- Config routes: aggregated config, transcription defaults, Session defaults, Live realtime defaults/schema, export defaults.
- File routes: upload, list, detail, integrity, cleanup, single delete, batch delete adapters.
- Task routes: canonical `/api/transcription-tasks` composition through read/actions/export modules.
- Live routes: REST session lifecycle, export/delete, WebSocket stream adapter.
- Model routes: registry list/detail, settings, downloads, cancel/delete/select, SSE events.
- Schemas: Pydantic request/response models and Live WebSocket protocol models.
- Error mapping: workflow errors to HTTP responses; raw Python exception text outside client payloads.

### nola/application

- Layer: framework-independent orchestration.
- Files area: upload validation/storage, list/detail, integrity, cleanup, single delete, batch delete.
- Tasks area: execution config resolution, runtime snapshot creation, request override snapshots, create/cancel/retry/delete/list/detail/export.
- Live area: runtime config resolution, create/list/detail/finish/fail/delete/export, paginated segment payloads.
- Models area: registry queries, settings, active downloads, start/cancel download, cache delete, configured model selection.
- Payloads: TypedDict contracts and framework-neutral response builders.
- Contracts: protocols for repositories, file stores, model storage/downloader, config stores, operation locks.
- Batch actions: item-level results and per-item failure preservation.

### nola/application/live/realtime

- Runtime scope: per-WebSocket Live realtime session.
- Protocol: versioned JSON control/events plus binary PCM payloads.
- Audio contract: PCM16LE, 16 kHz, mono; float32 waveform conversion for inference.
- Transcript classes: preview, committed partial, final.
- Persistence boundary: final transcript segments only.
- Diagnostics: explicit WAV capture and opaque artifact metadata.
- Connection coordination: single-process Live stream registry.
- Mock transcriber: deterministic committed/final output for tests and mock mode.
- WhisperStreaming adapter: track-scoped processors and connection-local model ownership.
- WhisperStreaming backend: faster-whisper inference over accumulated waveform chunks.
- WhisperStreaming processor: LocalAgreement state, trimming, silence handling, context reset.
- Loader boundary: configured model id, model directory, cache state, Live backend construction.

### nola/services

- Worker process: independent transcription task consumer.
- Engine load timing: before each claimed task.
- Reload boundary: task boundary.
- Runtime fingerprint: model id, model directory, device, compute type.
- Engine reuse state: matching runtime fingerprint.
- Snapshot preference: stored task `runtime_config`.
- Legacy fallback scope: tasks without runtime snapshots.
- Failure scope: current task for engine resolution, cache validation, release, or load failures.
- Formatter registry: SRT, VTT, TXT, ASS subtitle formatters.

### nola/main.py

- Role: FastAPI entry point and lifespan management.
- Root endpoints: `/`, `/health`.
- Config endpoints: app config, transcription defaults, Session defaults, Live realtime defaults/schema, export defaults.
- File endpoints: upload, list, detail, integrity, cleanup, single delete, batch delete.
- Model endpoints: list, detail, settings, active downloads, SSE events, download/cancel/delete/select.
- Live endpoints: sessions list/create/detail/finish/export/delete, batch export/delete, WebSocket stream.
- Task endpoints: create/list/detail/cancel, batch cancel/retry/delete-records, single export, batch export.

### nola/config

- Layer: settings, defaults, schema metadata, patch semantics.
- Settings: data paths, export paths, limits, model defaults, Live realtime transcriber mode, host/port.
- Constants: MIME and extension allowlists, language set, batch limits.
- Common config helpers: recursive patch semantics and config value aliases.
- Transcription config: option contracts, schema registry, effective defaults, effective language list.
- Session config: Workbench execution and transcription defaults aggregation; execution option metadata.
- Live realtime config: built-in/effective defaults, adapter metadata, schema groups, `live_realtime.` prefix.
- Export config: export formats, defaults, safe filenames, UTF-8 Content-Disposition, saved export paths.

## Dev Commands

```bash
# Dependencies
poetry install

# Dev server
poetry run uvicorn nola.main:app --reload

# Lint
poetry run ruff check nola tests

# Format check
poetry run ruff format --check nola tests

# Type check
poetry run mypy nola

# Tests
poetry run pytest tests -v --tb=short

# Lint fixes
poetry run ruff check nola tests --fix

# Formatting
poetry run ruff format nola tests

# Worker process
poetry run python -m nola.services.worker
```

> Repository-root command shape: `poetry -C core run ...`.

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
Client ──▶ FastAPI routes ──▶ application workflows ──▶ SQLite DB ◀── Worker Process
                                   │                          │              │
                                   │                          │       FasterWhisperEngine
                                   │                          ▼
                                   │                     data/nola.db
                                   │                     data/uploads/
                                   ▼
                              API schemas
                                   │
                                   ▼
                         Live realtime runtime
                                   │
                                   ▼
                        WhisperStreaming backend
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
| `/api/config/live-realtime/defaults` | GET | - | `LiveRealtimeDefaultsResponse` |
| `/api/config/live-realtime/defaults` | PATCH | `LiveRealtimeDefaultsUpdateRequest` | `LiveRealtimeDefaultsPatchResponse` |
| `/api/config/live-realtime/defaults` | DELETE | - | `204 No Content` |
| `/api/config/live-realtime/schema` | GET | - | `LiveRealtimeSchemaResponse` |
| `/api/config/session-defaults` | GET | - | `SessionDefaultsResponse` |
| `/api/config/session-defaults` | PATCH | `SessionDefaultsUpdateRequest` | `SessionDefaultsResponse` |
| `/api/config/export` | GET | - | `ExportConfigResponse` |
| `/api/config/export/defaults` | PATCH | `ExportDefaultsUpdateRequest` | `ExportDefaultsPatchResponse` |
| `/api/config/export/defaults` | DELETE | - | `204 No Content` |

### Files API

| Endpoint | Method | Body/Query | Response Model |
|----------|--------|------------|----------------|
| `/api/files/` | POST | `file: UploadFile` | `FileUploadResponse` |
| `/api/files/` | GET | `?q=&content_type=&sort_by=&order=&limit=&offset=` | `FileListResponse` |
| `/api/files/batch/delete` | POST | `BatchFileDeleteRequest` | `BatchFileDeleteResponse` |
| `/api/files/{file_id}` | GET | - | `FileResponse` |
| `/api/files/{file_id}` | DELETE | - | `DeleteResponse` |
| `/api/files/check-integrity` | GET | - | `IntegrityCheckResponse` |
| `/api/files/cleanup` | POST | - | `CleanupResponse` |

File deletion contract:
- Transcription task references: HTTP `409`.
- Row disappearance before delete completion: HTTP `404`.
- Post-database unlink failure: best-effort filesystem cleanup.

### Models API

| Endpoint | Method | Body/Query | Response Model |
|----------|--------|------------|----------------|
| `/api/models` | GET | `?q=&status=&sort_by=&order=` | `ModelListResponse` |
| `/api/models/downloads` | GET | - | `ActiveModelDownloadsResponse` |
| `/api/models/settings` | GET | - | `ModelSettingsResponse` |
| `/api/models/settings` | PATCH | `ModelSettingsUpdateRequest` | `ModelSettingsResponse` |
| `/api/models/events` | GET | SSE | model-download event stream |
| `/api/models/{model_id}` | GET | - | `ModelDetailResponse` |
| `/api/models/{model_id}/download` | POST | - | `ModelDownloadStartedResponse` or `409` |
| `/api/models/{model_id}/cancel` | POST | - | `ModelCancelResponse` |
| `/api/models/{model_id}` | DELETE | - | `ModelDeleteResponse` |
| `/api/models/{model_id}/select` | POST | - | `ModelSelectResponse` |

Model download contract:
- Duplicate active download: HTTP `409`.
- Already-cached model: HTTP `409`.
- OpenAPI metadata: both conflict cases.
- Mutation lock scope: shared per-model operation lock with cache deletion.

### Live API

| Endpoint | Method | Body/Query | Response Model |
|----------|--------|------------|----------------|
| `/api/live/sessions` | POST | `CreateLiveSessionRequest` | `LiveSessionDetailResponse` |
| `/api/live/sessions` | GET | `?q=&status=&sort_by=&order=&limit=&offset=` | `LiveSessionListResponse` |
| `/api/live/sessions/{session_id}` | GET | `?segment_limit=&segment_offset=` | `LiveSessionDetailResponse` |
| `/api/live/sessions/{session_id}/export` | GET | `?format=&include_timestamps=&filename=&save=` | Binary or `SavedExportResponse` |
| `/api/live/sessions/export/batch` | POST | `LiveSessionBatchExportRequest` | ZIP binary |
| `/api/live/sessions/{session_id}/finish` | POST | `?segment_limit=&segment_offset=` | `LiveSessionDetailResponse` |
| `/api/live/sessions/{session_id}/record` | DELETE | - | `DeleteLiveSessionRecordResponse` |
| `/api/live/sessions/batch/delete-records` | POST | `BatchLiveSessionActionRequest` | `BatchLiveSessionActionResponse` |
| `/api/live/sessions/{session_id}/stream` | WebSocket | JSON control/events + binary PCM payloads | Live realtime protocol events |

Live REST contract:
- Storage: independent from transcription tasks.
- Runtime override resolution: session creation.
- Persisted snapshots: `request_overrides`, `runtime_config`.
- Snapshot response scope: create, detail, finish.
- List response scope: summary-only.
- Segment response scope: paged detail/finish segments.
- Export scope: finished sessions with final segments.
- Delete scope: terminal sessions.
- Repeated finish: idempotent terminal snapshot.

Live realtime contract:
- Handshake: `client.hello` before runtime events.
- Track creation event: `track.start`.
- Audio frame shape: JSON metadata followed by binary PCM16LE payload.
- Transcript events: `transcript.preview`, `transcript.committed_partial`, `transcript.final`.
- Persisted transcript scope: final transcripts only.
- Invalid frame result: `invalid_event` for malformed JSON and non-text JSON frames.
- Diagnostics artifacts: opaque metadata, not absolute paths.

### Transcription Tasks API

| Endpoint | Method | Body/Query | Response Model |
|----------|--------|------------|----------------|
| `/api/transcription-tasks/` | POST | `TranscriptionRequest` | `CreateTaskResponse` |
| `/api/transcription-tasks/` | GET | `?status=&q=&sort_by=&order=&limit=&offset=` | `TaskListResponse` |
| `/api/transcription-tasks/{task_id}` | GET | - | `TaskDetailResponse` |
| `/api/transcription-tasks/{task_id}` | DELETE | - | `CancelTaskResponse` |
| `/api/transcription-tasks/batch/cancel` | POST | `BatchTaskActionRequest` | `BatchTaskActionResponse` |
| `/api/transcription-tasks/batch/retry` | POST | `BatchTaskActionRequest` | `BatchTaskActionResponse` |
| `/api/transcription-tasks/batch/delete-records` | POST | `BatchTaskActionRequest` | `BatchTaskActionResponse` |
| `/api/transcription-tasks/{task_id}/record` | DELETE | - | `DeleteTaskRecordResponse` |
| `/api/transcription-tasks/{task_id}/export` | GET | `?format=&include_timestamps=&filename=&save=` | Binary or `SavedExportResponse` |
| `/api/transcription-tasks/export/batch` | POST | `BatchExportRequest` | ZIP binary |

Task response contract:
- Detail/create snapshots: persisted `request_overrides`, persisted `runtime_config`.
- Missing overrides or snapshots: `null`.
- List response scope: summary-only.

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
