# AI Instructions - Nola Frontend

> This file helps AI quickly understand the frontend project structure.

## Project Overview

| Key | Value |
|-----|-------|
| Name | Nola - Frontend Workspace |
| Stack | React 19 + TypeScript + Vite + TailwindCSS v4 + shadcn/ui + i18next + Axios |

---

## Current Status

> [!IMPORTANT]
> Treat `app/src` and the current Phase 3 docs as the source of truth.
>
> - Phase 3 core flow is implemented: upload files, configure transcription options, create tasks, and surface container-level feedback.
> - Stage 4 integration work is present in code: `App.tsx` wires `ErrorBoundary`, `Toaster`, `batchError` toasts, and task creation toasts.
> - Stage 5 verification is still pending as a project task even if some local tests already exist.
> - Phase 4 features are not implemented yet: no task board, no history page, no router wiring, and no Zustand task store.

---

## Code Style

> [!IMPORTANT]
> **Code & Comments must be:**
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
├── tsconfig.json             # TypeScript 5.9 project references
├── tsconfig.app.json         # App-level TS config (src/)
├── tsconfig.node.json        # Node-level TS config (vite.config.ts)
├── vite.config.ts            # Vite 7 + proxy to backend + Vitest config
├── src/                      # Frontend source code
│   ├── App.css               # App-level styles
│   ├── App.tsx               # Root layout shell
│   ├── index.css             # Tailwind v4 entry + shadcn variables
│   ├── main.tsx              # React mounting + TanStack Router provider
│   │
│   ├── assets/               # Static assets
│   │   └── react.svg         # Example asset
│   │
│   ├── config/               # Centralized configuration
│   │   ├── constants.ts      # App constants (synced with backend)
│   │   ├── env.ts            # Typed environment variables (import.meta.env)
│   │   └── logger.ts         # Lightweight logger ([Nola] prefix, skips debug in prod)
│   │
│   ├── i18n/                 # i18next bootstrap + locale resources
│   │   ├── index.ts          # i18n initialization (react-i18next)
│   │   └── locales/          # Locale dictionaries
│   │       ├── en.json       # English translations
│   │       └── zh.json       # Chinese translations
│   │
│   ├── components/           # Shared UI components (mostly shadcn generated)
│   │   └── ui/               # Radix + Tailwind primitives
│   │       ├── button.tsx    # Button variants
│   │       ├── card.tsx      # Card container primitives
│   │       ├── collapsible.tsx # Collapsible primitives
│   │       ├── input.tsx     # Input primitive
│   │       ├── label.tsx     # Label primitive
│   │       ├── progress.tsx  # Progress bar primitive
│   │       ├── select.tsx    # Select primitive
│   │       ├── separator.tsx # Separator primitive
│   │       ├── slider.tsx    # Slider primitive
│   │       ├── sonner.tsx    # Toast host wrapper
│   │       ├── switch.tsx    # Switch primitive
│   │       └── tooltip.tsx   # Tooltip primitive
│   │
│   ├── features/             # Business modules (Domain logic)
│   │   ├── export/           # Subtitle export & download
│   │   │   ├── api.ts        # downloadExport, saveExport, batchExport
│   │   │   └── index.ts      # Feature public exports
│   │   ├── history/          # Historical task pagination & search
│   │   │   └── index.ts      # Placeholder
│   │   ├── realtime/         # WebSocket streaming
│   │   │   └── index.ts      # Placeholder
│   │   ├── transcription/    # Task CRUD, polling, status tracking
│   │   │   ├── api.ts        # createTask, listTasks, getTask, cancelTask
│   │   │   └── index.ts      # Feature public exports
│   │   └── upload/           # File upload with progress
│   │       ├── api.ts        # uploadFile, listFiles, getFile, deleteFile
│   │       ├── components/   # Upload feature UI components
│   │       │   ├── FileUploader.tsx # Drag/drop + click file picker
│   │       │   ├── UploadList.tsx # Upload item list wrapper
│   │       │   └── UploadProgress.tsx # Single upload row UI
│   │       ├── hooks/        # Upload orchestration hooks
│   │       │   ├── useFileUpload.ts # Multi-file upload orchestration hook
│   │       │   └── __tests__/ # Hook unit tests
│   │       │       └── useFileUpload.test.ts # Queue/cancel/retry/reset coverage
│   │       ├── lib/          # Upload-private pure helpers
│   │       │   ├── error.ts  # Upload cancel/error classification
│   │       │   ├── state.ts  # Upload list pure state helpers/selectors
│   │       │   └── timeout.ts # Upload timeout policy
│   │       ├── types.ts      # Upload domain types (UploadItem, hook contract)
│   │       └── index.ts      # Feature barrel exports (components, hook, types)
│   │
│   ├── lib/                  # Autogenerated by shadcn (cn utility)
│   │   └── utils.ts          # Canonical `cn()` helper
│   │
│   ├── shared/               # Cross-feature shared code
│   │   ├── lib/              # Shared runtime helpers
│   │   │   ├── api-client.ts       # Axios instance + interceptors
│   │   │   ├── error-factory.ts    # AppError factory helpers
│   │   │   ├── error-utils.ts      # API error normalization helpers
│   │   │   ├── file-validation.ts  # Pure file validation (ext/MIME/size)
│   │   │   ├── format.ts           # formatFileSize() human-readable sizes
│   │   │   ├── utils.ts            # downloadBlob helper
│   │   │   └── __tests__/          # Unit tests (Vitest)
│   │   │       ├── file-validation.test.ts # validateFile unit tests
│   │   │       └── format.test.ts # formatFileSize unit tests
│   │   └── types/            # Shared type contracts
│   │       ├── openapi.d.ts   # AUTO-GENERATED (pnpm gen:types)
│   │       ├── api-error.ts   # Backend error payload types
│   │       ├── app-error.ts   # Frontend standardized error model
│   │       ├── file.ts        # FileInfo, FileUploadResponse, etc.
│   │       ├── task.ts        # TaskSummary, TaskStatus, ExportFormat, etc.
│   │       └── index.ts       # Barrel re-export
│   │
│   └── routes/               # TanStack Router definitions
│       └── .gitkeep          # Placeholder for feature routes
```

---

## Frontend Architecture Conventions

> [!IMPORTANT]
> **Architecture Rules:**
> 1. **Feature Cohesion**: Keep feature logic colocated; add `components/`, `hooks/`, `lib/`, and `store/` only when that feature needs them.
> 2. **Barrel Exports**: Every feature must expose its public methods/components via an `index.ts`. External files should ONLY import from a feature's index.
> 3. **Shared UI**: Any component used by >1 feature should be promoted to `src/components/` (or `src/components/ui/` for shared primitives).
> 4. **Routing**: `routes/` handles URL matching. Components and logic live in `features/`.
> 5. **API Types**: `shared/types/openapi.d.ts` is AUTO-GENERATED from the backend OpenAPI spec (`pnpm gen:types`). Do NOT manually edit it. Hand-maintained aliases/contracts (`file.ts`, `task.ts`, `api-error.ts`, `app-error.ts`) provide stable, readable types for business code.
> 6. **Lib Layer Boundaries**:
>    - `src/lib/*`: app/platform-level helpers (e.g., shadcn `cn`)
>    - `src/shared/lib/*`: cross-feature reusable runtime helpers
>    - `src/features/*/lib/*`: feature-private helpers; promote to `shared/lib` only when reused by another feature

> [!NOTE]
> `@tanstack/react-router`, `zustand`, and `next-themes` are installed, but the current
> Phase 3 implementation does not yet use router/store wiring as an active app shell.
> `next-themes` is currently consumed by `components/ui/sonner.tsx`.

### API Type Strategy

Three-layer pipeline from backend schema to UI code:

```
Backend (Pydantic) ──► openapi.json ──► openapi.d.ts ──► domain aliases/contracts ──► feature api.ts
   (Source)         (gen:types auto)   (generated types)   (typed functions)
```

| Layer | Path | Maintained by | Edit? |
|-------|------|--------------|-------|
| Raw types | `shared/types/openapi.d.ts` | `pnpm gen:types` (auto) | Never |
| Domain aliases/contracts | `shared/types/task.ts`, `file.ts`, `api-error.ts`, `app-error.ts` | Developer | Rarely (only if backend adds new schemas or error contract changes) |
| Feature API | `features/*/api.ts` | Developer | Frequently |

**Key rules:**
- `TaskStatus` and `ExportFormat` are **derived from OpenAPI enum**, not hardcoded. This ensures Single Source of Truth — backend adds a new status/format, frontend auto-inherits after `pnpm gen:types`.
- Domain aliases/contracts avoid verbose `components['schemas']['TaskSummaryResponse']` paths in business code.
- Runtime helpers such as `formatApiError` and AppError factories live in `shared/lib/*`, not in `shared/types/*`.
- Feature `api.ts` functions return unwrapped `data` (not `AxiosResponse`), keeping callers free from Axios internals.

**Update flow:** Backend changes schema → run `pnpm gen:types` → `openapi.d.ts` regenerates → domain aliases/contracts usually unchanged → feature API unchanged.

---

## Dependencies

| Package | Version |
|---------|---------|
| React / React DOM | ^19.2.0 |
| @tanstack/react-router | ^1.162.8 |
| zustand | ^5.0.11 |
| axios | ^1.13.5 |
| shadcn/ui (radix-ui) | latest |
| next-themes | ^0.4.6 |
| i18next / react-i18next | ^25.8 / ^16.5 |

### Dev Dependencies

| Package | Version |
|---------|---------|
| Vite | ^7.3.1 |
| TypeScript | ~5.9.3 |
| TailwindCSS | ^4.2.1 |
| Prettier / eslint-config-prettier| ^3.8.1 / ^10.1.8 |
| ESLint | ^9.39.1 |
| Vitest | ^4.0.18 |
| openapi-typescript | ^7.13.0 |

---

## Detailed Module Overview

### src/features/
Business domain logic separated by feature. Each feature has an `api.ts` (API functions) and `index.ts` (barrel export).
- **upload**:
  - `api.ts`: `uploadFile` (FormData + progress + AbortSignal), `listFiles`, `getFile`, `deleteFile`, `checkIntegrity`.
  - `components/FileUploader.tsx`: Select files via drag/drop or click and pass raw `File[]` upward.
  - `components/UploadProgress.tsx`: Render per-file status/progress/actions.
  - `components/UploadList.tsx`: Map `UploadItem[]` into progress rows.
  - `hooks/useFileUpload.ts`: Upload queue orchestration (validate/add/start/cancel/retry/remove/reset).
  - `hooks/__tests__/useFileUpload.test.ts`: Hook behavior tests (queue, concurrency, cancel/retry, remove/reset cleanup).
  - `lib/timeout.ts`: Per-file timeout strategy.
  - `lib/error.ts`: Axios cancellation classification helper.
  - `lib/state.ts`: Pure list update/select helpers to keep hook orchestration-focused.
  - `types.ts`: Upload domain contracts (`UploadItem`, `UseFileUploadReturn`).
  - `index.ts`: Public barrel exports (`FileUploader`, `UploadProgress`, `UploadList`, `useFileUpload`, `UploadItem`).
- **transcription**: `createTask`, `listTasks` (status filter), `getTask`, `cancelTask`, `getDefaultOptions`.
- **export**: `downloadExport` (blob), `saveExport` (server path), `batchExport` (ZIP blob).
- **history**: Placeholder for paginated viewing of past tasks.
- **realtime**: Placeholder for future WebSocket-based live transcription.

### src/shared/
Cross-feature shared code, split into `lib/` and `types/`.
- **lib/api-client.ts**: Axios instance (30s timeout, no global Content-Type). Request interceptor logs debug. Response interceptor parses `ApiError` with try/catch guard for non-conforming responses.
- **lib/error-factory.ts**: Central factory functions for `AppError` (`createValidationError`, `createNetworkError`, `createApiError`) to keep retry semantics consistent.
- **lib/error-utils.ts**: `formatApiError()` converts FastAPI error payloads into readable messages.
- **lib/file-validation.ts**: Pure function `validateFile(file, config)` with config injection. Checks extension, MIME, size, empty file, no extension. Returns `AppError` on failure.
- **lib/format.ts**: `formatFileSize(bytes)` — base-1024 human-readable string (B/KB/MB/GB/TB). Guards against negative/NaN/Infinity.
- **lib/utils.ts**: `downloadBlob()` triggers browser file download from Blob (appends `<a>` to DOM, defers `URL.revokeObjectURL`).
- **lib/\_\_tests\_\_/**: Vitest unit tests for pure functions (file-validation: 8 cases, format: 9 cases).
- **types/openapi.d.ts**: Auto-generated by `pnpm gen:types`. Never edit manually.
- **types/api-error.ts**: Backend error payload contracts (`ApiError`, `ValidationErrorItem`).
- **types/app-error.ts**: Frontend error contract (`AppError`: `code`, `i18nKey`, `params`, `retriable`).
- **types/file.ts**: Thin aliases over OpenAPI file schemas (`FileInfo`, `FileUploadResponse`, etc.).
- **types/task.ts**: Thin aliases over OpenAPI task schemas + derived types (`TaskStatus`, `ExportFormat` from schema enums).
- **types/index.ts**: Barrel re-export for `import type { ... } from '@/shared/types'`.

### src/routes/
TanStack Router definitions mapping URLs to components. Currently a placeholder (`.gitkeep`).

### src/lib/
Autogenerated by shadcn.
- **utils.ts**: Contains the canonical `cn()` utility for merging Tailwind classes with `clsx` and `tailwind-merge`. Do not duplicate `cn` in `shared/lib`.

### src/i18n/
i18next bootstrap and locale dictionaries.
- **index.ts**: Initializes i18next + react-i18next integration.
- **locales/en.json**, **locales/zh.json**: Locale resource files.

### src/config/
Bootstrap constants overriding magic strings.
- **env.ts**: Safely extracts `import.meta.env.VITE_*` using Nullish Coalescing (`??`).
- **constants.ts**: Manually synced values from backend (`POLL_INTERVAL_MS`, `ALLOWED_EXTENSIONS`, etc.).
- **logger.ts**: Lightweight logger prefixing output with `[Nola]` and suppressing `debug` in production.

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
pnpm test
pnpm test:watch

# Build production bundle
pnpm build
```

---

## Client-Server Architecture

```text
Frontend (Vite/React) ───[ HTTP Proxy /api/* ]───▶ Backend (FastAPI, localhost:8000)
       │
   Axios (API Client)
   ├── shared/types/   (openapi-typescript → domain aliases/contracts)
   ├── features/*/api.ts (thin typed functions)
   React Hooks State (Zustand reserved for future shared state)
   TanStack Router
   Tailwind v4 (Style)
```

---

## Limits & Notes

| Item | Limit/Detail |
|------|-------|
| Allowed Uploads | mp3, wav, flac, m4a, ogg, webm, aac, mp4, wma |
| Max File Size | 500 MB (Client-side validation required) |
| Polling Interval | 2000 ms (Long-term plan to switch to WS/SSE) |
| Theme | `next-themes` (Dark/Light toggle support native) |
