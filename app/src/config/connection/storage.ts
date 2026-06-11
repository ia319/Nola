import { getRuntimeEnvironment, type RuntimeEnvironment } from '@/lib/runtime-environment'
import {
  clearDesktopConnectionConfig,
  loadDesktopConnectionConfig,
  saveDesktopConnectionConfig,
} from '@/lib/tauri-api'

import {
  CONNECTION_CONFIG_STORAGE_KEY,
  normalizeStoredConnectionConfig,
  parseStoredConnectionConfig,
  serializeStoredConnectionConfig,
  type StoredConnectionConfig,
} from './config'

export interface ConnectionConfigRepository {
  load(): Promise<StoredConnectionConfig | null>
  save(next: StoredConnectionConfig): Promise<void>
  clear(): Promise<void>
}

function getBrowserStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.localStorage
  } catch {
    return null
  }
}

function requireBrowserStorage(): Storage {
  const storage = getBrowserStorage()
  if (!storage) {
    throw new Error('Connection config storage is unavailable')
  }
  return storage
}

export class BrowserConnectionConfigRepository implements ConnectionConfigRepository {
  async load(): Promise<StoredConnectionConfig | null> {
    const storage = getBrowserStorage()
    if (!storage) {
      return null
    }

    return parseStoredConnectionConfig(storage.getItem(CONNECTION_CONFIG_STORAGE_KEY))
  }

  async save(next: StoredConnectionConfig): Promise<void> {
    const storage = requireBrowserStorage()
    storage.setItem(CONNECTION_CONFIG_STORAGE_KEY, serializeStoredConnectionConfig(next))
  }

  async clear(): Promise<void> {
    const storage = getBrowserStorage()
    storage?.removeItem(CONNECTION_CONFIG_STORAGE_KEY)
  }
}

export class DesktopConnectionConfigRepository implements ConnectionConfigRepository {
  async load(): Promise<StoredConnectionConfig | null> {
    try {
      return parseStoredConnectionConfig(await loadDesktopConnectionConfig())
    } catch {
      return null
    }
  }

  async save(next: StoredConnectionConfig): Promise<void> {
    await saveDesktopConnectionConfig(serializeStoredConnectionConfig(next))
  }

  async clear(): Promise<void> {
    await clearDesktopConnectionConfig()
  }
}

export class MemoryConnectionConfigRepository implements ConnectionConfigRepository {
  private storedConfig: StoredConnectionConfig | null

  constructor(initialConfig: StoredConnectionConfig | null = null) {
    const normalized = initialConfig ? normalizeStoredConnectionConfig(initialConfig) : null
    this.storedConfig = normalized ? { ...normalized } : null
  }

  async load(): Promise<StoredConnectionConfig | null> {
    return this.storedConfig ? { ...this.storedConfig } : null
  }

  async save(next: StoredConnectionConfig): Promise<void> {
    const normalized = normalizeStoredConnectionConfig(next)
    if (!normalized) {
      throw new Error('Connection config is invalid')
    }
    this.storedConfig = { ...normalized }
  }

  async clear(): Promise<void> {
    this.storedConfig = null
  }
}

export function createConnectionConfigRepository(
  environment: RuntimeEnvironment = getRuntimeEnvironment(),
): ConnectionConfigRepository {
  return environment === 'tauri'
    ? new DesktopConnectionConfigRepository()
    : new BrowserConnectionConfigRepository()
}
