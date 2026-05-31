import { describe, expect, it, vi } from 'vitest'

import {
  buildLiveRealtimeWebSocketUrl,
  isLiveRealtimeServerEventType,
  parseLiveRealtimeServerEvent,
} from '../protocol'

vi.mock('@/config/backend', () => ({
  getRealtimeWebSocketBaseUrl: () => 'http://127.0.0.1:8000/',
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
    expect(isLiveRealtimeServerEventType('transcript.committed_partial')).toBe(true)
    expect(isLiveRealtimeServerEventType('transcript.preview')).toBe(true)
    expect(isLiveRealtimeServerEventType('client.hello')).toBe(false)
  })

  it('parses realtime transcript preview and committed events', () => {
    const preview = parseLiveRealtimeServerEvent(
      JSON.stringify({
        type: 'transcript.preview',
        protocol_version: 1,
        session_id: 'session-1',
        event_id: 'server-1',
        sent_at: '2026-05-06T00:00:00Z',
        transcript: {
          result_kind: 'preview',
          session_id: 'session-1',
          track_id: 'track-1',
          source: 'microphone',
          preview_index: 1,
          start_ms: 0,
          end_ms: 240,
          text: 'preview text',
          language: null,
          confidence: null,
          is_final: false,
        },
      }),
    )
    const committed = parseLiveRealtimeServerEvent(
      JSON.stringify({
        type: 'transcript.committed_partial',
        protocol_version: 1,
        session_id: 'session-1',
        event_id: 'server-2',
        sent_at: '2026-05-06T00:00:01Z',
        transcript: {
          result_kind: 'committed_partial',
          session_id: 'session-1',
          track_id: 'track-1',
          source: 'microphone',
          committed_index: 1,
          start_ms: 0,
          end_ms: 500,
          text: 'committed text',
          language: 'en',
          confidence: 0.7,
          is_final: false,
        },
      }),
    )

    expect(preview).toMatchObject({
      type: 'transcript.preview',
      transcript: { result_kind: 'preview', preview_index: 1 },
    })
    expect(committed).toMatchObject({
      type: 'transcript.committed_partial',
      transcript: { result_kind: 'committed_partial', committed_index: 1 },
    })
  })

  it('rejects transcript events without the expected result kind', () => {
    expect(
      parseLiveRealtimeServerEvent(
        JSON.stringify({
          type: 'transcript.final',
          protocol_version: 1,
          session_id: 'session-1',
          event_id: 'server-1',
          sent_at: '2026-05-06T00:00:00Z',
          transcript: {
            segment_id: 'segment-1',
            session_id: 'session-1',
            track_id: 'track-1',
            source: 'microphone',
            sequence: 1,
            start_ms: 0,
            end_ms: 1000,
            text: 'final text',
            language: null,
            confidence: null,
            is_final: true,
            created_at: '2026-05-06T00:00:00Z',
          },
        }),
      ),
    ).toBeNull()
  })

  it('parses runtime error codes from server events', () => {
    const event = parseLiveRealtimeServerEvent(
      JSON.stringify({
        type: 'server.error',
        protocol_version: 1,
        session_id: 'session-1',
        event_id: 'server-1',
        sent_at: '2026-05-06T00:00:00Z',
        error: {
          code: 'runtime_inference_failed',
          message: 'Realtime transcription inference failed',
        },
      }),
    )

    expect(event).toMatchObject({
      type: 'server.error',
      error: { code: 'runtime_inference_failed' },
    })
  })
})
