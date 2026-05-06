import { describe, expect, it, vi } from 'vitest'

import {
  buildLiveRealtimeWebSocketUrl,
  isLiveRealtimeServerEventType,
  parseLiveRealtimeServerEvent,
} from '../protocol'

vi.mock('@/config/env', () => ({
  default: {
    apiBaseUrl: 'http://127.0.0.1:8000/',
    wsBaseUrl: '',
  },
}))

describe('live realtime protocol helpers', () => {
  it('builds websocket URLs from explicit HTTP and WS bases', () => {
    expect(buildLiveRealtimeWebSocketUrl('session 1', 'http://127.0.0.1:8000/')).toBe(
      'ws://127.0.0.1:8000/api/live/sessions/session%201/stream',
    )

    expect(buildLiveRealtimeWebSocketUrl('session-2', 'wss://nola.test/ws')).toBe(
      'wss://nola.test/api/live/sessions/session-2/stream',
    )
  })

  it('parses only versioned realtime server events', () => {
    const event = parseLiveRealtimeServerEvent(
      JSON.stringify({
        type: 'server.pong',
        protocol_version: 1,
        session_id: 'session-1',
        event_id: 'server-1',
        sent_at: '2026-05-06T00:00:00Z',
      }),
    )

    expect(event).toMatchObject({ type: 'server.pong', session_id: 'session-1' })
    expect(parseLiveRealtimeServerEvent('{')).toBeNull()
    expect(
      parseLiveRealtimeServerEvent(
        JSON.stringify({
          type: 'server.pong',
          protocol_version: 2,
          session_id: 'session-1',
          event_id: 'server-1',
          sent_at: '2026-05-06T00:00:00Z',
        }),
      ),
    ).toBeNull()
    expect(isLiveRealtimeServerEventType('transcript.final')).toBe(true)
    expect(isLiveRealtimeServerEventType('client.hello')).toBe(false)
  })
})
