import { afterEach, describe, expect, it, vi } from 'vitest'

import { CONNECTION_CONFIG_VERSION } from '../connection-config'
import { MemoryConnectionConfigRepository } from '../connection-config-storage'
import { resolveConnectionProfile } from '../connection-profile-resolver'

const getDesktopConnectionRuntimeOptionsMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/tauri-api', () => ({
  getDesktopConnectionRuntimeOptions: getDesktopConnectionRuntimeOptionsMock,
}))

describe('connection profile resolver', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('prefers managed local sidecar origins over every other source', async () => {
    const repository = new MemoryConnectionConfigRepository({
      version: CONNECTION_CONFIG_VERSION,
      mode: 'remote',
      httpOrigin: 'https://saved.example.com',
    })

    await expect(
      resolveConnectionProfile({
        environment: 'tauri',
        repository,
        runtimeOverrides: {
          managedLocalHttpOrigin: 'http://localhost:9000',
          backendUrl: 'https://override.example.com',
        },
      }),
    ).resolves.toEqual({
      mode: 'managed-local',
      httpOrigin: 'http://localhost:9000',
      wsOrigin: 'ws://localhost:9000',
      source: 'tauri-sidecar',
    })
  })

  it('prefers backend-url runtime overrides over saved config', async () => {
    const repository = new MemoryConnectionConfigRepository({
      version: CONNECTION_CONFIG_VERSION,
      mode: 'remote',
      httpOrigin: 'https://saved.example.com',
    })

    await expect(
      resolveConnectionProfile({
        environment: 'tauri',
        repository,
        runtimeOverrides: {
          backendUrl: 'https://override.example.com',
        },
      }),
    ).resolves.toEqual({
      mode: 'remote',
      httpOrigin: 'https://override.example.com',
      wsOrigin: 'wss://override.example.com',
      source: 'runtime-override',
    })
  })

  it('accepts loopback backend-url runtime overrides as external local profiles', async () => {
    await expect(
      resolveConnectionProfile({
        environment: 'tauri',
        repository: new MemoryConnectionConfigRepository(),
        runtimeOverrides: {
          backendUrl: 'http://127.0.0.1:8123',
        },
      }),
    ).resolves.toEqual({
      mode: 'external-local',
      httpOrigin: 'http://127.0.0.1:8123',
      wsOrigin: 'ws://127.0.0.1:8123',
      source: 'runtime-override',
    })
  })

  it('uses saved config before desktop defaults', async () => {
    const repository = new MemoryConnectionConfigRepository({
      version: CONNECTION_CONFIG_VERSION,
      mode: 'remote',
      httpOrigin: 'https://saved.example.com',
    })

    await expect(
      resolveConnectionProfile({
        environment: 'tauri',
        repository,
        runtimeOverrides: {},
      }),
    ).resolves.toMatchObject({
      mode: 'remote',
      httpOrigin: 'https://saved.example.com',
      source: 'user-config',
    })
  })

  it('falls back to the desktop external local default when no config exists', async () => {
    await expect(
      resolveConnectionProfile({
        environment: 'tauri',
        repository: new MemoryConnectionConfigRepository(),
        runtimeOverrides: {},
      }),
    ).resolves.toEqual({
      mode: 'external-local',
      httpOrigin: 'http://127.0.0.1:8000',
      wsOrigin: 'ws://127.0.0.1:8000',
      source: 'default-local',
    })
  })

  it('keeps web same-origin unconfigured unless a saved advanced config exists', async () => {
    await expect(
      resolveConnectionProfile({
        environment: 'web',
        repository: new MemoryConnectionConfigRepository(),
      }),
    ).resolves.toBeNull()

    await expect(
      resolveConnectionProfile({
        environment: 'web',
        repository: new MemoryConnectionConfigRepository({
          version: CONNECTION_CONFIG_VERSION,
          mode: 'remote',
          httpOrigin: 'https://saved.example.com',
        }),
      }),
    ).resolves.toMatchObject({
      mode: 'remote',
      httpOrigin: 'https://saved.example.com',
      source: 'user-config',
    })
  })

  it('loads desktop runtime overrides when none are injected', async () => {
    getDesktopConnectionRuntimeOptionsMock.mockResolvedValueOnce({
      managedLocalHttpOrigin: null,
      backendUrl: 'https://override.example.com',
    })

    await expect(
      resolveConnectionProfile({
        environment: 'tauri',
        repository: new MemoryConnectionConfigRepository(),
      }),
    ).resolves.toMatchObject({
      mode: 'remote',
      httpOrigin: 'https://override.example.com',
      source: 'runtime-override',
    })
    expect(getDesktopConnectionRuntimeOptionsMock).toHaveBeenCalledTimes(1)
  })
})
