# AI Instructions - Nola Frontend

> This file helps AI quickly understand the frontend project structure.

## Project Overview

| Key   | Value                                                                       |
| ----- | --------------------------------------------------------------------------- |
| Name  | Nola - Frontend Workspace                                                   |
| Stack | React 19 + TypeScript + Vite + TailwindCSS v4 + shadcn/ui + i18next + Axios |

## Code Style

> [!IMPORTANT]
> **Code & Comments must be:**
>
> - In English
> - Brief and objective
> - Imperative mood for function docs (e.g., "Return the config" not "Returns the config")
> - Prettier formatting strictly followed (No semicolons, single quotes, 2-space indent)

---

## Directory Structure (Feature-First)

```text
app/                          # Frontend workspace root
├── .prettierrc               # Prettier config (no semicolons, single quotes)
├── components.json           # shadcn/ui component registry config
├── eslint.config.js          # ESLint flat config
├── index.html                # Vite entry HTML
├── package.json              # pnpm configuration
├── pnpm-lock.yaml            # pnpm lockfile
├── README.md                 # Frontend docs
├── public/                   # Public static assets
│   └── vite.svg              # Vite logo asset
├── tsconfig.json             # TypeScript 5.9 project references
├── tsconfig.app.json         # App-level TS config (src/)
├── tsconfig.node.json        # Node-level TS config (vite.config.ts)
├── vite.config.ts            # Vite 7 + proxy to backend + Vitest config (default node env)
├── src/                      # Frontend source code
│   ├── App.css               # App-level styles
│   ├── App.tsx               # Root shell wiring upload + transcription features
│   ├── index.css             # Tailwind v4 entry + shadcn variables
│   ├── main.tsx              # React mounting + temporary App shell entry
│   ├── router.tsx            # TanStack Router tree and validation wiring
│   ├── test/                 # Shared Vitest setup
│   │   └── setup.ts          # jest-dom + ResizeObserver polyfill + test log silencing
│   │
│   ├── assets/               # Static assets
│   │   └── react.svg         # Example asset
│   │
│   ├── config/               # Centralized configuration
│   │   ├── api.ts            # Config API (fetch + defaults update/reset)
│   │   ├── __tests__/        # Config store tests
│   │   │   └── use-app-config.test.ts # Shared config cache/store tests
│   │   ├── constants.ts      # App constants (synced with backend)
│   │   ├── env.ts            # Typed environment variables (import.meta.env)
│   │   ├── logger.ts         # Lightweight logger ([Nola] prefix, test-aware mute)
│   │   ├── test-env.ts       # Shared test-runtime flags and log opt-in env
│   │   └── use-app-config.ts # Shared config store + refresh API
│   │
│   ├── i18n/                 # i18next bootstrap + locale resources
│   │   ├── index.ts          # i18n initialization (react-i18next)
│   │   └── locales/          # Locale dictionaries
│   │       ├── en.json       # English translations
│   │       └── zh.json       # Chinese translations
│   │
│   ├── components/           # Shared UI components (mostly shadcn generated)
│   │   ├── common/           # Cross-feature common components barrel
│   │   │   ├── __tests__/
│   │   │   │   ├── ErrorBoundary.test.tsx # Fallback and retry tests
│   │   │   │   └── TaskListPanel.test.tsx # Task list panel behavior tests
│   │   │   ├── ErrorBoundary.tsx # Render-error catch + i18n fallback + retry
│   │   │   ├── ListToolbar.tsx # Shared search/filter/sort toolbar
│   │   │   ├── TaskListPanel.tsx # Shared task list panel with actions
│   │   │   ├── types.ts      # Shared common-component callback contracts
│   │   │   └── index.ts      # Common export entry (feature-agnostic)
│   │   └── ui/               # Radix + Tailwind primitives
│   │       ├── button.tsx    # Button variants
│   │       ├── card.tsx      # Card container primitives
│   │       ├── collapsible.tsx # Collapsible primitives
│   │       ├── dialog.tsx    # Dialog primitives
│   │       ├── input.tsx     # Input primitive
│   │       ├── label.tsx     # Label primitive
│   │       ├── progress.tsx  # Progress bar primitive
│   │       ├── select.tsx    # Select primitive
│   │       ├── separator.tsx # Separator primitive
│   │       ├── slider.tsx    # Slider primitive
│   │       ├── sonner.tsx    # Toast host wrapper
│   │       ├── switch.tsx    # Switch primitive
│   │       ├── textarea.tsx  # Textarea primitive
│   │       └── tooltip.tsx   # Tooltip primitive
│   │
│   ├── features/             # Business modules (Domain logic)
│   │   ├── export/           # Subtitle export & download
│   │   │   ├── api.ts        # downloadExport, saveExport, batchExport, defaults APIs
│   │   │   ├── components/   # Export dialog UI
│   │   │   │   ├── ExportDialog.tsx # Shared export option dialog
│   │   │   │   └── __tests__/
│   │   │   │       └── ExportDialog.test.tsx # Export dialog behavior tests
│   │   │   ├── hooks/        # Export defaults state hooks
│   │   │   │   ├── useExportDefaults.ts # Export defaults load/update/reset hook
│   │   │   │   └── __tests__/
│   │   │   │       └── useExportDefaults.test.ts # Export defaults hook tests
│   │   │   ├── lib/          # Export-private helpers
│   │   │   │   ├── filename.ts # Single export fallback filename builder
│   │   │   │   └── __tests__/
│   │   │   │       └── filename.test.ts # Filename helper tests
│   │   │   └── index.ts      # Feature public exports
│   │   ├── history/          # Historical task pagination & actions
│   │   │   ├── api.ts        # listHistoryTasks, batch cancel/retry
│   │   │   ├── components/   # History feature UI components
│   │   │   │   ├── TaskHistoryPanel.tsx # History list with batch actions/export
│   │   │   │   └── __tests__/
│   │   │   │       └── TaskHistoryPanel.test.tsx # History panel behavior tests
│   │   │   ├── hooks/        # History data/action hooks
│   │   │   │   ├── useHistoryTasks.ts # Backend-paged history query hook
│   │   │   │   ├── useHistoryTaskActions.ts # Batch action/export orchestration
│   │   │   │   └── __tests__/
│   │   │   │       ├── useHistoryTasks.test.ts # History query hook tests
│   │   │   │       └── useHistoryTaskActions.test.ts # History action hook tests
│   │   │   └── index.ts      # Feature public exports
│   │   ├── realtime/         # WebSocket streaming
│   │   │   └── index.ts      # Placeholder
│   │   ├── transcription/    # Task CRUD, options, polling, status tracking
│   │   │   ├── __tests__/    # Feature-level tests
│   │   │   │   ├── actions.test.ts # Action wrapper behavior tests
│   │   │   │   └── build-request.test.ts # buildRequest payload tests
│   │   │   ├── actions.ts    # Action wrappers for cancel/retry/delete behaviors
│   │   │   ├── api.ts        # createTask, listTasks, getTask, cancelTask, deleteTaskRecord
│   │   │   ├── components/   # Transcription feature UI components
│   │   │   │   ├── AdvancedOptions.tsx # Collapsible advanced settings panel
│   │   │   │   ├── CurrentBatchTasksPanel.tsx # Session task list panel
│   │   │   │   ├── OptionsBar.tsx     # Language/task selectors + start button
│   │   │   │   └── __tests__/         # Component tests
│   │   │   │       ├── AdvancedOptions.test.tsx # Advanced options UI behavior tests
│   │   │   │       └── OptionsBar.test.tsx # Options bar task-creation tests
│   │   │   ├── hooks/        # Transcription state hooks
│   │   │   │   ├── useRecentTaskQuery.ts # Recent tasks query/filter/sort hook
│   │   │   │   ├── useTaskPolling.ts # Foreground/background polling hook
│   │   │   │   ├── useTranscriptionOptions.ts # Options state + buildRequest
│   │   │   │   └── __tests__/
│   │   │   │       ├── useRecentTaskQuery.test.ts # Recent query hook tests
│   │   │   │       ├── useTaskPolling.test.ts # Polling hook tests
│   │   │   │       └── useTranscriptionOptions.test.ts # Hook behavior tests
│   │   │   ├── lib/          # Transcription-private pure helpers
│   │   │   │   ├── defaults-patch.ts # Build defaults patch payloads
│   │   │   │   ├── object-path.ts # Dot-path read/write helpers
│   │   │   │   ├── schema-adapter.ts # Map schema to top-level UI model
│   │   │   │   ├── task-refresh.ts # In-memory task refresh broadcaster
│   │   │   │   ├── task-selectors.ts # Recent/active task selectors
│   │   │   │   ├── task-status-groups.ts # Shared active/terminal status groups
│   │   │   │   ├── temperature.ts # Temperature list parse/validate
│   │   │   │   └── __tests__/
│   │   │   │       ├── defaults-patch.test.ts # Defaults patch helper tests
│   │   │   │       ├── schema-adapter.test.ts # Schema adapter behavior tests
│   │   │   │       ├── task-refresh.test.ts # Task refresh broadcaster tests
│   │   │   │       ├── task-selectors.test.ts # Task selector tests
│   │   │   │       └── temperature.test.ts # Temperature validation tests
│   │   │   ├── store/        # Transcription stores
│   │   │   │   ├── session-tasks-store.ts # Session-scoped task store
│   │   │   │   ├── task-board-store.ts # Polled task-board store
│   │   │   │   └── __tests__/
│   │   │   │       ├── session-tasks-store.test.ts # Session store tests
│   │   │   │       └── task-board-store.test.ts # Task-board store tests
│   │   │   ├── types.ts      # Transcription domain types + option field definitions
│   │   │   └── index.ts      # Feature barrel exports
│   │   └── upload/           # File upload with progress
│   │       ├── api.ts        # uploadFile, listFiles, getFile, deleteFile
│   │       ├── components/   # Upload feature UI components
│   │       │   ├── FileUploader.tsx # Drag/drop + click file picker
│   │       │   ├── UploadList.tsx # Upload item list wrapper
│   │       │   ├── UploadProgress.tsx # Single upload row UI
│   │       │   └── __tests__/      # Component tests
│   │       │       ├── FileUploader.test.tsx # Dropzone input behavior tests
│   │       │       └── UploadProgress.test.tsx # Upload row status UI tests
│   │       ├── hooks/        # Upload orchestration hooks
│   │       │   ├── useFileUpload.ts # Multi-file upload orchestration hook
│   │       │   └── __tests__/ # Hook unit tests
│   │       │       └── useFileUpload.test.ts # Queue/cancel/retry/reset coverage
│   │       ├── lib/          # Upload-private pure helpers
│   │       │   ├── admission.ts # File dedup + validation admission gate
│   │       │   ├── error.ts  # Upload cancel/error classification
│   │       │   ├── state.ts  # Upload list pure state helpers/selectors
│   │       │   ├── timeout.ts # Upload timeout policy
│   │       │   └── __tests__/ # Pure helper tests
│   │       │       ├── admission.test.ts # Dedup and batch admission tests
│   │       │       ├── state.test.ts # Upload state selector/update tests
│   │       │       └── timeout.test.ts # Timeout policy tests
│   │       ├── types.ts      # Upload domain types (UploadItem, hook contract)
│   │       └── index.ts      # Feature barrel exports (components, hook, types)
│   │
│   ├── lib/                  # Autogenerated by shadcn (cn utility)
│   │   └── utils.ts          # Canonical `cn()` helper
│   │
│   ├── shared/               # Cross-feature shared code
│   │   ├── lib/              # Shared runtime helpers
│   │   │   ├── api-client.ts       # Axios instance + structured error interceptors
│   │   │   ├── error-factory.ts    # AppError factory helpers (408/429 retriable)
│   │   │   ├── error-utils.ts      # API error normalization helpers
│   │   │   ├── file-validation.ts  # Pure file validation (ext/MIME/size)
│   │   │   ├── format.ts           # formatFileSize() human-readable sizes
│   │   │   ├── utils.ts            # downloadBlob helper
│   │   │   └── __tests__/          # Unit tests (Vitest)
│   │   │       ├── api-client.test.ts # Interceptor error mapping tests
│   │   │       ├── error-factory.test.ts # AppError factory contract tests
│   │   │       ├── error-utils.test.ts # API error formatting tests
│   │   │       ├── file-validation.test.ts # validateFile unit tests
│   │   │       └── format.test.ts # formatFileSize unit tests
│   │   └── types/            # Shared type contracts
│   │       ├── openapi.d.ts   # AUTO-GENERATED (pnpm gen:types)
│   │       ├── api-error.ts   # Backend error payload types
│   │       ├── app-error.ts   # Frontend standardized error model
│   │       ├── config.ts      # Config response aliases (schema/defaults)
│   │       ├── file.ts        # FileInfo, FileUploadResponse, etc.
│   │       ├── task.ts        # TaskSummary, TaskStatus, ExportFormat, etc.
│   │       ├── task-query.ts  # Shared task query model contracts
│   │       └── index.ts       # Barrel re-export
│   │
│   └── routes/               # Route composition and URL query contracts
│       ├── .gitkeep          # Directory placeholder
│       ├── AppShell.tsx      # Shared shell route component
│       ├── HistoryPage.tsx   # History route composition component
│       └── history-search.ts # History URL query normalize/build helpers
```

