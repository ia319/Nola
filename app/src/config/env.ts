/**
 * Centralized environment variable access.
 *
 * All env vars are read here. Business code must import from this module
 * instead of using `import.meta.env` directly.
 */
const env = {
  /** Backend API base URL. Empty string = same origin (Vite proxy in dev). */
  apiBaseUrl: import.meta.env.VITE_API_URL ?? '',

  /** WebSocket base URL for realtime transcription (future). */
  wsBaseUrl: import.meta.env.VITE_WS_URL ?? '',

  /** True when running `pnpm dev`. */
  isDev: import.meta.env.DEV,

  /** True when running `pnpm build`. */
  isProd: import.meta.env.PROD,
} as const

export default env
