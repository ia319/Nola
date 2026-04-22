# AI Instructions - Nola Frontend

> This file helps AI quickly understand the frontend project structure.

## Project Overview

| Key   | Value                                                                       |
| ----- | --------------------------------------------------------------------------- |
| Name  | Nola - Frontend Workspace                                                   |
| Stack | React 19 + TypeScript + Vite + TailwindCSS v4 + shadcn/ui + TanStack Router/Query + Zustand + i18next + Axios |

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
├── AI_INSTRUCTIONS.md        # This file
├── components.json           # shadcn/ui component registry config
├── eslint.config.js          # ESLint flat config
├── index.html                # Vite entry HTML
├── package.json              # pnpm configuration
├── pnpm-lock.yaml            # pnpm lockfile
├── README.md                 # Frontend docs
├── public/                   # Public runtime icons and manifest
│   ├── favicon.ico           # Browser favicon
│   ├── apple-touch-icon.png  # Apple touch icon
│   ├── manifest.webmanifest  # PWA metadata
│   └── web-app-manifest-*.png # PWA icon assets
├── tsconfig.json             # TypeScript 5.9 project references
├── tsconfig.app.json         # App-level TS config (src/)
├── tsconfig.node.json        # Node-level TS config (vite.config.ts)
├── vite.config.ts            # Vite 7 + proxy to backend + Vitest config (default node env)
├── src/                      # Frontend source code
│   ├── App.css               # App-level styles
│   ├── App.tsx               # Deprecated wrapper around TaskWorkbenchPage
│   ├── index.css             # Tailwind v4 entry + shadcn variables
│   ├── main.tsx              # Hydrate preferences/i18n and mount ThemeProvider + QueryClient + router
│   ├── router.tsx            # TanStack Router tree with localized and default routes
│   ├── test/                 # Shared Vitest setup
│   │   └── setup.ts          # jest-dom + ResizeObserver polyfill + test log silencing
│   │
│   ├── app/                  # App-level locale and UI preference state
│   │   └── locale/           # Locale route helpers and UI preferences store
│   │       ├── locale-routing.ts # Parse, strip, and apply locale route prefixes
│   │       ├── ui-preferences-store.ts # Hydrate and persist UI preferences
│   │       └── use-active-locale.ts # Read the active locale from the current route
│   │
│   ├── assets/               # Runtime assets
│   │   └── brand/            # Brand marks used by the shell
│   │       └── nola-logo-mark.svg # Nola shell logo mark
│   │
│   ├── config/               # Centralized configuration
│   │   ├── api.ts            # Config API (fetch + defaults update/reset)
│   │   ├── cache-invalidation.ts # Refresh shared config/default caches after mutations
│   │   ├── __tests__/        # Config store and preference persistence tests
│   │   │   ├── ui-preferences-storage.test.ts # Storage migration/fallback tests
│   │   │   └── use-app-config.test.ts # Shared config cache/store tests
│   │   ├── constants.ts      # App constants (synced with backend)
│   │   ├── env.ts            # Typed environment variables (import.meta.env)
│   │   ├── logger.ts         # Lightweight logger ([Nola] prefix, test-aware mute)
│   │   ├── test-env.ts       # Shared test-runtime flags and log opt-in env
│   │   ├── ui-preferences.ts # UI preference constants, guards, and normalization
│   │   ├── ui-preferences-storage.ts # Browser storage repository for UI preferences
│   │   └── use-app-config.ts # Shared config store + refresh API
│   │
│   ├── i18n/                 # i18next bootstrap + locale resources
│   │   ├── index.ts          # i18n initialization (react-i18next)
│   │   └── locales/          # Locale dictionaries
│   │       ├── en.json       # English translations
│   │       └── zh.json       # Chinese translations
│   │
│   ├── components/           # Shared UI components and theme infrastructure
│   │   ├── bootstrap-error-fallback.tsx # Visible fallback for bootstrap failures
│   │   ├── theme-context.ts  # Theme context contract
│   │   ├── theme-provider.tsx # Apply light/dark/system theme before paint
│   │   ├── use-theme.ts      # Read theme context
│   │   ├── __tests__/        # Component infrastructure tests
│   │   │   └── theme-provider.test.tsx # Verify theme hydration and persistence behavior
│   │   ├── common/           # Cross-feature common components barrel
│   │   │   ├── __tests__/
│   │   │   │   ├── ErrorBoundary.test.tsx # Fallback and retry tests
│   │   │   │   └── TaskListPanel.test.tsx # Task list panel behavior tests
│   │   │   ├── ErrorBoundary.tsx # Render-error catch + i18n fallback + retry
│   │   │   ├── ListToolbar.tsx # Shared search/filter/sort toolbar
│   │   │   ├── TaskListPanel.tsx # Shared task list panel with actions
│   │   │   ├── types.ts      # Shared common-component callback contracts
│   │   │   └── index.ts      # Common export entry (feature-agnostic)
│   │   └── ui/               # Radix + Tailwind primitives plus Nola design components
│   │       ├── __tests__/    # UI primitive tests
│   │       │   ├── design-system.test.tsx # Verify shared design component contracts
│   │       │   └── sonner.test.tsx # Verify toaster host behavior
│   │       ├── button.tsx    # Button variants
│   │       ├── card.tsx      # Card container primitives
│   │       ├── collapsible.tsx # Collapsible primitives
│   │       ├── DataTable.tsx # Table with selection, three-state UI, and row interaction guards
│   │       ├── DetailSheet.tsx # Dialog/side-sheet wrapper
│   │       ├── dialog.tsx    # Dialog primitives
│   │       ├── EmptyState.tsx # Empty/error state presentation
│   │       ├── input.tsx     # Input primitive
│   │       ├── index.ts      # UI primitive public exports
│   │       ├── label.tsx     # Label primitive
│   │       ├── MetricCard.tsx # Metric/stat card
│   │       ├── progress.tsx  # Progress bar primitive
│   │       ├── ProgressBar.tsx # Nola progress bar wrapper
│   │       ├── select.tsx    # Select primitive
│   │       ├── separator.tsx # Separator primitive
│   │       ├── slider.tsx    # Slider primitive
│   │       ├── sonner.tsx    # Toast host wrapper
│   │       ├── StatusBadge.tsx # Status badge with task/model mappings
│   │       ├── switch.tsx    # Switch primitive
│   │       ├── textarea.tsx  # Textarea primitive
│   │       └── tooltip.tsx   # Tooltip primitive
│   │
│   ├── features/             # Business modules (Domain logic)
│   │   ├── activity/         # Activity Center aggregation
│   │   │   ├── ActivityDataBridge.tsx # Bridge task/model sources into activity store
│   │   │   ├── store.ts      # needsAttention/inProgress/recent zustand store
│   │   │   ├── __tests__/    # Activity store and bridge tests
│   │   │   │   ├── ActivityDataBridge.test.tsx # Verify activity data-source bridge behavior
│   │   │   │   └── store.test.ts # Verify activity grouping, dismissal, and recent ordering
│   │   │   └── index.ts      # Feature public exports
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
│   │   │   │   ├── ModelDetailContent.tsx # Model detail side-sheet content
│   │   │   │   ├── ModelList.tsx # Table/list model composition
│   │   │   │   └── __tests__/ # Model component tests
│   │   │   │       ├── DownloadProgress.test.tsx # Verify progress rendering
│   │   │   │       ├── ModelDetailContent.test.tsx # Verify detail sheet content and actions
│   │   │   │       └── ModelList.test.tsx # Verify model table actions
│   │   │   ├── hooks/        # Model data and download-state hooks
│   │   │   │   ├── useModels.ts # Load model list and settings
│   │   │   │   ├── useModelDownload.ts # Merge REST and SSE download state
│   │   │   │   └── __tests__/    # Model hook tests
│   │   │   │       ├── useModels.test.ts # Verify model list hook behavior
│   │   │   │       └── useModelDownload.test.ts # Verify download hook behavior
│   │   │   ├── lib/          # Model-private display helpers
│   │   │   │   ├── model-helpers.ts # Format, sort, and resolve model display data
│   │   │   │   ├── model-refresh.ts # Broadcast model refresh requests
│   │   │   │   └── __tests__/    # Model helper tests
│   │   │   │       └── model-helpers.test.ts # Verify helper edge cases
│   │   │   ├── index.ts      # Feature public exports
│   │   │   └── types.ts      # Model domain contracts
│   │   ├── tasks/            # Keep task lifecycle, polling, and history subdomain
│   │   │   ├── api.ts        # Use create/list/get/cancel/delete and batch endpoints
│   │   │   ├── actions.ts    # Wrap write actions and guarantee refresh signals
│   │   │   ├── __tests__/    # Keep task API/action tests
│   │   │   │   ├── actions.test.ts # Verify action wrapper behavior
│   │   │   │   └── api.test.ts # Verify API request wiring
│   │   │   ├── components/   # Keep current-batch task panel, action bar, and detail content
│   │   │   │   ├── CurrentBatchTasksPanel.tsx # Compose session task list with batch actions
│   │   │   │   ├── TaskBatchActionBar.tsx # Reuse batch-action controls
│   │   │   │   ├── TaskDetailContent.tsx # Task detail dialog content
│   │   │   │   └── __tests__/
│   │   │   │       ├── TaskBatchActionBar.test.tsx # Verify batch-action controls
│   │   │   │       └── TaskDetailContent.test.tsx # Verify task detail rendering edge cases
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
│   │   ├── settings/         # Settings feature helpers
│   │   │   └── lib/          # Locale/preference compatibility helpers and tests
│   │   │       ├── ui-preferences.ts # Settings-page UI preference option models
│   │   │       └── __tests__/ # Settings helper tests
│   │   │           ├── locale-routing.test.ts # Verify legacy locale-route helper behavior
│   │   │           └── ui-preferences.test.ts # Verify settings preference option models
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
│   │       ├── __tests__/    # Upload API tests
│   │       │   └── api.test.ts # Verify upload API request wiring
│   │       ├── components/   # Upload feature UI components
│   │       │   ├── FileDetailContent.tsx # File detail dialog content
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
│   │   │   ├── icons.ts            # Shared Lucide icon mapping
│   │   │   ├── overlay-events.ts   # Cross-overlay close events
│   │   │   ├── query-client.ts     # TanStack Query client defaults
│   │   │   ├── query-fetcher.ts    # Shared query fetcher wrapper
│   │   │   ├── query-keys.ts       # Query key factory
│   │   │   ├── sse-client.ts       # Shared EventSource wrapper for typed SSE streams
│   │   │   ├── utils.ts            # downloadBlob helper
│   │   │   └── __tests__/          # Unit tests (Vitest)
│   │   │       ├── api-client.test.ts # Interceptor error mapping tests
│   │   │       ├── error-factory.test.ts # AppError factory contract tests
│   │   │       ├── error-utils.test.ts # API error formatting tests
│   │   │       ├── file-validation.test.ts # validateFile unit tests
│   │   │       ├── format.test.ts # formatFileSize unit tests
│   │   │       ├── query-client.test.ts # Query client default tests
│   │   │       ├── query-fetcher.test.ts # Query fetch wrapper tests
│   │   │       ├── query-keys.test.ts # Query key factory tests
│   │   │       └── sse-client.test.ts # SSE connection wiring tests
│   │   ├── responsive/       # Breakpoints and view-mode hooks
│   │   │   ├── breakpoints.ts # Shared responsive breakpoint constants
│   │   │   ├── index.ts      # Responsive helper public exports
│   │   │   ├── useBreakpoint.ts # Track active breakpoint
│   │   │   ├── useViewMode.ts # Resolve compact/expanded view mode
│   │   │   └── __tests__/    # Responsive helper tests
│   │   │       ├── breakpoints.test.ts # Verify breakpoint constants
│   │   │       └── useBreakpoint.test.ts # Verify breakpoint hook behavior
│   │   └── types/            # Shared type contracts
│   │       ├── openapi.d.ts   # AUTO-GENERATED (pnpm gen:types)
│   │       ├── api-error.ts   # Backend error payload types
│   │       ├── app-error.ts   # Frontend standardized error model
│   │       ├── config.ts      # Config response aliases (schema/defaults)
│   │       ├── file.ts        # FileInfo, FileUploadResponse, etc.
│   │       ├── model.ts       # Model response aliases and download-state contracts
│   │       ├── task.ts        # TaskSummary, TaskStatus, ExportFormat, etc.
│   │       ├── task-query.ts  # Shared task query model contracts
│   │       └── index.ts       # Barrel re-export
│   │
│   ├── layouts/              # Page-level layout primitives
│   │   ├── ContentCanvas.tsx # Workspace width/height wrapper
│   │   ├── FormRow.tsx       # Settings row layout
│   │   ├── index.ts          # Layout primitive public exports
│   │   ├── PageHeader.tsx    # Page header wrapper
│   │   ├── SectionHeader.tsx # Lightweight section label
│   │   ├── SettingsLayout.tsx # Settings tab layout + outlet
│   │   ├── TwoColumnLayout.tsx # Task Workbench two-column layout
│   │   └── __tests__/        # Layout primitive tests
│   │       └── layouts.test.tsx # Verify layout primitive rendering
│   │
│   ├── pages/                # Route page implementations
│   │   ├── history-center/   # History task/file modes and detail dialogs
│   │   │   ├── HistoryFileModeView.tsx # Compose file-mode history page
│   │   │   ├── HistoryFileRecordsView.tsx # Render file history records
│   │   │   ├── HistoryPage.tsx # Compose history center shell
│   │   │   ├── HistoryPagination.tsx # Render history pagination controls
│   │   │   ├── HistoryTaskModeView.tsx # Compose task-mode history page
│   │   │   ├── HistoryTaskRecordsView.tsx # Render task history records
│   │   │   ├── HistoryToolbar.tsx # Render history filters and actions
│   │   │   ├── useHistoryFileActions.ts # Orchestrate file history mutations
│   │   │   ├── useHistoryFileAssociatedTasks.ts # Resolve tasks linked to selected files
│   │   │   ├── useHistoryFiles.ts # Query paged file history
│   │   │   ├── useHistoryFileTaskCounts.ts # Resolve file-to-task counts
│   │   │   ├── useHistoryTaskDetail.ts # Query task detail for history dialogs
│   │   │   └── __tests__/    # History page and hook tests
│   │   │       ├── HistoryPage.test.tsx # Verify history center behavior
│   │   │       ├── HistoryPagination.test.tsx # Verify pagination controls
│   │   │       ├── useHistoryFileActions.test.tsx # Verify file action orchestration
│   │   │       ├── useHistoryFileAssociatedTasks.test.ts # Verify associated task resolution
│   │   │       └── useHistoryFileTaskCounts.test.ts # Verify file task-count resolution
│   │   ├── models-management/ # Models table, detail sheet, and actions
│   │   │   ├── ModelsPage.tsx # Compose model management page
│   │   │   └── __tests__/    # Model management page tests
│   │   │       └── ModelsPage.test.tsx # Verify model page rendering and actions
│   │   ├── settings/         # General, Transcription, Export, Model Storage, System Info
│   │   │   ├── ExportTab.tsx # Render export defaults settings
│   │   │   ├── GeneralTab.tsx # Render language/theme/unit settings
│   │   │   ├── ModelStorageTab.tsx # Render model storage settings
│   │   │   ├── settings-tabs.ts # Define settings tab registry
│   │   │   ├── SettingsPage.tsx # Compose settings route shell
│   │   │   ├── SettingsPlaceholder.tsx # Render planned settings placeholder
│   │   │   ├── SettingsTabPage.tsx # Select settings tab content
│   │   │   ├── SystemInfoTab.tsx # Render system info and maintenance actions
│   │   │   ├── TranscriptionTab.tsx # Render transcription defaults settings
│   │   │   └── __tests__/    # Settings tab tests
│   │   │       ├── ExportTab.test.tsx # Verify export settings flows
│   │   │       ├── GeneralTab.test.tsx # Verify general settings persistence
│   │   │       ├── ModelStorageTab.test.tsx # Verify model storage settings
│   │   │       ├── SystemInfoTab.test.tsx # Verify maintenance actions
│   │   │       └── TranscriptionTab.test.tsx # Verify transcription defaults flows
│   │   └── task-workbench/   # Upload queue, session config, and activity monitor
│   │       ├── task-workbench-summary.ts # Build workbench summary copy
│   │       ├── TaskWorkbenchActivityMonitor.tsx # Track active task outcomes
│   │       ├── TaskWorkbenchPage.tsx # Compose upload and task creation workspace
│   │       ├── TaskWorkbenchSessionConfig.tsx # Render task options and defaults controls
│   │       ├── TaskWorkbenchUploadQueue.tsx # Render upload queue and actions
│   │       └── __tests__/    # Task Workbench page tests
│   │           ├── task-workbench-summary.test.ts # Verify summary copy builder
│   │           ├── TaskWorkbenchActivityMonitor.test.tsx # Verify activity monitor behavior
│   │           ├── TaskWorkbenchPage.test.tsx # Verify workbench composition
│   │           ├── TaskWorkbenchSessionConfig.test.tsx # Verify session config behavior
│   │           └── TaskWorkbenchUploadQueue.test.tsx # Verify upload queue behavior
│   │
│   ├── shell/                # Product shell and Activity Center
│   │   ├── ActivityCenterSheet.tsx # Activity Center side sheet
│   │   ├── AppLocaleController.tsx # Keep route locale and i18n in sync
│   │   ├── AppShell.tsx      # Compose sidebar, top bar, polling, bridge, outlet, toaster
│   │   ├── AppSidebar.tsx    # Left navigation
│   │   ├── AppTopBar.tsx     # Top navigation actions
│   │   └── __tests__/        # Shell component tests
│   │       ├── ActivityCenterSheet.test.tsx # Verify Activity Center rendering
│   │       ├── AppShell.test.tsx # Verify shell composition
│   │       ├── AppSidebar.test.tsx # Verify sidebar navigation
│   │       └── AppTopBar.test.tsx # Verify top-bar actions
│   │
│   ├── test-utils/           # Shared test fixtures/helpers
│   │   ├── transcription-defaults.ts # Build config-driven transcription defaults fixtures
│   │   └── transcription-defaults.test.ts # Verify fixture merge semantics
│   │
│   └── routes/               # Route wrappers and URL query contracts
│       ├── AppShell.tsx      # Deprecated wrapper around shell/AppShell
│       ├── HistoryPage.tsx   # Deprecated wrapper around pages/history-center
│       ├── ModelsPage.tsx    # Deprecated wrapper around pages/models-management
│       ├── route-pages.tsx   # Lazy-loaded route page composition
│       ├── history-search.ts # History URL query normalize/build helpers
│       └── __tests__/        # Route helper tests
│           └── history-search.test.ts # Verify history search normalization
```

Keep generated or local-runtime directories such as `node_modules/`, `dist/`, and `.idea/` out of this tree.

### Recent Additions

- `src/app/locale/`: Keep locale routing, active locale detection, and UI preference store.
- `src/shell/`: Compose the product shell, locale controller, Activity Center, sidebar, and top bar.
- `src/layouts/`: Keep page workspace wrappers and Settings row/section primitives.
- `src/pages/`: Keep route page implementations outside `features/*`.
- `src/features/activity/`: Aggregate task/model activity into `needsAttention`, `inProgress`, and `recent`.
- `src/shared/lib/query-*`: Centralize TanStack Query keys, fetcher, and client defaults.
- `src/shared/lib/overlay-events.ts`: Coordinate mutually exclusive detail sheets and Activity Center.
- `src/components/theme-provider.tsx`: Apply app-owned light/dark/system theme without `next-themes`.

### Current Frontend Guardrails

- Keep Settings subpage content direct; do not add page-level title/description blocks inside each settings tab.
- Keep Settings controls compact and continuous; do not split one tab into separate heavy cards.
- Keep Task Workbench model selection read-only; prefer `last_loaded_model_id`, then `configured_model_id`, then a placeholder.
- Treat Task Workbench Advanced `Reset to Defaults` as a local draft reset; do not send a request until Save as Default.
- Show warning feedback when defaults save/reset succeeds but config refresh fails; do not show success in that partial-failure path.
- Show engine-defaults fetch errors with retry; do not render failed fetches as “no overrides”.
- Guard model mutations per `model_id`; use API-returned `configured_model_id` after select.
- Keep `Runtime` in model details as a placeholder until model family/backend terminology is settled.
- Keep Activity Center recent events for model download `completed`, `failed`, and `cancelled` terminal states.
- Keep upload completion as toast/upload-queue feedback, not Activity Center history.

---

## Frontend Architecture Conventions

> [!IMPORTANT]
> **Architecture Rules:**
>
> 1. **Feature Cohesion**: Keep feature logic colocated; add `components/`, `hooks/`, `lib/`, and `store/` only when that feature needs them.
> 2. **Barrel Exports**: Every feature with a public surface must expose it via an `index.ts`. External files should import from a feature index; keep internal helper-only feature folders private.
> 3. **Shared UI**: Put Nola design-system primitives in `src/components/ui/` or `src/layouts/`; do not add new design-system components under `src/components/common/`.
> 4. **Routing**: Keep route trees and route adapters in `router.tsx` / `src/routes/*`; keep page implementations in `src/pages/*`; keep product shell code in `src/shell/*`.
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
>     - Outside `src/features/*`, import public feature surfaces from `@/features/<name>`; do not deep import `@/features/<name>/**` unless the folder is explicitly helper-only and has no public barrel.
>     - Keep `@/features/settings/lib/ui-preferences` as a settings-page helper exception until it gains a public barrel or moves to `src/app/locale`.
>     - `src/components/common/*` must not import from `@/features/*`.
>     - Inside `src/features/<name>/*`, do not deep import from other features; import only via feature public entry.
> 13. **Feature Naming Boundary**:
>     - Use `src/features/tasks` for task lifecycle and history flows.
>     - Use `src/features/transcription-options` for option composition and defaults-patch logic.
>     - Do not create or restore `src/features/history` or `src/features/transcription`.
> 14. **Subdomain Composition Boundary**:
>     - Keep `transcription-options` independent from `tasks`.
>     - Compose `transcription-options` with `tasks` only in page or shell containers under `src/pages/*` and `src/shell/*`.
>     - Do not reintroduce compatibility re-export modules for removed legacy feature roots.
> 15. **Task API Path Boundary**:
>     - Use `/api/transcription-tasks/*` as runtime task endpoints.
>     - Do not add new frontend runtime clients for `/api/transcriptions/*` aliases.
> 16. **Locale Routing Boundary**:
>     - Use `src/app/locale/*` for locale-prefix parsing, route localization, and UI preference persistence.
>     - Let explicit Settings language changes rewrite the current route with a locale prefix.
>     - Keep the default locale path unprefixed until the user explicitly chooses a language.
> 17. **Theme Boundary**:
>     - Use the app-owned `ThemeProvider`, `useTheme`, and UI preferences store.
>     - Do not introduce new `next-themes` usage.
>     - Apply document theme before paint and serialize UI preference writes.
> 18. **Activity Boundary**:
>     - Keep Activity Center as a client aggregation layer over task polling, model settings, active downloads, and model SSE.
>     - Store structured route targets and data only; render labels in shell/i18n.
>     - Keep upload completion as toast/queue feedback, not Activity Center history.
> 19. **DataTable Boundary**:
>     - Disable select-all while loading, error, or empty states render.
>     - Ignore nested interactive controls when handling row clicks.
>     - Use keyboard activation only on the row element.
>
> [!IMPORTANT]
> Use `GET /api/config` and `GET /api/config/transcription/engine-defaults` as the only defaults source.
> Do not add new frontend calls to `/api/transcriptions/options/defaults`.
>
> [!NOTE]
> Use `router.tsx` and `src/routes/route-pages.tsx` as the active route composition entry.
> Keep `src/shell/AppShell.tsx` mounted to share navigation, task polling, ActivityDataBridge, and Toaster across routes.
> Keep `App.tsx` and `src/routes/AppShell.tsx` as deprecated compatibility wrappers only.
> Use `components/ui/sonner.tsx` through the app-owned theme context.

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
| next-themes             | ^0.4.6 (installed only; do not use for app theme state) |
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

- **activity**:
  - `ActivityDataBridge.tsx`: Sync task board state, model settings, active downloads, and model SSE terminal events into the activity store.
  - `store.ts`: Keep `needsAttention`, `inProgress`, `recent`, stable dismissal ids, sorted recent events, and route targets.
  - `index.ts`: Expose activity feature public exports.
- **upload**:
  - `api.ts`: Use `uploadFile` (FormData + progress + AbortSignal), `listFiles`, `getFile`, `deleteFile`, and `checkIntegrity`.
  - `components/FileDetailContent.tsx`: Render file metadata, associated tasks, safe missing-path display, and file actions.
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
  - `components/TaskDetailContent.tsx`: Render task detail dialog content; clamp progress display and normalize duration rounding before splitting time units.
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
- **settings**:
  - `lib/ui-preferences.ts`: Re-export UI preference helpers for settings-local tests and compatibility.
  - `lib/__tests__/locale-routing.test.ts`: Verify locale path parsing/localization edge cases.
  - `lib/__tests__/ui-preferences.test.ts`: Verify preference helper behavior from the settings boundary.
- **models**:
  - `api.ts`: Use model list/detail/download/cancel/delete/select/settings/download-runtime endpoints.
  - `__tests__/api.test.ts`: Verify model API request wiring.
  - `components/DownloadProgress.tsx`: Render real download percentage, transferred bytes, and speed.
  - `components/ModelCard.tsx`: Render one model card with status badges and contextual actions.
  - `components/ModelDetailContent.tsx`: Render model detail sheet with translated descriptions, safe runtime placeholder, and contextual footer actions.
  - `components/ModelList.tsx`: Compose the table model display using runtime download state and shared action-state helpers.
  - `hooks/useModels.ts`: Load model list/settings and preserve structured `AppError` semantics.
  - `hooks/useModelDownload.ts`: Merge REST baseline download state with SSE progress events.
  - `hooks/__tests__/useModels.test.ts`, `hooks/__tests__/useModelDownload.test.ts`: Verify model hook behavior.
  - `lib/model-helpers.ts`: Keep pure display helpers for sorting, byte formatting, action states, description resolution, and language splitting.
  - `lib/model-refresh.ts`: Broadcast model refresh events after downloads, deletes, and selection changes.
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

### src/components/ui/

Shared primitives and Nola design-system components.

- **DataTable.tsx**: Render selectable tables with loading, empty, and error states; disable select-all when no rendered rows are selectable; ignore nested interactive click targets before row-open actions.
- **DetailSheet.tsx**: Wrap Radix Dialog for centered dialogs and right-side sheets with shared header/body behavior.
- **StatusBadge.tsx**: Map task/model statuses to semantic badge styles and labels.
- **MetricCard.tsx**, **ProgressBar.tsx**, **EmptyState.tsx**: Provide shared page primitives for metrics, progress, and empty/error states.
- **sonner.tsx**: Render Sonner with the app-owned theme context.

### src/layouts/

Page-level layout primitives.

- **ContentCanvas.tsx**: Control workspace width/height variants and page padding.
- **SettingsLayout.tsx**: Keep Settings tabs inside the settings page; do not move General/Transcription/Export/Model Storage/System Info into the top bar.
- **FormRow.tsx** and **SectionHeader.tsx**: Keep settings pages as continuous compact rows with lightweight section labels.
- **PageHeader.tsx** and **TwoColumnLayout.tsx**: Compose page headers and Task Workbench columns.

### src/pages/

Route page implementations.

- **task-workbench/**: Compose upload queue, session config, Advanced side sheet, and session activity monitor. Keep model selection read-only until task-level `model_id` execution becomes effective.
- **history-center/**: Compose Task ID and Filename modes, URL search state, pagination, detail dialogs, export dialog loading, and file/task associated actions.
- **models-management/**: Compose model overview, model table, detail sheet, mutation de-duplication, canonical `configured_model_id` handling, and model refresh.
- **settings/**: Compose General, Transcription, Export, Model Storage, and System Info tabs. Keep subpage titles removed; show settings content directly.

### src/shell/

Application shell.

- **AppShell.tsx**: Mount sidebar, top bar, task polling, ActivityDataBridge, outlet, and Toaster.
- **AppLocaleController.tsx**: Keep route locale and i18n language synchronized.
- **ActivityCenterSheet.tsx**: Render needs-attention, in-progress, and recent activity from structured store items.
- **AppSidebar.tsx** and **AppTopBar.tsx**: Render primary navigation, theme action, activity badge, and shell actions.

### src/app/locale/

Locale routing and persisted UI preferences.

- **locale-routing.ts**: Parse, strip, and localize locale-prefixed paths without hardcoding one language.
- **ui-preferences-store.ts**: Hydrate preferences once, serialize writes, and persist language/theme/units.
- **use-active-locale.ts**: Read active locale from the current route.

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
- **lib/icons.ts**: Keep shared Lucide icon mappings.
- **lib/overlay-events.ts**: Broadcast close events between Activity Center and detail overlays.
- **lib/query-client.ts**: Keep TanStack Query retry/default behavior.
- **lib/query-fetcher.ts**: Wrap API calls for Query consumers.
- **lib/query-keys.ts**: Centralize query key factories for tasks, files, models, and config.
- **lib/sse-client.ts**: Shared EventSource wrapper with typed payloads and normalized API-base URL joining.
- **lib/__tests__/sse-client.test.ts**: Verify SSE connection wiring, event parsing, and cleanup.
- **lib/utils.ts**: `downloadBlob()` triggers browser file download from Blob (appends `<a>` to DOM, defers `URL.revokeObjectURL`).
- **lib/__tests__/**: Vitest unit tests for API-client mapping plus pure helpers (`error-factory`, `error-utils`, `file-validation`, `format`).
- **types/openapi.d.ts**: Auto-generated by `pnpm gen:types`. Never edit manually.
- **types/api-error.ts**: Backend error payload contracts (`ApiError`, `ValidationErrorItem`).
- **types/app-error.ts**: Frontend error contract (`AppError`: `code`, `i18nKey`, `params`, `retriable`).
- **types/config.ts**: Thin aliases for config contracts (`AppConfig`, `EngineDefaults`, `TranscriptionDefaultsUpdateRequest`).
- **types/file.ts**: Thin aliases over OpenAPI file schemas (`FileInfo`, `FileUploadResponse`, etc.).
- **types/model.ts**: Thin aliases over OpenAPI model schemas and active download contracts.
- **types/task.ts**: Thin aliases over OpenAPI task schemas + derived types (`TaskStatus`, `ExportFormat` from schema enums); task read responses now include reserved `model_id` context.
- **types/task-query.ts**: Shared query model for list toolbar and pagination contracts.
- **types/index.ts**: Barrel re-export for `import type { ... } from '@/shared/types'`.

### src/routes/

Keep route adapters and search-model helpers in this directory. Keep page implementations in `src/pages/*`.

- **AppShell.tsx**: Keep deprecated wrapper around `src/shell/AppShell`.
- **HistoryPage.tsx**: Keep deprecated wrapper around `src/pages/history-center/HistoryPage`.
- **ModelsPage.tsx**: Keep deprecated wrapper around `src/pages/models-management/ModelsPage`.
- **route-pages.tsx**: Lazy-load primary pages, settings tabs, and route loading fallbacks.
- **history-search.ts**: Normalize route search params and build task query model.

### src/lib/

Autogenerated by shadcn.

- **utils.ts**: Contains the canonical `cn()` utility for merging Tailwind classes with `clsx` and `tailwind-merge`. Do not duplicate `cn` in `shared/lib`.

### src/i18n/

i18next bootstrap and locale dictionaries.

- **index.ts**: Initialize i18next + react-i18next once and return the initialization promise.
- **locales/en.json**, **locales/zh.json**: Locale resource files.
Use `src/app/locale/*` for route-prefix language behavior and Settings-triggered persistent language changes.

### src/config/

Runtime config access and fallback constants.

- **api.ts**: Config endpoints (`fetchAppConfig`, `fetchEngineDefaults`, transcription defaults `PATCH`/`DELETE`, export defaults `GET/PATCH/DELETE`).
- **cache-invalidation.ts**: Refresh shared config, transcription defaults, and export defaults caches after mutations.
- **use-app-config.ts**: Shared config singleton store using `useSyncExternalStore`, plus `refreshAppConfig()`. Notify all mounted consumers when the shared snapshot changes.
- **ui-preferences.ts**: Normalize and validate language/theme/unit preferences from unknown persisted values.
- **ui-preferences-storage.ts**: Load unified UI preferences first, fall back to legacy `nola-*` keys, and swallow browser storage write failures.
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
   TanStack Query + React Hooks State + Feature Stores (Zustand)
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
| Theme            | App-owned `ThemeProvider` drives light/dark/system and persists via UI preferences |
