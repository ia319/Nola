import { afterEach, describe, expect, it } from 'vitest'

import { createExternalLocalConnectionProfile } from '@/config/connection/profile'
import {
  resetActiveConnectionProfile,
  setActiveConnectionProfile,
} from '@/config/connection/runtime'
import { buildLiveRealtimeWebSocketUrl } from '../websocket-url'

describe('live realtime websocket URL builder', () => {
  afterEach(() => {
    resetActiveConnectionProfile('web')
  })

  it('builds websocket URLs from explicit HTTP and WS bases', () => {
    expect(buildLiveRealtimeWebSocketUrl('session 1', 'http://127.0.0.1:8000/')).toBe(
      'ws://127.0.0.1:8000/api/live/sessions/session%201/stream',
    )

    expect(buildLiveRealtimeWebSocketUrl('session-2', 'wss://nola.test/ws')).toBe(
      'wss://nola.test/api/live/sessions/session-2/stream',
    )
  })

  it('uses the active runtime websocket base when no explicit base is provided', () => {
    setActiveConnectionProfile(
      createExternalLocalConnectionProfile('http://localhost:8123', 'user-config'),
    )

    expect(buildLiveRealtimeWebSocketUrl('session-3')).toBe(
      'ws://localhost:8123/api/live/sessions/session-3/stream',
    )
  })
})
