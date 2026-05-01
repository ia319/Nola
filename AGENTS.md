# AGENTS.md

This file is a compact routing guide for AI agents working on Nola. It points
to the detailed instruction files and explains which sections to read for each
kind of work. It does not replace those files.

## How To Use

- If work touches `app/`, read `app/AI_INSTRUCTIONS.md` before planning or
  editing.
- If work touches `core/`, read `core/AI_INSTRUCTIONS.md` before planning or
  editing.
- If work touches both workspaces, read both instruction files.
- After context compaction, a long pause, or uncertainty about architecture,
  commands, tests, APIs, or conventions, reread the relevant instruction file
  and section before continuing.

## app/AI_INSTRUCTIONS.md Index

- `Project Overview`: Identify the frontend workspace role and technology
  stack.
- `Code Style`: Apply frontend language, comment, and Prettier rules.
- `Directory Structure (Feature-First)`: Locate frontend files by ownership,
  feature, and shared layer.
- `Recent Additions`: Understand newer frontend modules and integration points.
- `Current Frontend Guardrails`: Check behavior and architecture rules that
  must not regress.
- `Frontend Architecture Conventions`: Follow feature boundaries, routing,
  state, API, UI, i18n, and testing conventions.
- `API Type Strategy`: Handle generated OpenAPI types and domain aliases
  without editing generated files manually.
- `Dependencies` and `Dev Dependencies`: Confirm frontend runtime and tooling
  assumptions.
- `Detailed Module Overview`: Find the purpose of specific frontend areas such
  as `src/features`, `src/components`, `src/layouts`, `src/pages`, `src/shell`,
  `src/shared`, `src/routes`, `src/i18n`, `src/config`, and `src/test`.
- `Dev Commands`: Choose the correct pnpm command for install, dev server,
  Storybook, type generation, formatting, linting, tests, and builds.
- `CI Contract`: Match frontend CI expectations before finishing changes.
- `Client-Server Architecture`: Understand how Vite, Axios, TanStack Query, and
  the backend API connect.
- `Limits & Notes`: Check frontend-visible limits such as upload formats, file
  size, polling interval, and theme ownership.

## core/AI_INSTRUCTIONS.md Index

- `Project Overview`: Identify the backend workspace role and technology stack.
- `Code Style`: Apply backend comment language and tone rules.
- `Directory Structure`: Locate backend files by layer, package, and runtime
  responsibility.
- `Recent Additions`: Understand newer backend modules and integration points.
- `Current Backend Guardrails`: Check behavior, worker, model, file, export, and
  task rules that must not regress.
- `Database Conventions`: Follow SQLite connection, atomic update, retry, and
  version requirements.
- `Dependencies` and `Dev Dependencies`: Confirm backend runtime and tooling
  assumptions.
- `Detailed Module Overview`: Find the purpose of backend areas such as
  `nola/models`, `nola/common`, `nola/model_hub`, `nola/engines`, `nola/api`,
  `nola/application`, `nola/services`, `nola/main.py`, `nola/config`, and
  `nola/utils`.
- `Transcription Rules`: Preserve transcription schema, defaults, execution
  config, validation, worker reload, and export behavior.
- `File and Model Rules`: Preserve file upload/delete behavior and model
  registry, download, cache, and locking behavior.
- `Dev Commands`: Choose the correct Poetry command for install, dev server,
  lint, format, type checking, tests, fixes, and worker startup.
- `CI Contract`: Match backend CI expectations before finishing changes.
- `Architecture`: Understand the FastAPI, application use-case, SQLite, worker,
  and engine flow.
- `API Reference`: Check endpoint contracts for config, files, models, and
  transcription tasks.
- `Task Lifecycle`: Understand task states, retries, timeout, dead-worker
  handling, and cancellation behavior.
- `Limits`: Check backend-enforced limits for file size, formats, retries,
  task timeout, and heartbeat timeout.

## Conflict Handling

- Treat the workspace-specific instruction file as authoritative for its
  workspace.
- If a requested change conflicts with the relevant instruction file, explain
  the conflict before editing.
