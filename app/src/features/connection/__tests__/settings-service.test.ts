import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CONNECTION_CONFIG_VERSION } from '@/config/connection-config'
import { MemoryConnectionConfigRepository } from '@/config/connection-config-storage'
import { createDesktopGatewayRemoteConnectionProfile } from '@/config/connection-profile'
import {
  resetActiveConnectionProfile,
  setActiveConnectionProfile,
} from '@/config/connection-runtime'
import {
  checkConnectionHealth,
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
    })
    expect(fetchImpl).toHaveBeenCalledWith('http://127.0.0.1:4310/api/config', {
      method: 'GET',
      mode: 'cors',
      cache: 'no-store',
    })
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
