# Web Static Deployment

## Release Artifact

Build the standalone Web artifact:

```bash
make release-check-version
make release-clean
make release-package-web
```

Output file:

```text
release-artifacts/<version>/Nola-<version>-web.zip
```

The archive root contains `index.html` and the frontend static assets. Extract the archive contents into the static site root for deployment.

`release-clean` rebuilds the entire version staging directory. Run it once before building the first artifact in a complete release workflow.

The Web static package contains only browser frontend assets. The Nola Core backend provides transcription, model downloads, the task queue, history, and live transcription.

## Static Server

The static server must provide an SPA fallback. Refreshing any frontend route must return `index.html`.

When configuring reverse proxy or static server routes, forward `/health` and `/api/*` to Core before applying the SPA fallback. The SPA fallback must not return `index.html` for these paths.

Recommended deployment layout:

```text
https://nola.example.com/       -> Web static files
https://nola.example.com/health -> Core /health
https://nola.example.com/api/*  -> Core /api/*
```

A same-origin reverse proxy keeps browser requests on the same origin and reduces CORS configuration.

## Backend Connection

When running `pnpm --dir app dev`, Vite proxies `/api` and `/health` to `http://localhost:8000`.

A static deployment resolves the Core address in this order:

1. The Core address saved on the Web Settings page, stored in browser `localStorage`.
2. The build-time `VITE_API_URL` and `VITE_WS_URL` values.
3. The static site origin.

The repository's `Release` workflow does not set `VITE_API_URL` or `VITE_WS_URL`, so both build-time addresses are empty. The Web release package produced by that workflow therefore uses same-origin Core routes by default.

Custom build-time addresses are embedded in the static assets:

```bash
VITE_API_URL=https://api.example.com \
VITE_WS_URL=wss://api.example.com \
make release-package-web
```

The `VITE_API_URL` and `VITE_WS_URL` values are fixed at build time. The Web Settings page handles runtime address switching.

Cross-origin Core configuration example:

```bash
NOLA_CORS_ORIGINS=https://app.example.com \
poetry -C core run uvicorn nola.main:app --host 0.0.0.0 --port 8000
```

Use `https://` for a remote Core address. When `VITE_WS_URL` is empty, the frontend derives a `ws://` or `wss://` address from the HTTP address.

## Public Deployment

- Expose the Core API over HTTPS through a reverse proxy or hosting layer.
- Expose the live transcription WebSocket over WSS.
- Add the Web site origin to the Core CORS allowlist for cross-origin deployment.
- Provide OAuth2, OIDC, an API token, or network access control through an external authentication layer at the public entry point.

## Verification

- Open the static site and confirm that the application page loads.
- Refresh a frontend route and confirm that the application page still loads.
- Confirm that the Settings connection check reports an available status.
- Confirm that an invalid CORS configuration shows `CORS blocked` / `CORS 阻止` in the connection check.
- Clear the saved Core address and confirm that same-origin Core routes work. A standalone static server should report the connection as unavailable.
- Confirm that Core handles `/health` and `/api/*` and that the SPA fallback does not return `index.html` with HTTP 200 for these paths. The connection check treats a successful HTTP response as available but does not validate the response content, so it incorrectly reports an HTTP 200 response containing `index.html` as available.
