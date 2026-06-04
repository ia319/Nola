import { describe, expect, it } from 'vitest'

import {
  CONNECTION_STATUSES,
  createExternalLocalConnectionProfile,
  createManagedLocalConnectionProfile,
  createRemoteConnectionProfile,
  deriveWebSocketOrigin,
  getDefaultConnectionProfile,
} from '../connection-profile'

describe('connection profile helpers', () => {
  it('defines connection statuses for the current unauthenticated connection flow', () => {
    expect(CONNECTION_STATUSES).toEqual([
      'unconfigured',
      'checking',
      'available',
      'unreachable',
      'cors-blocked',
      'csp-blocked',
      'realtime-failed',
    ])
  })

  it('builds the default external local profile for desktop development', () => {
    expect(createExternalLocalConnectionProfile()).toEqual({
      mode: 'external-local',
      httpOrigin: 'http://127.0.0.1:8000',
      wsOrigin: 'ws://127.0.0.1:8000',
      source: 'default-local',
    })
  })

  it('builds external local profiles from custom loopback origins', () => {
    expect(
      createExternalLocalConnectionProfile(' http://localhost:8123/ ', 'runtime-override'),
    ).toEqual({
      mode: 'external-local',
      httpOrigin: 'http://localhost:8123',
      wsOrigin: 'ws://localhost:8123',
      source: 'runtime-override',
    })
  })

  it('returns a desktop default profile and keeps web same-origin unconfigured', () => {
    expect(getDefaultConnectionProfile('tauri')).toMatchObject({
      mode: 'external-local',
      httpOrigin: 'http://127.0.0.1:8000',
    })
    expect(getDefaultConnectionProfile('web')).toBeNull()
  })

  it('builds managed local profiles from loopback HTTP origins', () => {
    expect(createManagedLocalConnectionProfile(' http://localhost:8123/ ')).toEqual({
      mode: 'managed-local',
      httpOrigin: 'http://localhost:8123',
      wsOrigin: 'ws://localhost:8123',
      source: 'tauri-sidecar',
    })
  })

  it('rejects local profiles outside loopback HTTP origins', () => {
    expect(() => createManagedLocalConnectionProfile('https://localhost:8123')).toThrow(
      'Local backend URL must use http://',
    )
    expect(() => createManagedLocalConnectionProfile('http://192.168.1.10:8123')).toThrow(
      'Local backend URL must use localhost or 127.0.0.1',
    )
  })

  it('builds remote profiles from HTTPS origins', () => {
    expect(createRemoteConnectionProfile(' https://nola.example.com/ ')).toEqual({
      mode: 'remote',
      httpOrigin: 'https://nola.example.com',
      wsOrigin: 'wss://nola.example.com',
      source: 'user-config',
    })
    expect(
      createRemoteConnectionProfile('https://override.example.com', 'runtime-override'),
    ).toEqual({
      mode: 'remote',
      httpOrigin: 'https://override.example.com',
      wsOrigin: 'wss://override.example.com',
      source: 'runtime-override',
    })
  })

  it('rejects remote profiles without HTTPS origins', () => {
    expect(() => createRemoteConnectionProfile('http://nola.example.com')).toThrow(
      'Remote backend URL must use https://',
    )
    expect(() => createRemoteConnectionProfile('https://nola.example.com/api')).toThrow(
      'Remote backend URL must include only an origin',
    )
  })

  it('derives websocket origins from HTTP and HTTPS origins', () => {
    expect(deriveWebSocketOrigin('http://127.0.0.1:8000')).toBe('ws://127.0.0.1:8000')
    expect(deriveWebSocketOrigin('https://nola.example.com')).toBe('wss://nola.example.com')
  })
})
