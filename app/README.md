# Nola Frontend

Nola frontend subproject

React, TypeScript, Vite, Tailwind CSS, TanStack Router, TanStack Query, Zustand, i18next, Axios, and Tauri stack; Web frontend application, Tauri desktop client, realtime audio capture client, OpenAPI type consumption.

## Quick Startup

Prerequisites: `Requirements` section.

```bash
# Frontend dependency installation
pnpm install
```

```bash
# Web frontend development server
pnpm dev
```

```text
Frontend address: http://localhost:5173
Default backend: http://127.0.0.1:8000
```

```bash
# Tauri desktop development client
pnpm tauri:dev
```

```text
Default desktop backend: http://127.0.0.1:8000
```

## Requirements

- Node.js 20.19+, 22.13+, or 24+
- pnpm 10+
- Rust stable
- Windows 10/11 for desktop audio capture and Windows installer builds
- Backend service: `http://127.0.0.1:8000`

## Development Commands

```bash
# ESLint check
pnpm lint

# Prettier format check
pnpm format:check

# TypeScript type check
pnpm typecheck

# Vitest tests
pnpm test

# Vite frontend bundle
pnpm build

# Full frontend quality check
pnpm check

# Frontend type generation from backend OpenAPI schema
pnpm gen:types

# Storybook development server
pnpm storybook

# Storybook static bundle
pnpm build-storybook
```

## Desktop Commands

```bash
# Rust format check
pnpm desktop:format:check

# Rust Clippy check
pnpm desktop:lint

# Rust tests
pnpm desktop:test

# Full desktop quality check
pnpm desktop:check

# Windows desktop installer bundle
pnpm desktop:build:windows
```

## Current Limits

- Frontend development address: `localhost:5173`
- Default backend address: `127.0.0.1:8000`
- Realtime audio format: 16 kHz mono PCM16LE
- Desktop audio capture platform: Windows
- Frontend API type source: backend OpenAPI schema
