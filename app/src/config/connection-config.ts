import {
  createConnectionProfileFromHttpOrigin,
  createExternalLocalConnectionProfile,
  createRemoteConnectionProfile,
  type ConnectionProfile,
} from './connection-profile'

export const CONNECTION_CONFIG_VERSION = 1
export const CONNECTION_CONFIG_STORAGE_KEY = 'nola-connection-config'

export const PERSISTED_CONNECTION_MODES = ['external-local', 'remote'] as const

export type PersistedConnectionMode = (typeof PERSISTED_CONNECTION_MODES)[number]

export interface StoredConnectionConfig {
  version: typeof CONNECTION_CONFIG_VERSION
  mode: PersistedConnectionMode
  httpOrigin: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function isPersistedConnectionMode(value: unknown): value is PersistedConnectionMode {
  return typeof value === 'string' && PERSISTED_CONNECTION_MODES.some((mode) => mode === value)
}

export function normalizeStoredConnectionConfig(value: unknown): StoredConnectionConfig | null {
  if (!isRecord(value) || value.version !== CONNECTION_CONFIG_VERSION) {
    return null
  }

  if (!isPersistedConnectionMode(value.mode) || typeof value.httpOrigin !== 'string') {
    return null
  }

  try {
    if (value.mode === 'external-local') {
      const profile = createExternalLocalConnectionProfile(value.httpOrigin, 'user-config')
      return {
        version: CONNECTION_CONFIG_VERSION,
        mode: 'external-local',
        httpOrigin: profile.httpOrigin,
      }
    }

    const profile = createRemoteConnectionProfile(value.httpOrigin, 'user-config')
    return {
      version: CONNECTION_CONFIG_VERSION,
      mode: 'remote',
      httpOrigin: profile.httpOrigin,
    }
  } catch {
    return null
  }
}

export function parseStoredConnectionConfig(
  rawValue: string | null,
): StoredConnectionConfig | null {
  if (!rawValue) {
    return null
  }

  try {
    return normalizeStoredConnectionConfig(JSON.parse(rawValue))
  } catch {
    return null
  }
}

export function serializeStoredConnectionConfig(config: StoredConnectionConfig): string {
  const normalized = normalizeStoredConnectionConfig(config)
  if (!normalized) {
    throw new Error('Connection config is invalid')
  }

  return JSON.stringify(normalized)
}

export function createConnectionProfileFromConfig(
  config: StoredConnectionConfig,
): ConnectionProfile {
  const normalized = normalizeStoredConnectionConfig(config)
  if (!normalized) {
    throw new Error('Connection config is invalid')
  }

  return createConnectionProfileFromHttpOrigin(normalized.httpOrigin, 'user-config')
}