---

## Frontend Architecture Conventions

> [!IMPORTANT]
> **Architecture Rules:**
>
> 1. **Feature Cohesion**: Keep feature logic colocated; add `components/`, `hooks/`, `lib/`, and `store/` only when that feature needs them.
> 2. **Barrel Exports**: Every feature must expose its public methods/components via an `index.ts`. External files should ONLY import from a feature's index.
> 3. **Shared UI**: Any component used by >1 feature should be promoted to `src/components/` (or `src/components/ui/` for shared primitives).
> 4. **Routing**: `routes/` handles URL matching. Components and logic live in `features/`.
> 5. **API Types**: `shared/types/openapi.d.ts` is AUTO-GENERATED from the backend OpenAPI spec (`pnpm gen:types`). Do NOT manually edit it. Hand-maintained aliases/contracts (`config.ts`, `file.ts`, `task.ts`, `api-error.ts`, `app-error.ts`) provide stable, readable types for business code.
> 6. **Lib Layer Boundaries**:
>    - `src/lib/*`: app/platform-level helpers (e.g., shadcn `cn`)
>    - `src/shared/lib/*`: cross-feature reusable runtime helpers
>    - `src/features/*/lib/*`: feature-private helpers; promote to `shared/lib` only when reused by another feature
> 7. **Schema-Driven Controls**: Drive language/task/initial prompt and advanced controls from backend schema via `schema-adapter`; do not reintroduce hardcoded option groups.
> 8. **Defaults Priority**: Apply `engine defaults < persisted defaults < task overrides` when composing request payloads and defaults patches.
> 9. **Defaults Patch Semantics**: Use `undefined` for unchanged fields, use `null` to clear persisted overrides, and send concrete values for explicit overrides.
> 10. **Language Ordering**: Consume `effective_languages` in backend return order; do not assume alphabetical ordering.
> 11. **Vitest Environment Split**: Keep `node` as default test environment. Add `// @vitest-environment jsdom` only for DOM-driven tests.
> 12. **Import Boundaries (ESLint-Enforced)**:
>     - Outside `src/features/*`, import features only from `@/features/<name>`; do not deep import `@/features/<name>/**`.
>     - `src/components/common/*` must not import from `@/features/*`.
>     - Inside `src/features/<name>/*`, do not deep import from other features; import only via feature public entry.
>
> [!IMPORTANT]
> Use `GET /api/config` and `GET /api/config/transcription/engine-defaults` as the only defaults source.
> Do not add new frontend calls to `/api/transcriptions/options/defaults`.
>
> [!NOTE]
> Use `router.tsx` and `src/routes/*` as the active route composition entry.
> Keep `AppShell` mounted to share navigation and task polling across routes.
> Keep page composition in route components (`App.tsx` for `/`, `HistoryPage.tsx` for `/history`).
> Use `next-themes` only through `components/ui/sonner.tsx`; do not assume a theme toggle UI.

