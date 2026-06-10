import { afterEach, beforeEach, describe, expect, it } from 'vitest'

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
    resetActiveConnectionProfile('web')
  })

  afterEach(() => {
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

  it('preserves desktop gateway transport when saving a new remote target', async () => {
    const repository = new MemoryConnectionConfigRepository()
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

  it('checks remote target health through the selected HTTPS origin', async () => {
    const fetchImpl = async () => new Response('{}', { status: 200 })

    await expect(
      checkConnectionHealth(
        {
          mode: 'remote',
          httpOrigin: 'https://nola.example.com',
        },
        {
          fetchImpl,
        },
      ),
    ).resolves.toEqual({ status: 'available' })
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
