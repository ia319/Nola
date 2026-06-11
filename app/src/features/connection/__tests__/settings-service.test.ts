import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CONNECTION_CONFIG_VERSION } from '@/config/connection-config'
import { MemoryConnectionConfigRepository } from '@/config/connection-config-storage'
import {
  createDesktopGatewayRemoteConnectionProfile,
  createExternalLocalConnectionProfile,
} from '@/config/connection-profile'
import {
  resetActiveConnectionProfile,
  setActiveConnectionProfile,
} from '@/config/connection-runtime'
import {
  checkConnectionHealth,
  hasConnectionSettingsChanges,
  isCspViolationForOrigin,
  loadConnectionSettingsSnapshot,
  saveConnectionSettings,
} from '../settings-service'

const getDesktopConnectionRuntimeOptionsMock = vi.hoisted(() => vi.fn())
const loadDesktopConnectionConfigMock = vi.hoisted(() => vi.fn())
const saveDesktopConnectionConfigMock = vi.hoisted(() => vi.fn())
const clearDesktopConnectionConfigMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/tauri-api', () => ({
  getDesktopConnectionRuntimeOptions: getDesktopConnectionRuntimeOptionsMock,
  loadDesktopConnectionConfig: loadDesktopConnectionConfigMock,
  saveDesktopConnectionConfig: saveDesktopConnectionConfigMock,
  clearDesktopConnectionConfig: clearDesktopConnectionConfigMock,
}))

function createSecurityPolicyViolationEvent(blockedURI?: string): Event {
  const event = new Event('securitypolicyviolation') as Event & {
    blockedURI?: string
  }
  if (blockedURI !== undefined) {
    event.blockedURI = blockedURI
  }
  return event
}