### API Type Strategy

Three-layer pipeline from backend schema to UI code:

```text
Backend (Pydantic) ──► openapi.json ──► openapi.d.ts ──► domain aliases/contracts ──► feature api.ts
   (Source)         (gen:types auto)   (generated types)   (typed functions)
```

| Layer                    | Path                                                                           | Maintained by           | Edit?                                                               |
| ------------------------ | ------------------------------------------------------------------------------ | ----------------------- | ------------------------------------------------------------------- |
| Raw types                | `shared/types/openapi.d.ts`                                                    | `pnpm gen:types` (auto) | Never                                                               |
| Domain aliases/contracts | `shared/types/config.ts`, `task.ts`, `file.ts`, `api-error.ts`, `app-error.ts` | Developer               | Rarely (only if backend adds new schemas or error contract changes) |
| Feature API              | `features/*/api.ts`                                                            | Developer               | Frequently                                                          |

**Key rules:**

- `TaskStatus` and `ExportFormat` are **derived from OpenAPI enum**, not hardcoded. This ensures Single Source of Truth — backend adds a new status/format, frontend auto-inherits after `pnpm gen:types`.
- Domain aliases/contracts avoid verbose `components['schemas']['TaskSummaryResponse']` paths in business code.
- Runtime helpers such as `formatApiError` and AppError factories live in `shared/lib/*`, not in `shared/types/*`.
- Feature `api.ts` functions return unwrapped `data` (not `AxiosResponse`), keeping callers free from Axios internals.

