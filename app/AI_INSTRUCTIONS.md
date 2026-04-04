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
│   ├── App.tsx               # Compose home page with upload, options, and current-batch tasks
│   ├── index.css             # Tailwind v4 entry + shadcn variables
│   ├── main.tsx              # Mount React root and router provider
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
│   │   ├── models/           # Model management feature
│   │   │   ├── api.ts        # Model list/detail/download/settings API client
│   │   │   ├── __tests__/    # Model API tests
│   │   │   │   └── api.test.ts # Verify model API request wiring
│   │   │   ├── components/   # Model management UI components
│   │   │   │   ├── DownloadProgress.tsx # Download progress display
│   │   │   │   ├── ModelCard.tsx # Model card and action controls
│   │   │   │   └── ModelList.tsx # Sorted model list composition
│   │   │   ├── hooks/        # Model data and download-state hooks
│   │   │   │   ├── useModels.ts # Load model list and settings
│   │   │   │   ├── useModelDownload.ts # Merge REST and SSE download state
│   │   │   │       ├── useModels.test.ts # Verify model list hook behavior
│   │   │   │       └── useModelDownload.test.ts # Verify download hook behavior
│   │   │   ├── lib/          # Model-private display helpers
│   │   │   │   ├── model-helpers.ts # Format and sort model display data
│   │   │   │       └── model-helpers.test.ts # Verify helper edge cases
│   │   │   ├── index.ts      # Feature public exports
│   │   │   └── types.ts      # Model domain contracts
│   │   ├── tasks/            # Keep task lifecycle, polling, and history subdomain
│   │   │   ├── api.ts        # Use create/list/get/cancel/delete and batch endpoints
│   │   │   ├── actions.ts    # Wrap write actions and guarantee refresh signals
│   │   │   ├── __tests__/    # Keep task API/action tests
│   │   │   │   ├── actions.test.ts # Verify action wrapper behavior
│   │   │   │   └── api.test.ts # Verify API request wiring
│   │   │   ├── components/   # Keep current-batch task panel and action bar
│   │   │   │   ├── CurrentBatchTasksPanel.tsx # Compose session task list with batch actions
│   │   │   │   ├── TaskBatchActionBar.tsx # Reuse batch-action controls
│   │   │   │   └── __tests__/
│   │   │   │       └── TaskBatchActionBar.test.tsx # Verify batch-action controls
│   │   │   ├── hooks/        # Keep task query/polling/selection hooks
│   │   │   │   ├── useRecentTaskQuery.ts # Normalize recent-task query and paging
│   │   │   │   ├── useTaskPolling.ts # Poll with foreground/background intervals
│   │   │   │   ├── useTaskSelection.ts # Manage reusable selection state
│   │   │   │   └── __tests__/
│   │   │   │       ├── useRecentTaskQuery.test.ts # Verify recent query hook
│   │   │   │       ├── useTaskPolling.test.ts # Verify polling hook
│   │   │   │       └── useTaskSelection.test.ts # Verify selection hook
│   │   │   ├── lib/          # Keep task-private pure helpers
│   │   │   │   ├── task-refresh.ts # Broadcast task refresh events
│   │   │   │   ├── task-selectors.ts # Select active/recent terminal tasks
│   │   │   │   ├── task-status-groups.ts # Group active and terminal statuses
│   │   │   │   └── __tests__/
│   │   │   │       ├── task-refresh.test.ts # Verify refresh broadcaster
│   │   │   │       ├── task-selectors.test.ts # Verify task selectors
│   │   │   │       └── task-status-groups.test.ts # Verify status grouping
│   │   │   ├── store/        # Keep session and board stores
│   │   │   │   ├── session-tasks-store.ts # Store session-scoped tasks
│   │   │   │   ├── task-board-store.ts # Store polled task board state
│   │   │   │   └── __tests__/
│   │   │   │       ├── session-tasks-store.test.ts # Verify session store
│   │   │   │       └── task-board-store.test.ts # Verify board store
│   │   │   ├── history/      # Keep history subdomain on top of tasks APIs
│   │   │   │   ├── api.ts    # Wrap listHistoryTasks and batch actions
│   │   │   │   ├── index.ts  # Expose history subdomain exports
│   │   │   │   ├── __tests__/
│   │   │   │   │   └── api.test.ts # Verify history API wrappers
│   │   │   │   ├── hooks/
│   │   │   │   │   ├── useHistoryTasks.ts # Query history with backend paging
│   │   │   │   │   ├── useHistoryTaskActions.ts # Orchestrate history actions and export
│   │   │   │   │   └── __tests__/
│   │   │   │   │       ├── useHistoryTasks.test.ts # Verify history query hook
│   │   │   │   │       └── useHistoryTaskActions.test.ts # Verify history action hook
│   │   │   │   └── components/
│   │   │   │       ├── TaskHistoryPanel.tsx # Compose history list with batch actions/export
│   │   │   │       └── __tests__/
│   │   │   │           └── TaskHistoryPanel.test.tsx # Verify history panel behavior
│   │   │   └── index.ts      # Expose feature public exports
│   │   │
│   │   ├── realtime/         # Reserve WebSocket streaming extension point
│   │   │   └── index.ts      # Keep placeholder export
│   │   ├── transcription-options/ # Keep task option composition and defaults patch logic
│   │   │   ├── index.ts      # Expose feature public exports
│   │   │   ├── types.ts      # Keep option domain types and contracts
│   │   │   ├── __tests__/
│   │   │   │   └── build-request.test.ts # Verify request payload composition
│   │   │   ├── components/   # Keep option panel components
│   │   │   │   ├── OptionsBar.tsx # Compose language/task selectors and start action
│   │   │   │   ├── AdvancedOptions.tsx # Render schema-driven advanced options
│   │   │   │   └── __tests__/
│   │   │   │       ├── OptionsBar.test.tsx # Verify options bar behavior
│   │   │   │       └── AdvancedOptions.test.tsx # Verify advanced options behavior
│   │   │   ├── hooks/
│   │   │   │   ├── useTranscriptionOptions.ts # Manage option overrides and payload build
│   │   │   │   └── __tests__/
│   │   │   │       └── useTranscriptionOptions.test.ts # Verify option hook behavior
│   │   │   └── lib/
│   │   │       ├── defaults-patch.ts # Build defaults PATCH payload
│   │   │       ├── object-path.ts # Read/write nested payload fields by dot path
│   │   │       ├── schema-adapter.ts # Adapt backend schema to option models
│   │   │       ├── temperature.ts # Parse/validate temperature lists
│   │   │       └── __tests__/
│   │   │           ├── defaults-patch.test.ts # Verify defaults patch builder
│   │   │           ├── object-path.test.ts # Verify object-path helpers
│   │   │           ├── schema-adapter.test.ts # Verify schema adapter
│   │   │           └── temperature.test.ts # Verify temperature validator
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
│   │   │   ├── sse-client.ts       # Shared EventSource wrapper for typed SSE streams
│   │   │   ├── utils.ts            # downloadBlob helper
│   │   │   └── __tests__/          # Unit tests (Vitest)
│   │   │       ├── api-client.test.ts # Interceptor error mapping tests
│   │   │       ├── error-factory.test.ts # AppError factory contract tests
│   │   │       ├── error-utils.test.ts # API error formatting tests
│   │   │       ├── file-validation.test.ts # validateFile unit tests
│   │   │       ├── format.test.ts # formatFileSize unit tests
│   │   │       └── sse-client.test.ts # SSE connection wiring tests
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
│       ├── AppShell.tsx      # Shared shell route component
│       ├── HistoryPage.tsx   # History route composition component
│       ├── ModelsPage.tsx    # Models route composition component
│       └── history-search.ts # History URL query normalize/build helpers
```

### Recent Additions

- `src/features/models/`: Model-management feature with API client, hooks, helpers, and page components.
- `src/shared/lib/sse-client.ts`: Shared EventSource wrapper for model download streaming.
- `src/routes/ModelsPage.tsx`: `/models` route mounted alongside `/` and `/history`.

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
> 13. **Feature Naming Boundary**:
>     - Use `src/features/tasks` for task lifecycle and history flows.
>     - Use `src/features/transcription-options` for option composition and defaults-patch logic.
>     - Do not create or restore `src/features/history` or `src/features/transcription`.
> 14. **Subdomain Composition Boundary**:
>     - Keep `transcription-options` independent from `tasks`.
>     - Compose `transcription-options` with `tasks` only in route/page containers (`App.tsx`, `HistoryPage.tsx`, `AppShell.tsx`).
>     - Do not reintroduce compatibility re-export modules for removed legacy feature roots.
> 15. **Task API Path Boundary**:
>     - Use `/api/transcription-tasks/*` as runtime task endpoints.
>     - Do not add new frontend runtime clients for `/api/transcriptions/*` aliases.
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

**Apply update flow:** Backend changes schema → run `pnpm gen:types` → commit regenerated `openapi.d.ts` → update dependent aliases/contracts only when needed → verify schema drift with `pnpm gen:types:check`.

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

Separate business domain logic by feature. Expose every feature public surface through `index.ts`.

- **upload**:
  - `api.ts`: Use `uploadFile` (FormData + progress + AbortSignal), `listFiles`, `getFile`, `deleteFile`, and `checkIntegrity`.
  - `components/FileUploader.tsx`: Accept drag/drop and click file selection, then pass raw `File[]` upward.
  - `components/UploadProgress.tsx`: Render each upload row status, progress, and action entry.
  - `components/UploadList.tsx`: Render upload rows from `UploadItem[]`.
  - `components/__tests__/FileUploader.test.tsx`: Verify drag/drop, keyboard trigger, and disabled blocking.
  - `components/__tests__/UploadProgress.test.tsx`: Verify uploading/error/success/cancelled row states.
  - `hooks/useFileUpload.ts`: Orchestrate validate/add/start/cancel/retry/remove/reset and expose `batchError` + `clearBatchError`.
  - `hooks/__tests__/useFileUpload.test.ts`: Verify queue flow, dedup, error lifecycle, concurrency, and cleanup.
  - `lib/admission.ts`: Deduplicate by file fingerprint and return admitted uploads plus optional batch-level error.
  - `lib/state.ts`: Keep upload list update/select helpers pure.
  - `lib/timeout.ts`: Apply upload timeout policy.
  - `lib/error.ts`: Classify cancellation and upload error cases.
  - `lib/__tests__/admission.test.ts`, `lib/__tests__/state.test.ts`, `lib/__tests__/timeout.test.ts`: Verify helper behavior.
  - `types.ts`: Keep upload contracts (`UploadItem`, `UseFileUploadReturn`) stable.
  - `index.ts`: Expose upload feature public exports.
- **tasks**:
  - `api.ts`: Use `createTask`, `listTasks`, `getTask`, `cancelTask`, `deleteTaskRecord`, `batchCancelTasks`, and `batchRetryTasks`.
  - `__tests__/api.test.ts`: Verify task endpoint path and request body wiring.
  - `actions.ts`: Use refresh-safe wrappers (`cancelTaskAndRefresh`, `retryTaskAndRefresh`, `deleteTaskRecordAction`); call `requestTaskRefresh()` in `finally` for cancel/retry attempts.
  - `__tests__/actions.test.ts`: Verify wrapper refresh behavior and failure handling.
  - `components/CurrentBatchTasksPanel.tsx`: Compose current-batch list, per-task actions, and batch action flow; guard batch actions with real handlers and prevent unhandled rejections from `void` click chains.
  - `components/TaskBatchActionBar.tsx`: Reuse batch cancel/retry selection controls.
  - `components/__tests__/TaskBatchActionBar.test.tsx`: Verify batch action bar interaction and disabled states.
  - `hooks/useRecentTaskQuery.ts`: Normalize query/filter/sort/pagination state for recent tasks.
  - `hooks/useTaskPolling.ts`: Poll board data with visibility-aware cadence.
  - `hooks/useTaskSelection.ts`: Isolate current-page selection toggle logic.
  - `hooks/__tests__/useRecentTaskQuery.test.ts`, `hooks/__tests__/useTaskPolling.test.ts`, `hooks/__tests__/useTaskSelection.test.ts`: Verify hook behavior.
  - `lib/task-refresh.ts`: Broadcast refresh events without hook coupling.
  - `lib/task-selectors.ts`: Select active and recent terminal tasks.
  - `lib/task-status-groups.ts`: Keep status-group constants centralized.
  - `lib/__tests__/task-refresh.test.ts`, `lib/__tests__/task-selectors.test.ts`, `lib/__tests__/task-status-groups.test.ts`: Verify task helper behavior.
  - `store/session-tasks-store.ts`: Keep session-scoped task map and mutations.
  - `store/task-board-store.ts`: Keep board-scope polled task list and hydration.
  - `store/__tests__/session-tasks-store.test.ts`, `store/__tests__/task-board-store.test.ts`: Verify store contracts.
  - `history/api.ts`: Wrap `listTasks` as `listHistoryTasks` and expose history batch wrappers.
  - `history/__tests__/api.test.ts`: Verify history API wrappers.
  - `history/hooks/useHistoryTasks.ts`: Query backend history with page clamp behavior.
  - `history/hooks/useHistoryTaskActions.ts`: Orchestrate history cancel/retry/export and refresh sequencing.
  - `history/hooks/__tests__/useHistoryTasks.test.ts`, `history/hooks/__tests__/useHistoryTaskActions.test.ts`: Verify history hooks.
  - `history/components/TaskHistoryPanel.tsx`: Compose history list panel, selection, and export entry.
  - `history/components/__tests__/TaskHistoryPanel.test.tsx`: Verify history panel interactions.
  - `history/index.ts`: Expose history subdomain public exports.
  - `index.ts`: Expose tasks feature public exports.
- **transcription-options**:
  - `components/OptionsBar.tsx`: Compose file selector, language/task selector, prompt input, defaults actions, and task creation trigger.
  - `components/AdvancedOptions.tsx`: Render backend-schema-driven advanced controls.
  - `components/__tests__/OptionsBar.test.tsx`, `components/__tests__/AdvancedOptions.test.tsx`: Verify option UI behavior.
  - `hooks/useTranscriptionOptions.ts`: Manage override state and build typed `CreateTaskPayload`.
  - `hooks/__tests__/useTranscriptionOptions.test.ts`: Verify state reset, mutual exclusion, and payload composition.
  - `lib/defaults-patch.ts`: Build transcription defaults PATCH payload with `undefined/null/value` semantics.
  - `lib/object-path.ts`: Read/write nested fields by dot-path.
  - `lib/schema-adapter.ts`: Adapt backend schema to top-level and advanced option models.
  - `lib/temperature.ts`: Parse and validate temperature list input.
  - `lib/__tests__/defaults-patch.test.ts`, `lib/__tests__/object-path.test.ts`, `lib/__tests__/schema-adapter.test.ts`, `lib/__tests__/temperature.test.ts`: Verify option helper behavior.
  - `__tests__/build-request.test.ts`: Verify task payload build output.
  - `types.ts`: Keep option domain contracts stable.
  - `index.ts`: Expose transcription-options feature public exports.
- **export**:
  - `api.ts`: Use `downloadExport`, `saveExport`, `batchExport`, and export-default config APIs.
  - `components/ExportDialog.tsx`: Reuse export option UI for single-task and batch-task flows.
  - `components/__tests__/ExportDialog.test.tsx`: Verify export dialog behavior.
  - `hooks/useExportDefaults.ts`: Manage persisted export defaults with update/reset.
  - `hooks/__tests__/useExportDefaults.test.ts`: Verify export-default hook behavior.
  - `lib/filename.ts`: Build frontend fallback filename aligned with backend rules.
  - `lib/__tests__/filename.test.ts`: Verify filename helper behavior.
  - `index.ts`: Expose export feature public exports.
- **models**:
  - `api.ts`: Use model list/detail/download/cancel/delete/select/settings/download-runtime endpoints.
  - `__tests__/api.test.ts`: Verify model API request wiring.
  - `components/DownloadProgress.tsx`: Render real download percentage, transferred bytes, and speed.
  - `components/ModelCard.tsx`: Render one model row/card with status badges and contextual actions.
  - `components/ModelList.tsx`: Compose sorted model display using runtime download state.
  - `hooks/useModels.ts`: Load model list/settings and preserve structured `AppError` semantics.
  - `hooks/useModelDownload.ts`: Merge REST baseline download state with SSE progress events.
  - `hooks/__tests__/useModels.test.ts`, `hooks/__tests__/useModelDownload.test.ts`: Verify model hook behavior.
  - `lib/model-helpers.ts`: Keep pure display helpers for sorting and byte formatting.
  - `lib/__tests__/model-helpers.test.ts`: Verify helper edge cases.
  - `types.ts`: Keep model feature contracts stable over generated OpenAPI types.
  - `index.ts`: Expose model feature public exports.
- **realtime**:
  - `index.ts`: Reserve placeholder exports for future WebSocket live updates.

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
- **lib/sse-client.ts**: Shared EventSource wrapper with typed payloads and normalized API-base URL joining.
- **lib/__tests__/sse-client.test.ts**: Verify SSE connection wiring, event parsing, and cleanup.
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
- **ModelsPage.tsx**: Compose `/models` page interactions, model settings summary, and model action toasts.
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
