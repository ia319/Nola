# Nola Frontend

Nola frontend subproject

React, TypeScript, Vite, Tailwind CSS, TanStack Router, TanStack Query, Zustand, i18next, Axios, and Tauri stack; Web frontend application, Tauri desktop client, realtime audio capture client, backend connection settings, OpenAPI type consumption.

## Quick Start

Prerequisites: [Requirements](#requirements).

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
Web development backend: http://localhost:8000 through the Vite proxy
```

```bash
# Tauri desktop development client
pnpm tauri:dev
```

```text
Default desktop backend: http://127.0.0.1:8000
Remote backend: Settings > Connection or `--backend-url=https://nola.example.com`
```

## Backend Connection

| Runtime        | Default Target            | User Configuration                                   | Storage                    |
| -------------- | ------------------------- | ---------------------------------------------------- | -------------------------- |
| Web            | Same origin or Vite proxy | Settings > Connection, `VITE_API_URL`, `VITE_WS_URL` | Browser `localStorage`     |
| Desktop local  | `http://127.0.0.1:8000`   | Settings > Connection                                | Tauri app config directory |
| Desktop remote | HTTPS/WSS Nola Node       | Settings > Connection, `--backend-url`               | Tauri app config directory |

Connection target rules:

- Local backend origins: `http://localhost` or `http://127.0.0.1`
- Remote backend origins: `https://`
- WebSocket origin derivation: selected HTTP origin, `http` to `ws`, `https` to `wss`
- Active connection profile: API, SSE, and realtime WebSocket clients

Nola Node: deployed Nola backend API with Worker, data directory, and model cache.

Desktop remote mode:

- Tauri WebView: local loopback HTTP/WebSocket gateway
- Native gateway: configured HTTPS/WSS Nola Node
- Saved desktop connection settings: Tauri app config directory
- `--backend-url`: current desktop launch override over saved settings

Remote Web clients: backend CORS allow-list entry for the browser origin. Desktop remote mode: local gateway path. Backend deployment settings: `../core/README.md`.

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
- Default local backend address: `127.0.0.1:8000`
- Remote desktop backend transport: HTTPS/WSS required
- Realtime audio format: 16 kHz mono PCM16LE
- Desktop audio capture platform: Windows
- Frontend API type source: backend OpenAPI schema