**Update flow:** Backend changes schema → run `pnpm gen:types` → `openapi.d.ts` regenerates → domain aliases/contracts usually unchanged → feature API unchanged.

---

## Dependencies

| Package                 | Version       |
| ----------------------- | ------------- |
| React / React DOM       | ^19.2.0       |
| @tanstack/react-router  | ^1.162.8      |
| zustand                 | ^5.0.11       |
| axios                   | ^1.13.5       |
| shadcn/ui (radix-ui)    | latest        |
| next-themes             | ^0.4.6        |
| i18next / react-i18next | ^25.8 / ^16.5 |

### Dev Dependencies

| Package                           | Version          |
| --------------------------------- | ---------------- |
| Vite                              | ^7.3.1           |
| TypeScript                        | ~5.9.3           |
| TailwindCSS                       | ^4.2.1           |
| Prettier / eslint-config-prettier | ^3.8.1 / ^10.1.8 |
| ESLint                            | ^9.39.1          |
| Vitest                            | ^4.0.18          |
| openapi-typescript                | ^7.13.0          |

---

## Detailed Module Overview

### src/features/

Business domain logic separated by feature. Each feature has an `api.ts` (API functions) and `index.ts` (barrel export).

- **upload**:
  - `api.ts`: `uploadFile` (FormData + progress + AbortSignal), `listFiles`, `getFile`, `deleteFile`, `checkIntegrity`.
  - `components/FileUploader.tsx`: Select files via drag/drop or click and pass raw `File[]` upward.
  - `components/UploadProgress.tsx`: Render per-file status/progress/actions.
  - `components/UploadList.tsx`: Map `UploadItem[]` into progress rows.
  - `components/__tests__/FileUploader.test.tsx`: Dropzone tests covering drag-and-drop, keyboard activation, and disabled blocking.
  - `components/__tests__/UploadProgress.test.tsx`: Row rendering tests covering uploading, error, success, and cancelled states.
  - `hooks/useFileUpload.ts`: Upload queue orchestration (validate/add/start/cancel/retry/remove/reset). Expose `batchError` and `clearBatchError` for batch-level admission errors.
  - `hooks/__tests__/useFileUpload.test.ts`: Hook behavior tests (queue, dedup, batchError lifecycle, concurrency, cancel/retry, remove/reset cleanup).
  - `lib/admission.ts`: Pure admission gate — deduplicate files by `name+size+lastModified` fingerprint against existing queue plus incoming batch, validate each file, and return accepted `UploadItem[]` plus optional `batchError`.
  - `lib/__tests__/admission.test.ts`: Admission tests covering per-file validation preservation and duplicate skipping.
  - `lib/timeout.ts`: Per-file timeout strategy.
  - `lib/error.ts`: Axios cancellation classification helper.
  - `lib/state.ts`: Pure list update/select helpers to keep hook orchestration-focused.
  - `lib/__tests__/state.test.ts`: Pure helper tests for patch/remove/select behavior.
  - `lib/__tests__/timeout.test.ts`: Timeout clamp and scaling tests.
  - `types.ts`: Upload domain contracts (`UploadItem`, `UseFileUploadReturn` including `batchError`/`clearBatchError`).
  - `index.ts`: Public barrel exports (`FileUploader`, `UploadProgress`, `UploadList`, `useFileUpload`, `UploadItem`).
