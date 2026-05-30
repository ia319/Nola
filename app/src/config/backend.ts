import { getRuntimeEnvironment, type RuntimeEnvironment } from '@/lib/runtime-environment'

import env from './env'

export const DESKTOP_BACKEND_HTTP_ORIGIN = 'http://127.0.0.1:8000'
export const DESKTOP_BACKEND_WS_ORIGIN = 'ws://127.0.0.1:8000'

/** Return the REST API origin for the active app runtime. */
export function getApiBaseUrl(environment: RuntimeEnvironment = getRuntimeEnvironment()): string {
  return environment === 'tauri' ? DESKTOP_BACKEND_HTTP_ORIGIN : env.apiBaseUrl
}

/** Return the realtime WebSocket origin for the active app runtime. */
export function getRealtimeWebSocketBaseUrl(
  environment: RuntimeEnvironment = getRuntimeEnvironment(),
): string {
  return environment === 'tauri' ? DESKTOP_BACKEND_WS_ORIGIN : env.wsBaseUrl || env.apiBaseUrl
}
