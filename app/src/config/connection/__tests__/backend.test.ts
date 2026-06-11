import { describe, expect, it, vi } from 'vitest'

import {
  DESKTOP_BACKEND_HTTP_ORIGIN,
  DESKTOP_BACKEND_WS_ORIGIN,
  getApiBaseUrl,
  getRealtimeWebSocketBaseUrl,
} from '../backend'

vi.mock('../../env', () => ({
  default: {
    apiBaseUrl: '',
    wsBaseUrl: 'wss://example.test/realtime',
  },
}))

describe('backend runtime configuration', () => {
  it('keeps web REST traffic on the current origin for Vite proxy support', () => {
    expect(getApiBaseUrl('web')).toBe('')
  })

  it('routes desktop REST traffic to the manual local backend', () => {
    expect(getApiBaseUrl('tauri')).toBe(DESKTOP_BACKEND_HTTP_ORIGIN)
  })

  it('uses configured web websocket base outside the desktop runtime', () => {
    expect(getRealtimeWebSocketBaseUrl('web')).toBe('wss://example.test/realtime')
  })

  it('routes desktop websocket traffic to the manual local backend', () => {
    expect(getRealtimeWebSocketBaseUrl('tauri')).toBe(DESKTOP_BACKEND_WS_ORIGIN)
  })
})
