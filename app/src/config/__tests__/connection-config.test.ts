import { describe, expect, it } from 'vitest'

import {
  CONNECTION_CONFIG_VERSION,
  createConnectionProfileFromConfig,
  normalizeStoredConnectionConfig,
  parseStoredConnectionConfig,
  serializeStoredConnectionConfig,
} from '../connection-config'

describe('connection config model', () => {
  it('normalizes external local configs to loopback origins', () => {
    expect(
      normalizeStoredConnectionConfig({
        version: CONNECTION_CONFIG_VERSION,
        mode: 'external-local',
        httpOrigin: ' http://localhost:8123/ ',
      }),
    ).toEqual({
      version: CONNECTION_CONFIG_VERSION,
      mode: 'external-local',
      httpOrigin: 'http://localhost:8123',
    })
  })

  it('normalizes remote configs to HTTPS origins', () => {
    expect(
      normalizeStoredConnectionConfig({
        version: CONNECTION_CONFIG_VERSION,
        mode: 'remote',
        httpOrigin: ' https://nola.example.com/ ',
      }),
    ).toEqual({
      version: CONNECTION_CONFIG_VERSION,
      mode: 'remote',
      httpOrigin: 'https://nola.example.com',
    })
  })

  it('rejects unsupported modes, versions, protocols, and path-bearing origins', () => {
    expect(
      normalizeStoredConnectionConfig({
        version: 2,
        mode: 'remote',
        httpOrigin: 'https://nola.example.com',
      }),
    ).toBeNull()
    expect(
      normalizeStoredConnectionConfig({
        version: CONNECTION_CONFIG_VERSION,
        mode: 'managed-local',
        httpOrigin: 'http://127.0.0.1:8000',
      }),
    ).toBeNull()
    expect(
      normalizeStoredConnectionConfig({
        version: CONNECTION_CONFIG_VERSION,
        mode: 'external-local',
        httpOrigin: 'http://192.168.1.10:8000',
      }),
    ).toBeNull()
    expect(
      normalizeStoredConnectionConfig({
        version: CONNECTION_CONFIG_VERSION,
        mode: 'remote',
        httpOrigin: 'https://nola.example.com/api',
      }),
    ).toBeNull()
  })

  it('returns null for corrupt JSON payloads', () => {
    expect(parseStoredConnectionConfig('{')).toBeNull()
  })

  it('serializes only the supported config fields', () => {
    const configWithToken = {
      version: CONNECTION_CONFIG_VERSION,
      mode: 'remote',
      httpOrigin: 'https://nola.example.com',
      accessToken: 'secret',
    } as const

    const serialized = serializeStoredConnectionConfig(configWithToken)

    expect(serialized).toBe(
      JSON.stringify({
        version: CONNECTION_CONFIG_VERSION,
        mode: 'remote',
        httpOrigin: 'https://nola.example.com',
      }),
    )
  })

  it('creates connection profiles from stored config', () => {
    expect(
      createConnectionProfileFromConfig({
        version: CONNECTION_CONFIG_VERSION,
        mode: 'remote',
        httpOrigin: 'https://nola.example.com',
      }),
    ).toEqual({
      mode: 'remote',
      httpOrigin: 'https://nola.example.com',
      wsOrigin: 'wss://nola.example.com',
      targetHttpOrigin: 'https://nola.example.com',
      targetWsOrigin: 'wss://nola.example.com',
      source: 'user-config',
      transport: 'direct',
    })
  })
})
