import { getRuntimeEnvironment, type RuntimeEnvironment } from '@/lib/runtime-environment'

import {
  DEFAULT_EXTERNAL_LOCAL_HTTP_ORIGIN,
  DEFAULT_EXTERNAL_LOCAL_WS_ORIGIN,
  getDefaultConnectionProfile,
} from './connection-profile'
import env from './env'

export const DESKTOP_BACKEND_HTTP_ORIGIN = DEFAULT_EXTERNAL_LOCAL_HTTP_ORIGIN
export const DESKTOP_BACKEND_WS_ORIGIN = DEFAULT_EXTERNAL_LOCAL_WS_ORIGIN

/** Return the REST API origin for the active app runtime. */
export function getApiBaseUrl(environment: RuntimeEnvironment = getRuntimeEnvironment()): string {
  const profile = getDefaultConnectionProfile(environment)
  return profile ? profile.httpOrigin : env.apiBaseUrl
}

/** Return the realtime WebSocket origin for the active app runtime. */
export function getRealtimeWebSocketBaseUrl(
  environment: RuntimeEnvironment = getRuntimeEnvironment(),
): string {
  const profile = getDefaultConnectionProfile(environment)
  return profile ? profile.wsOrigin : env.wsBaseUrl || env.apiBaseUrl
}