describe('connection settings service', () => {
  beforeEach(() => {
    getDesktopConnectionRuntimeOptionsMock.mockResolvedValue({
      managedLocalHttpOrigin: null,
      gatewayHttpOrigin: null,
      backendUrl: null,
    })
    resetActiveConnectionProfile('web')
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
    resetActiveConnectionProfile('web')
  })

  it('loads desktop remote target configs for editing', async () => {
    const repository = new MemoryConnectionConfigRepository({
      version: CONNECTION_CONFIG_VERSION,
      mode: 'remote',
      httpOrigin: 'https://nola.example.com',
    })

    await expect(
      loadConnectionSettingsSnapshot({
        environment: 'tauri',
        repository,
      }),
    ).resolves.toMatchObject({
      activeProfile: {
        mode: 'remote',
        httpOrigin: 'https://nola.example.com',
        targetHttpOrigin: 'https://nola.example.com',
      },
      draft: {
        mode: 'remote',
        httpOrigin: 'https://nola.example.com',
      },
    })
  })

  it('saves desktop remote target configs when no gateway is active', async () => {
    const repository = new MemoryConnectionConfigRepository()

    await expect(
      saveConnectionSettings(
        {
          mode: 'remote',
          httpOrigin: 'https://nola.example.com',
        },
        {
          environment: 'tauri',
          repository,
        },
      ),
    ).resolves.toMatchObject({
      activeProfile: {
        mode: 'remote',
        httpOrigin: 'https://nola.example.com',
        targetHttpOrigin: 'https://nola.example.com',
      },
      draft: {
        mode: 'remote',
        httpOrigin: 'https://nola.example.com',
      },
    })
    await expect(repository.load()).resolves.toEqual({
      version: CONNECTION_CONFIG_VERSION,
      mode: 'remote',
      httpOrigin: 'https://nola.example.com',
    })
  })

  it('uses desktop gateway transport when saving a new remote target with gateway runtime support', async () => {
    const repository = new MemoryConnectionConfigRepository()
    getDesktopConnectionRuntimeOptionsMock.mockResolvedValue({
      managedLocalHttpOrigin: null,
      gatewayHttpOrigin: 'http://127.0.0.1:4310',
      backendUrl: null,
    })
    setActiveConnectionProfile(
      createDesktopGatewayRemoteConnectionProfile(
        'https://old.example.com',
        'http://127.0.0.1:4310',
        'user-config',
      ),
    )

    await expect(
      saveConnectionSettings(
        {
          mode: 'remote',
          httpOrigin: 'https://new.example.com',
        },
        {
          environment: 'tauri',
          repository,
        },
      ),
    ).resolves.toMatchObject({
      activeProfile: {
        mode: 'remote',
        httpOrigin: 'http://127.0.0.1:4310',
        targetHttpOrigin: 'https://new.example.com',
        transport: 'desktop-gateway',
      },
      draft: {
        mode: 'remote',
        httpOrigin: 'https://new.example.com',
      },
    })
  })

  it('checks saved desktop remote target health through the active gateway', async () => {
    const repository = new MemoryConnectionConfigRepository({
      version: CONNECTION_CONFIG_VERSION,
      mode: 'remote',
      httpOrigin: 'https://nola.example.com',
    })
    setActiveConnectionProfile(
      createDesktopGatewayRemoteConnectionProfile(
        'https://nola.example.com',
        'http://127.0.0.1:4310',
        'user-config',
      ),
    )
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status: 200 }))

    await expect(
      checkConnectionHealth(
        {
          mode: 'remote',
          httpOrigin: 'https://nola.example.com',
        },
        {
          environment: 'tauri',
          repository,
          fetchImpl,
        },
      ),
    ).resolves.toEqual({ status: 'available' })
    expect(fetchImpl).toHaveBeenCalledWith('http://127.0.0.1:4310/health', {
      method: 'GET',
      mode: 'cors',
      cache: 'no-store',
      signal: expect.any(AbortSignal),
    })
    expect(fetchImpl).toHaveBeenCalledWith('http://127.0.0.1:4310/api/config', {
      method: 'GET',
      mode: 'cors',
      cache: 'no-store',
      signal: expect.any(AbortSignal),
    })
  })

  it('reports runtime override warnings when loading settings falls back', async () => {
    getDesktopConnectionRuntimeOptionsMock.mockResolvedValue({
      managedLocalHttpOrigin: 'https://localhost:4310',
      gatewayHttpOrigin: null,
      backendUrl: null,
    })

    await expect(
      loadConnectionSettingsSnapshot({
        environment: 'tauri',
        repository: new MemoryConnectionConfigRepository(),
      }),
    ).resolves.toMatchObject({
      activeProfile: {
        mode: 'external-local',
        httpOrigin: 'http://127.0.0.1:8000',
      },
      warnings: [
        {
          code: 'invalid-managed-local-runtime-origin',
          reason: 'Local backend URL must use http://',
        },
      ],
    })
  })

  it('uses the active profile as the no-config dirty baseline', () => {
    expect(
      hasConnectionSettingsChanges(
        {
          mode: 'external-local',
          httpOrigin: 'http://127.0.0.1:8000',
        },
        null,
        null,
      ),
    ).toBe(true)

    expect(
      hasConnectionSettingsChanges(
        {
          mode: 'external-local',
          httpOrigin: 'http://127.0.0.1:8000',
        },
        null,
        createExternalLocalConnectionProfile(),
      ),
    ).toBe(false)
  })

  it('returns unreachable when a health probe reaches its deadline', async () => {
    vi.useFakeTimers()
    const fetchImpl = vi.fn<typeof fetch>(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal
          signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'))
          })
        }),
    )

    const result = checkConnectionHealth(
      {
        mode: 'external-local',
        httpOrigin: 'http://127.0.0.1:8000',
      },
      {
        environment: 'tauri',
        repository: new MemoryConnectionConfigRepository(),
        fetchImpl,
        timeoutMs: 10,
      },
    )

    await vi.advanceTimersByTimeAsync(10)
    await vi.advanceTimersByTimeAsync(10)

    await expect(result).resolves.toEqual({ status: 'unreachable' })
  })

  it('matches CSP violations only when blockedURI targets the checked origin', () => {
    expect(
      isCspViolationForOrigin(
        createSecurityPolicyViolationEvent('https://nola.example.com/api/config'),
        'https://nola.example.com',
      ),
    ).toBe(true)

    expect(
      isCspViolationForOrigin(
        createSecurityPolicyViolationEvent('https://other.example.com/api/config'),
        'https://nola.example.com',
      ),
    ).toBe(false)
    expect(
      isCspViolationForOrigin(createSecurityPolicyViolationEvent(), 'https://nola.example.com'),
    ).toBe(false)
    expect(
      isCspViolationForOrigin(
        createSecurityPolicyViolationEvent('inline'),
        'https://nola.example.com',
      ),
    ).toBe(false)
  })
})
