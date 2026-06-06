import { afterEach, describe, expect, it, vi } from 'vitest'

import { createExternalLocalConnectionProfile } from '../connection-profile'
import {
  getActiveApiBaseUrl,
  getActiveConnectionProfile,
  getActiveWebSocketBaseUrl,
  resetActiveConnectionProfile,
  setActiveConnectionProfile,
  subscribeActiveConnectionProfile,
} from '../connection-runtime'

vi.mock('../env', () => ({
  default: {
    apiBaseUrl: '',
    wsBaseUrl: 'wss://example.test/realtime',
  },
}))

describe('connection runtime', () => {
  afterEach(() => {
    resetActiveConnectionProfile('web')
  })

  it('falls back to web environment configuration when no profile is active', () => {
    resetActiveConnectionProfile('web')

    expect(getActiveConnectionProfile()).toBeNull()
    expect(getActiveApiBaseUrl()).toBe('')
    expect(getActiveWebSocketBaseUrl()).toBe('wss://example.test/realtime')
  })

  it('exposes the active profile origins for network adapters', () => {
    const profile = createExternalLocalConnectionProfile('http://127.0.0.1:8123', 'user-config')

    setActiveConnectionProfile(profile)

    expect(getActiveConnectionProfile()).toEqual(profile)
    expect(getActiveApiBaseUrl()).toBe('http://127.0.0.1:8123')
    expect(getActiveWebSocketBaseUrl()).toBe('ws://127.0.0.1:8123')
  })

  it('notifies active profile subscribers until they unsubscribe', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeActiveConnectionProfile(listener)
    const profile = createExternalLocalConnectionProfile('http://localhost:8124', 'user-config')

    setActiveConnectionProfile(profile)
    unsubscribe()
    setActiveConnectionProfile(null)

    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith(profile)
  })
})
