import { type RuntimeEnvironment } from '@/lib/runtime-environment'

export const CONNECTION_MODES = ['managed-local', 'external-local', 'remote'] as const
export const CONNECTION_STATUSES = [
  'unconfigured',
  'checking',
  'available',
  'unreachable',
  'cors-blocked',
  'csp-blocked',
  'realtime-failed',
] as const

export type ConnectionMode = (typeof CONNECTION_MODES)[number]
export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number]

export type ConnectionProfileSource =
  | 'tauri-sidecar'
  | 'runtime-override'
  | 'default-local'
  | 'user-config'

export interface BaseConnectionProfile {
  mode: ConnectionMode
  httpOrigin: string
  wsOrigin: string
  source: ConnectionProfileSource
}

export interface ManagedLocalConnectionProfile extends BaseConnectionProfile {
  mode: 'managed-local'
  source: 'tauri-sidecar'
}

export interface ExternalLocalConnectionProfile extends BaseConnectionProfile {
  mode: 'external-local'
  source: 'runtime-override' | 'default-local' | 'user-config'
}

export interface RemoteConnectionProfile extends BaseConnectionProfile {
  mode: 'remote'
  source: 'runtime-override' | 'user-config'
}

export type ConnectionProfile =
  | ManagedLocalConnectionProfile
  | ExternalLocalConnectionProfile
  | RemoteConnectionProfile

export const DEFAULT_EXTERNAL_LOCAL_HTTP_ORIGIN = 'http://127.0.0.1:8000'
export const DEFAULT_EXTERNAL_LOCAL_WS_ORIGIN = 'ws://127.0.0.1:8000'

const LOOPBACK_HOSTNAMES = new Set(['127.0.0.1', 'localhost'])

function parseUrl(value: string, label: string): URL {
  const trimmed = value.trim()
  if (!trimmed) {
    throw new Error(`${label} URL is required`)
  }

  try {
    return new URL(trimmed)
  } catch {
    throw new Error(`${label} URL must be absolute`)
  }
}

function normalizeOrigin(value: string, label: string): string {
  const url = parseUrl(value, label)
  if (url.pathname !== '/' || url.search || url.hash) {
    throw new Error(`${label} URL must include only an origin`)
  }
  if (url.username || url.password) {
    throw new Error(`${label} URL must not include credentials`)
  }
  return url.origin
}

function normalizeLocalHttpOrigin(value: string): string {
  const origin = normalizeOrigin(value, 'Local backend')
  const url = new URL(origin)
  if (url.protocol !== 'http:') {
    throw new Error('Local backend URL must use http://')
  }
  if (!LOOPBACK_HOSTNAMES.has(url.hostname)) {
    throw new Error('Local backend URL must use localhost or 127.0.0.1')
  }
  return origin
}

function normalizeRemoteHttpOrigin(value: string): string {
  const origin = normalizeOrigin(value, 'Remote backend')
  const url = new URL(origin)
  if (url.protocol !== 'https:') {
    throw new Error('Remote backend URL must use https://')
  }
  return origin
}

export function deriveWebSocketOrigin(httpOrigin: string): string {
  const origin = normalizeOrigin(httpOrigin, 'Backend')
  const url = new URL(origin)
  if (url.protocol === 'http:') {
    url.protocol = 'ws:'
  } else if (url.protocol === 'https:') {
    url.protocol = 'wss:'
  } else if (url.protocol !== 'ws:' && url.protocol !== 'wss:') {
    throw new Error('Backend URL must use http://, https://, ws://, or wss://')
  }
  return url.origin
}

export function createExternalLocalConnectionProfile(
  httpOrigin: string = DEFAULT_EXTERNAL_LOCAL_HTTP_ORIGIN,
  source: ExternalLocalConnectionProfile['source'] = 'default-local',
): ExternalLocalConnectionProfile {
  const normalizedHttpOrigin = normalizeLocalHttpOrigin(httpOrigin)
  return {
    mode: 'external-local',
    httpOrigin: normalizedHttpOrigin,
    wsOrigin:
      normalizedHttpOrigin === DEFAULT_EXTERNAL_LOCAL_HTTP_ORIGIN
        ? DEFAULT_EXTERNAL_LOCAL_WS_ORIGIN
        : deriveWebSocketOrigin(normalizedHttpOrigin),
    source,
  }
}

export function createManagedLocalConnectionProfile(
  httpOrigin: string,
): ManagedLocalConnectionProfile {
  const normalizedHttpOrigin = normalizeLocalHttpOrigin(httpOrigin)
  return {
    mode: 'managed-local',
    httpOrigin: normalizedHttpOrigin,
    wsOrigin: deriveWebSocketOrigin(normalizedHttpOrigin),
    source: 'tauri-sidecar',
  }
}

export function createRemoteConnectionProfile(
  httpOrigin: string,
  source: RemoteConnectionProfile['source'] = 'user-config',
): RemoteConnectionProfile {
  const normalizedHttpOrigin = normalizeRemoteHttpOrigin(httpOrigin)
  return {
    mode: 'remote',
    httpOrigin: normalizedHttpOrigin,
    wsOrigin: deriveWebSocketOrigin(normalizedHttpOrigin),
    source,
  }
}

export function createConnectionProfileFromHttpOrigin(
  httpOrigin: string,
  source: 'runtime-override' | 'user-config',
): ExternalLocalConnectionProfile | RemoteConnectionProfile {
  const url = parseUrl(httpOrigin, 'Backend')
  if (url.protocol === 'http:') {
    return createExternalLocalConnectionProfile(httpOrigin, source)
  }
  if (url.protocol === 'https:') {
    return createRemoteConnectionProfile(httpOrigin, source)
  }
  throw new Error('Backend URL must use local http:// or remote https://')
}

export function getDefaultConnectionProfile(
  environment: RuntimeEnvironment,
): ConnectionProfile | null {
  return environment === 'tauri' ? createExternalLocalConnectionProfile() : null
}