- **transcription**:
  - `api.ts`: `createTask` (accept `CreateTaskPayload`, filter undefined), `listTasks` (status/search/sort), `getTask`, `cancelTask`, `deleteTaskRecord`.
  - `actions.ts`: Wrap cancel/retry/delete flows and keep refresh behavior explicit.
  - `components/CurrentBatchTasksPanel.tsx`: Render session-scoped task list with local filtering, sorting, and pagination.
  - `hooks/useRecentTaskQuery.ts`: Normalize recent-task query behavior for toolbar + pagination.
  - `hooks/useTaskPolling.ts`: Poll task board with visibility-aware interval and refresh broadcasts.
  - `lib/task-refresh.ts`: Broadcast task refresh events without hook coupling.
  - `lib/task-selectors.ts`, `lib/task-status-groups.ts`: Keep selector logic and status groups centralized.
  - `store/session-tasks-store.ts`, `store/task-board-store.ts`: Keep task session state and polled board state isolated.
  - `components/OptionsBar.tsx`: Render schema-adapted language/task selectors, initial prompt textarea, defaults save/reset actions, and "Start Transcription" button. Validate selected task values against schema-derived options before state update.
  - `components/AdvancedOptions.tsx`: Render schema-driven advanced groups and keep top-level controls (`language`/`task`/`initial_prompt`) out of the advanced panel.
  - `components/__tests__/OptionsBar.test.tsx`: Component tests covering disabled state, initial prompt edits, task creation results, and fallback error mapping.
  - `components/__tests__/AdvancedOptions.test.tsx`: Component tests covering slider default display, temperature commit, and reset behavior.
  - `hooks/useTranscriptionOptions.ts`: Manage language, task, initialPrompt, and advancedOptions state from shared config defaults. Expose `buildRequest(fileId)` to compose `CreateTaskPayload`. Enforce mutual exclusion between `word_timestamps` and `without_timestamps`. Keep persisted defaults hydration aligned with shared app-config state.
  - `hooks/__tests__/useTranscriptionOptions.test.ts`: Hook behavior tests (initial state, setters, bidirectional mutual exclusion, reset isolation, buildRequest payload).
  - `lib/defaults-patch.ts`: Build PATCH payloads against engine defaults and effective defaults. Keep three-state semantics (`undefined` unchanged, `null` clear, concrete value override) and preserve primitive replacements in nested transitions.
  - `lib/object-path.ts`: Resolve dot-path reads/writes for nested request payloads.
  - `lib/schema-adapter.ts`: Adapt backend schema into top-level controls and advanced groups.
  - `lib/temperature.ts`: Parse and validate comma-separated temperature lists. Return structured errors with i18n keys.
  - `lib/__tests__/defaults-patch.test.ts`: Defaults PATCH payload builder tests.
  - `lib/__tests__/schema-adapter.test.ts`: Schema adapter extraction and fallback tests.
  - `lib/__tests__/temperature.test.ts`: Temperature parse/validate unit tests.
  - `__tests__/actions.test.ts`, `__tests__/build-request.test.ts`: Cover action wrappers and payload composition.
  - `types.ts`: Transcription domain types (`AdvancedTranscriptionOptions`, `CreateTaskPayload`, task option state contracts).
