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
      targetHttpOrigin: 'http://localhost:9000',
      targetWsOrigin: 'ws://localhost:9000',
      source: 'tauri-sidecar',
      transport: 'direct',
    })
  })

  it('keeps web backend-url runtime overrides ahead of saved config', async () => {
    const repository = new MemoryConnectionConfigRepository({
      version: CONNECTION_CONFIG_VERSION,
      mode: 'remote',
      httpOrigin: 'https://saved.example.com',
    })

    await expect(
      resolveConnectionProfile({
        environment: 'web',
        repository,
        runtimeOverrides: {
          backendUrl: 'https://override.example.com',
        },
      }),
    ).resolves.toEqual({
      mode: 'remote',
      httpOrigin: 'https://override.example.com',
      wsOrigin: 'wss://override.example.com',
      targetHttpOrigin: 'https://override.example.com',
      targetWsOrigin: 'wss://override.example.com',
      source: 'runtime-override',
      transport: 'direct',
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
      targetHttpOrigin: 'http://127.0.0.1:8123',
      targetWsOrigin: 'ws://127.0.0.1:8123',
      source: 'runtime-override',
      transport: 'direct',
    })
  })

  it('uses supported saved config before desktop defaults', async () => {
    const repository = new MemoryConnectionConfigRepository({
      version: CONNECTION_CONFIG_VERSION,
      mode: 'external-local',
      httpOrigin: 'http://localhost:8124',
    })

    await expect(
      resolveConnectionProfile({
        environment: 'tauri',
        repository,
        runtimeOverrides: {},
      }),
    ).resolves.toMatchObject({
      mode: 'external-local',
      httpOrigin: 'http://localhost:8124',
      source: 'user-config',
    })
  })

  it('routes desktop saved remote configs through the native gateway when available', async () => {
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
          gatewayHttpOrigin: 'http://127.0.0.1:4210',
        },
      }),
    ).resolves.toEqual({
      mode: 'remote',
      httpOrigin: 'http://127.0.0.1:4210',
      wsOrigin: 'ws://127.0.0.1:4210',
      targetHttpOrigin: 'https://saved.example.com',
      targetWsOrigin: 'wss://saved.example.com',
      source: 'user-config',
      transport: 'desktop-gateway',
    })
  })

  it('keeps desktop saved remote configs as target profiles when no gateway exists', async () => {
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
      targetHttpOrigin: 'https://saved.example.com',
      transport: 'direct',
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
      targetHttpOrigin: 'http://127.0.0.1:8000',
      targetWsOrigin: 'ws://127.0.0.1:8000',
      source: 'default-local',
      transport: 'direct',
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
      backendUrl: 'http://localhost:8125',
    })

    await expect(
      resolveConnectionProfile({
        environment: 'tauri',
        repository: new MemoryConnectionConfigRepository(),
      }),
    ).resolves.toMatchObject({
      mode: 'external-local',
      httpOrigin: 'http://localhost:8125',
      source: 'runtime-override',
    })
    expect(getDesktopConnectionRuntimeOptionsMock).toHaveBeenCalledTimes(1)
  })

  it('routes desktop backend-url remote overrides through the native gateway when available', async () => {
    getDesktopConnectionRuntimeOptionsMock.mockResolvedValueOnce({
      managedLocalHttpOrigin: null,
      gatewayHttpOrigin: 'http://localhost:4311',
      backendUrl: 'https://override.example.com',
    })

    await expect(
      resolveConnectionProfile({
        environment: 'tauri',
        repository: new MemoryConnectionConfigRepository(),
      }),
    ).resolves.toEqual({
      mode: 'remote',
      httpOrigin: 'http://localhost:4311',
      wsOrigin: 'ws://localhost:4311',
      targetHttpOrigin: 'https://override.example.com',
      targetWsOrigin: 'wss://override.example.com',
      source: 'runtime-override',
      transport: 'desktop-gateway',
    })
  })
})
