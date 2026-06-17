import { afterEach, describe, expect, it, vi } from 'vitest'

import type { DesktopCoreSidecarRuntimeStatusDto } from '@/lib/tauri-api'

import { CONNECTION_CONFIG_VERSION } from '../config'
import { MemoryConnectionConfigRepository } from '../storage'
import { resolveConnectionProfile, resolveConnectionProfileWithDiagnostics } from '../resolver'

const getDesktopConnectionRuntimeOptionsMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/tauri-api', () => ({
  getDesktopConnectionRuntimeOptions: getDesktopConnectionRuntimeOptionsMock,
}))

function createDesktopCoreSidecarStatus(
  overrides: Partial<DesktopCoreSidecarRuntimeStatusDto> = {},
): DesktopCoreSidecarRuntimeStatusDto {
  return {
    mode: 'unavailable',
    httpOrigin: null,
    apiStatus: 'failed',
    workerStatus: 'not-started',
    dataDir: null,
    logDir: null,
    error: 'desktop core sidecar executable was not found',
    ...overrides,
  }
}

describe('connection profile resolver', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('keeps backend-url runtime overrides ahead of managed local sidecar origins', async () => {
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
    ).resolves.toMatchObject({
      mode: 'remote',
      httpOrigin: 'https://override.example.com',
      source: 'runtime-override',
    })
  })

  it('keeps saved config ahead of managed local sidecar origins', async () => {
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
        },
      }),
    ).resolves.toMatchObject({
      mode: 'remote',
      httpOrigin: 'https://saved.example.com',
      source: 'user-config',
    })
  })

  it('uses managed local sidecar origins when no higher-priority source exists', async () => {
    await expect(
      resolveConnectionProfile({
        environment: 'tauri',
        repository: new MemoryConnectionConfigRepository(),
        runtimeOverrides: {
          managedLocalHttpOrigin: 'http://localhost:9000',
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

  it('ignores invalid managed-local runtime origins and keeps resolving other sources', async () => {
    await expect(
      resolveConnectionProfileWithDiagnostics({
        environment: 'tauri',
        repository: new MemoryConnectionConfigRepository(),
        runtimeOverrides: {
          managedLocalHttpOrigin: 'https://localhost:9000',
        },
      }),
    ).resolves.toMatchObject({
      profile: {
        mode: 'external-local',
        httpOrigin: 'http://127.0.0.1:8000',
        source: 'default-local',
      },
      warnings: [
        {
          code: 'invalid-managed-local-runtime-origin',
          reason: 'Local backend URL must use http://',
        },
      ],
    })
  })

  it('reports unavailable desktop core sidecar status when falling back to local defaults', async () => {
    await expect(
      resolveConnectionProfileWithDiagnostics({
        environment: 'tauri',
        repository: new MemoryConnectionConfigRepository(),
        runtimeOverrides: {
          coreSidecarStatus: createDesktopCoreSidecarStatus({
            logDir: 'C:/Users/example/AppData/Roaming/Nola/core/logs',
          }),
        },
      }),
    ).resolves.toMatchObject({
      profile: {
        mode: 'external-local',
        httpOrigin: 'http://127.0.0.1:8000',
        source: 'default-local',
      },
      warnings: [
        {
          code: 'desktop-core-sidecar-unavailable',
          reason:
            'desktop core sidecar executable was not found Logs: C:/Users/example/AppData/Roaming/Nola/core/logs',
        },
      ],
    })
  })

  it('reports desktop core sidecar worker failures while keeping the managed API profile', async () => {
    await expect(
      resolveConnectionProfileWithDiagnostics({
        environment: 'tauri',
        repository: new MemoryConnectionConfigRepository(),
        runtimeOverrides: {
          managedLocalHttpOrigin: 'http://localhost:9000',
          coreSidecarStatus: createDesktopCoreSidecarStatus({
            mode: 'managed-local',
            httpOrigin: 'http://localhost:9000',
            apiStatus: 'available',
            workerStatus: 'failed',
            dataDir: 'C:/Users/example/AppData/Roaming/Nola/core',
            logDir: 'C:/Users/example/AppData/Roaming/Nola/core/logs',
            error: 'managed core worker process is unavailable',
          }),
        },
      }),
    ).resolves.toMatchObject({
      profile: {
        mode: 'managed-local',
        httpOrigin: 'http://localhost:9000',
        source: 'tauri-sidecar',
      },
      warnings: [
        {
          code: 'desktop-core-sidecar-degraded',
          reason:
            'managed core worker process is unavailable Logs: C:/Users/example/AppData/Roaming/Nola/core/logs',
        },
      ],
    })
  })

  it('ignores invalid backend runtime URLs and falls back to saved config', async () => {
    const repository = new MemoryConnectionConfigRepository({
      version: CONNECTION_CONFIG_VERSION,
      mode: 'remote',
      httpOrigin: 'https://saved.example.com',
    })

    await expect(
      resolveConnectionProfileWithDiagnostics({
        environment: 'tauri',
        repository,
        runtimeOverrides: {
          backendUrl: 'http://nola.example.com',
        },
      }),
    ).resolves.toMatchObject({
      profile: {
        mode: 'remote',
        httpOrigin: 'https://saved.example.com',
        source: 'user-config',
      },
      warnings: [
        {
          code: 'invalid-backend-runtime-url',
          reason: 'Local backend URL must use localhost or 127.0.0.1',
        },
      ],
    })
  })

  it('keeps remote profiles direct when the desktop gateway origin is invalid', async () => {
    await expect(
      resolveConnectionProfileWithDiagnostics({
        environment: 'tauri',
        repository: new MemoryConnectionConfigRepository(),
        runtimeOverrides: {
          gatewayHttpOrigin: 'https://localhost:4311',
          backendUrl: 'https://override.example.com',
        },
      }),
    ).resolves.toMatchObject({
      profile: {
        mode: 'remote',
        httpOrigin: 'https://override.example.com',
        targetHttpOrigin: 'https://override.example.com',
        transport: 'direct',
      },
      warnings: [
        {
          code: 'invalid-desktop-gateway-runtime-origin',
          reason: 'Local backend URL must use http://',
        },
      ],
    })
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