- **export**:
  - `api.ts`: `downloadExport` (blob), `saveExport` (server path), `batchExport` (ZIP blob), export-default config APIs.
  - `components/ExportDialog.tsx`: Share export option UI across single and batch flows.
  - `hooks/useExportDefaults.ts`: Resolve persisted export defaults with update/reset support.
  - `lib/filename.ts`: Build frontend fallback filename aligned with backend filename rules.
- **history**:
  - `api.ts`: Request backend history list and batch cancel/retry actions.
  - `hooks/useHistoryTasks.ts`: Drive backend pagination with page-clamp behavior.
  - `hooks/useHistoryTaskActions.ts`: Handle history actions/export side effects and refresh sequencing.
  - `components/TaskHistoryPanel.tsx`: Compose history list, selection actions, and export dialog entry.
- **realtime**: Placeholder for future WebSocket-based live transcription.

### src/components/common/

Cross-feature composite components with feature-agnostic behavior.

- **ErrorBoundary.tsx**: Class-based error boundary wrapping child components. Catch render-time exceptions and display i18n-powered fallback UI with retry button. Use `withTranslation` HOC for i18n access in class components.
- **ListToolbar.tsx**: Share task list search/status/sort/order controls across recent/history panels.
- **TaskListPanel.tsx**: Share task row rendering, row actions, and pagination shell across recent/history panels.
- **types.ts**: Keep shared task action callback contracts.
- **__tests__/ErrorBoundary.test.tsx**: Component tests covering fallback rendering and retry recovery.
- **__tests__/TaskListPanel.test.tsx**: Component tests covering task row actions and pagination behavior.
- **index.ts**: Barrel entry for common components. Prefer importing via `@/components/common`.

### src/shared/

Cross-feature shared code, split into `lib/` and `types/`.
- **lib/api-client.ts**: Axios instance (30s timeout, no global Content-Type). Request interceptor logs debug. Response interceptor converts HTTP errors to `AppError` via `createApiError` and network failures to `createNetworkError`. Preserve `CanceledError` for upload cancellation semantics.
- **lib/__tests__/api-client.test.ts**: Interceptor tests covering cancel passthrough plus client, server, timeout, and offline mappings.
- **lib/error-factory.ts**: Central factory functions for `AppError` (`createValidationError`, `createNetworkError`, `createApiError`, `isAppError`). Mark 408/429 as `retriable: true`; other 4xx as `retriable: false`; 5xx as `retriable: true`.
- **lib/__tests__/error-factory.test.ts**: Factory contract tests for retry semantics and `isAppError`.
- **lib/error-utils.ts**: `formatApiError()` converts FastAPI error payloads into readable messages.
- **lib/__tests__/error-utils.test.ts**: Formatting tests for string and validation-array payloads.
- **lib/file-validation.ts**: Pure function `validateFile(file, config)` with config injection. Checks extension, MIME, size, empty file, no extension. Returns `AppError` on failure.
- **lib/format.ts**: `formatFileSize(bytes)` — base-1024 human-readable string (B/KB/MB/GB/TB). Guards against negative/NaN/Infinity.
- **lib/utils.ts**: `downloadBlob()` triggers browser file download from Blob (appends `<a>` to DOM, defers `URL.revokeObjectURL`).
- **lib/\_\_tests\_\_/**: Vitest unit tests for API-client mapping plus pure helpers (`error-factory`, `error-utils`, `file-validation`, `format`).
- **types/openapi.d.ts**: Auto-generated by `pnpm gen:types`. Never edit manually.
- **types/api-error.ts**: Backend error payload contracts (`ApiError`, `ValidationErrorItem`).
- **types/app-error.ts**: Frontend error contract (`AppError`: `code`, `i18nKey`, `params`, `retriable`).
- **types/config.ts**: Thin aliases for config contracts (`AppConfig`, `EngineDefaults`, `TranscriptionDefaultsUpdateRequest`).
- **types/file.ts**: Thin aliases over OpenAPI file schemas (`FileInfo`, `FileUploadResponse`, etc.).
- **types/task.ts**: Thin aliases over OpenAPI task schemas + derived types (`TaskStatus`, `ExportFormat` from schema enums).
- **types/task-query.ts**: Shared query model for list toolbar and pagination contracts.
- **types/index.ts**: Barrel re-export for `import type { ... } from '@/shared/types'`.

### src/routes/

Keep route composition and search-model helpers in this directory.

- **AppShell.tsx**: Keep shared navigation shell and global polling mount.
- **HistoryPage.tsx**: Compose `/history` page interactions and route callbacks.
- **history-search.ts**: Normalize route search params and build task query model.

### src/lib/

Autogenerated by shadcn.

- **utils.ts**: Contains the canonical `cn()` utility for merging Tailwind classes with `clsx` and `tailwind-merge`. Do not duplicate `cn` in `shared/lib`.

### src/i18n/

i18next bootstrap and locale dictionaries.

- **index.ts**: Initializes i18next + react-i18next integration.
- **locales/en.json**, **locales/zh.json**: Locale resource files.

### src/config/

Runtime config access and fallback constants.

- **api.ts**: Config endpoints (`fetchAppConfig`, `fetchEngineDefaults`, transcription defaults `PATCH`/`DELETE`, export defaults `GET/PATCH/DELETE`).
- **use-app-config.ts**: Shared config singleton store using `useSyncExternalStore`, plus `refreshAppConfig()`. Notify all mounted consumers when the shared snapshot changes.
- **constants.ts**: Fallback values used when config fetch fails or before first load.
- **env.ts**: Safely extracts `import.meta.env.VITE_*` using Nullish Coalescing (`??`).
- **test-env.ts**: Shared test-runtime detection and `NOLA_TEST_LOG` opt-in switch.
- **logger.ts**: Lightweight logger prefixing output with `[Nola]`. Mute logs by default in tests unless `NOLA_TEST_LOG=1`.

### src/test/

Shared Vitest bootstrap.

- **setup.ts**: Register `@testing-library/jest-dom/vitest`, provide a `ResizeObserver` mock, and silence `console.warn`/`console.error` in tests unless `NOLA_TEST_LOG=1`.

---

## Dev Commands

```bash
# Install dependencies (strictly use pnpm, NOT npm/yarn)
cd app && pnpm install

# Start dev server (Vite proxy forwards /api to localhost:8000)
pnpm dev

# Generate TS types from Backend OpenAPI
pnpm gen:types

# Format code with Prettier (Sorts Tailwind classes automatically)
pnpm format

# Run ESLint (checks unused vars, type imports)
pnpm lint
pnpm lint:fix

# Run tests
# test is one-shot; watch mode is explicit
pnpm test
pnpm test:watch
pnpm test:ci

# Type checking and full app quality
pnpm typecheck
pnpm check

# Verify generated OpenAPI types are committed
pnpm gen:types:check

# Build production bundle
pnpm build
```

---

## CI Contract

- Workflow entry: `.github/workflows/ci.yml`
- App quality matrix: Node `24.x` and `22.13.x` (both required)
- App quality commands:
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm build`
- App test command: `pnpm test:ci`
- Schema drift command path:
  - `pnpm --dir app gen:types`
  - `git diff --exit-code -- app/src/shared/types/openapi.d.ts`

---

## Client-Server Architecture

```text
Frontend (Vite/React) ───[ HTTP Proxy /api/* ]───▶ Backend (FastAPI, localhost:8000)
       │
   Axios (API Client)
   ├── shared/types/   (openapi-typescript → domain aliases/contracts)
   ├── features/*/api.ts (thin typed functions)
   React Hooks State + Feature Stores (Zustand)
   TanStack Router (active via router.tsx + src/routes/*)
   Tailwind v4 (Style)
```

---

## Limits & Notes

| Item             | Limit/Detail                                                 |
| ---------------- | ------------------------------------------------------------ |
| Allowed Uploads  | mp3, wav, flac, m4a, ogg, webm, aac, mp4, wma                |
| Max File Size    | 500 MB (Client-side validation required)                     |
| Polling Interval | 2000 ms foreground, 6000 ms background (hidden document)     |
| Theme            | `next-themes` installed; no active theme shell or toggle yet |
