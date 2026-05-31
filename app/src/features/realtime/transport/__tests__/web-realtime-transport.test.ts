import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LiveRealtimeTransportError } from '../errors'
import { WebLiveRealtimeTransport } from '../web-realtime-transport'
import type {
  LiveRealtimeDiagnosticsWavStartedEvent,
  LiveRealtimeDiagnosticsWavStoppedEvent,
  LiveRealtimeServerErrorEvent,
  LiveRealtimeServerEvent,
  LiveRealtimeServerReadyEvent,
  LiveRealtimeTrackReadyEvent,
} from '../types'
import type { LiveSessionDetail, LiveTrack, LiveTrackSource } from '@/shared/types'

vi.mock('@/config/backend', () => ({
  getRealtimeWebSocketBaseUrl: () => 'http://127.0.0.1:8000/',
}))

type WebSocketSendData = Parameters<WebSocket['send']>[0]

class FakeWebSocket {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3
  static instances: FakeWebSocket[] = []

  readonly url: string
  readonly sent: WebSocketSendData[] = []
  readyState = FakeWebSocket.CONNECTING
  binaryType: BinaryType = 'blob'
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null

  constructor(url: string) {
    this.url = url
    FakeWebSocket.instances.push(this)
  }

  send(data: WebSocketSendData): void {
    this.sent.push(data)
  }

  close(code = 1000, reason = 'client_close'): void {
    this.readyState = FakeWebSocket.CLOSED
    this.onclose?.({ code, reason, wasClean: code === 1000 } as CloseEvent)
  }

  open(): void {
    this.readyState = FakeWebSocket.OPEN
    this.onopen?.({} as Event)
  }

  message(data: string): void {
    this.onmessage?.({ data } as MessageEvent<unknown>)
  }

  serverClose(code = 1000, reason = ''): void {
    this.readyState = FakeWebSocket.CLOSED
    this.onclose?.({ code, reason, wasClean: code === 1000 } as CloseEvent)
  }
}

const FakeWebSocketCtor = FakeWebSocket as unknown as typeof WebSocket

beforeEach(() => {
  FakeWebSocket.instances = []
})

describe('WebLiveRealtimeTransport', () => {
  it('connects with client.hello and resolves on server.ready', async () => {
    const transport = createTransport()
    const stateChanges: string[] = []
    transport.onStateChange((change) => {
      stateChanges.push(`${change.previousState}->${change.state}`)
    })

    const readyPromise = transport.connect('session-1', {
      clientCapabilities: {
        supports_diagnostics_wav: true,
      },
    })
    const socket = lastSocket()
    expect(socket.url).toBe('ws://127.0.0.1:8000/api/live/sessions/session-1/stream')

    socket.open()
    expect(readSentJson(socket, 0)).toMatchObject({
      type: 'client.hello',
      protocol_version: 1,
      session_id: 'session-1',
      client_capabilities: {
        supports_binary_audio: true,
        supports_diagnostics_wav: true,
        supports_system_audio: false,
      },
    })

    socket.message(JSON.stringify(serverReadyEvent('session-1')))

    await expect(readyPromise).resolves.toMatchObject({
      type: 'server.ready',
      session_id: 'session-1',
    })
    expect(transport.state).toBe('ready')
    expect(stateChanges).toEqual(['idle->connecting', 'connecting->ready'])
  })

  it('sends track lifecycle events and audio metadata before binary payload', async () => {
    const transport = createTransport()
    const readyPromise = connectAndOpen(transport)
    const socket = lastSocket()
    socket.message(JSON.stringify(serverReadyEvent('session-1')))
    await readyPromise

    transport.startTrack({
      source: 'microphone',
      deviceLabel: 'Default microphone',
      sampleRate: 16000,
      channelCount: 1,
    })
    expect(readSentJson(socket, 1)).toMatchObject({
      type: 'track.start',
      source: 'microphone',
      sequence: 0,
      device_label: 'Default microphone',
      sample_rate: 16000,
      channel_count: 1,
    })

    socket.message(JSON.stringify(trackReadyEvent('session-1', 'track-1', 'microphone')))
    const payload = new Int16Array(320)

    transport.sendAudioFrame({
      trackId: 'track-1',
      source: 'microphone',
      sequence: 0,
      capturedAtMs: 0,
      durationMs: 20,
      payload,
    })

    expect(readSentJson(socket, 2)).toMatchObject({
      type: 'audio.frame',
      track_id: 'track-1',
      source: 'microphone',
      sequence: 0,
      captured_at_ms: 0,
      duration_ms: 20,
      byte_length: 640,
      encoding: 'pcm_s16le',
      sample_rate: 16000,
      channel_count: 1,
    })
    expect(socket.sent[3]).toBeInstanceOf(Int16Array)
    expect(Array.from(socket.sent[3] as Int16Array)).toEqual(Array.from(payload))
    expect(transport.state).toBe('streaming')

    transport.stopTrack('track-1')
    expect(readSentJson(socket, 4)).toMatchObject({
      type: 'track.stop',
      track_id: 'track-1',
      source: 'microphone',
      sequence: 1,
    })
  })

  it('sends diagnostics controls and dispatches diagnostics server events', async () => {
    const transport = createTransport()
    const receivedEvents: LiveRealtimeServerEvent[] = []
    transport.onEvent((event) => {
      receivedEvents.push(event)
    })

    const readyPromise = connectAndOpen(transport)
    const socket = lastSocket()
    socket.message(JSON.stringify(serverReadyEvent('session-1')))
    await readyPromise

    transport.startDiagnosticsWav({
      outputTarget: 'default',
      maxDurationMs: 10_000,
      maxBytes: 1_024,
      tracks: ['track-1'],
    })
    expect(readSentJson(socket, 1)).toMatchObject({
      type: 'diagnostics.wav.start',
      output_target: 'default',
      max_duration_ms: 10000,
      max_bytes: 1024,
      tracks: ['track-1'],
    })

    socket.message(JSON.stringify(diagnosticsStartedEvent('session-1')))
    transport.stopDiagnosticsWav()
    expect(readSentJson(socket, 2)).toMatchObject({ type: 'diagnostics.wav.stop' })

    socket.message(JSON.stringify(diagnosticsStoppedEvent('session-1')))

    expect(receivedEvents.map((event) => event.type)).toEqual([
      'server.ready',
      'diagnostics.wav.started',
      'diagnostics.wav.stopped',
    ])
  })

  it('dispatches session.finished before reporting the expected closed state', async () => {
    const transport = createTransport()
    const readyPromise = connectAndOpen(transport)
    const socket = lastSocket()
    socket.message(JSON.stringify(serverReadyEvent('session-1')))
    await readyPromise

    const observed: string[] = []
    transport.onEvent((event) => {
      observed.push(`event:${event.type}:${transport.state}`)
    })
    transport.onStateChange((change) => {
      observed.push(`state:${change.state}`)
    })

    socket.message(JSON.stringify(sessionFinishedEvent('session-1')))

    expect(observed).toEqual(['event:session.finished:ready', 'state:closed'])
    expect(transport.state).toBe('closed')
  })

  it('maps server errors to failed state and connect rejection', async () => {
    const transport = createTransport()
    const errors: Array<LiveRealtimeTransportError | null> = []
    transport.onStateChange((change) => {
      errors.push(change.error instanceof LiveRealtimeTransportError ? change.error : null)
    })

    const readyPromise = connectAndOpen(transport)
    const socket = lastSocket()
    socket.message(JSON.stringify(serverErrorEvent('session-1', 'invalid_event')))

    await expect(readyPromise).rejects.toMatchObject({
      code: 'invalid_event',
      retryable: false,
    })
    expect(transport.state).toBe('failed')
    expect(errors.at(-1)).toMatchObject({ code: 'invalid_event' })
  })

  it('does not reconnect a used transport instance', async () => {
    const transport = createTransport()
    const readyPromise = connectAndOpen(transport)
    const socket = lastSocket()
    socket.message(JSON.stringify(serverReadyEvent('session-1')))
    await readyPromise

    transport.close()

    await expect(transport.connect('session-2')).rejects.toMatchObject({
      code: 'transport_state_invalid',
    })
  })
})

function createTransport(): WebLiveRealtimeTransport {
  let eventIndex = 0
  return new WebLiveRealtimeTransport({
    baseUrl: 'http://127.0.0.1:8000/',
    WebSocketCtor: FakeWebSocketCtor,
    eventIdFactory: () => `client-${++eventIndex}`,
    sentAtFactory: () => '2026-05-06T00:00:00Z',
    nowMs: () => 1000,
  })
}

function connectAndOpen(
  transport: WebLiveRealtimeTransport,
): Promise<LiveRealtimeServerReadyEvent> {
  const readyPromise = transport.connect('session-1')
  lastSocket().open()
  return readyPromise
}

function lastSocket(): FakeWebSocket {
  const socket = FakeWebSocket.instances.at(-1)
  if (!socket) {
    throw new Error('Expected a fake websocket instance')
  }

  return socket
}

function readSentJson(socket: FakeWebSocket, index: number): Record<string, unknown> {
  const value = socket.sent[index]
  if (typeof value !== 'string') {
    throw new Error(`Expected websocket payload ${index} to be JSON`)
  }

  return JSON.parse(value) as Record<string, unknown>
}

function serverReadyEvent(sessionId: string): LiveRealtimeServerReadyEvent {
  return {
    ...serverEnvelope('server.ready', sessionId),
    audio_contract: {
      encoding: 'pcm_s16le',
      byte_order: 'little_endian',
      sample_rate: 16000,
      channel_count: 1,
      frame_duration_ms_min: 20,
      frame_duration_ms_max: 100,
      frame_payload_bytes_max: 3200,
    },
    session: liveSession(sessionId),
  }
}

function trackReadyEvent(
  sessionId: string,
  trackId: string,
  source: LiveTrackSource,
): LiveRealtimeTrackReadyEvent {
  return {
    ...serverEnvelope('track.ready', sessionId),
    track: liveTrack(sessionId, trackId, source),
  }
}

function diagnosticsStartedEvent(sessionId: string): LiveRealtimeDiagnosticsWavStartedEvent {
  return {
    ...serverEnvelope('diagnostics.wav.started', sessionId),
    capture_id: 'capture-1',
    manifest_name: 'manifest.json',
    max_duration_ms: 10000,
    max_bytes: 1024,
    tracks: ['track-1'],
  }
}

function diagnosticsStoppedEvent(sessionId: string): LiveRealtimeDiagnosticsWavStoppedEvent {
  return {
    ...serverEnvelope('diagnostics.wav.stopped', sessionId),
    capture_id: 'capture-1',
    manifest_name: 'manifest.json',
    files: [
      {
        track_id: 'track-1',
        source: 'microphone',
        file_name: 'track.wav',
        duration_ms: 20,
        audio_byte_length: 640,
        file_byte_length: 684,
      },
    ],
    total_file_byte_length: 684,
    reason: 'client_stop',
  }
}

function sessionFinishedEvent(sessionId: string): LiveRealtimeServerEvent {
  return {
    ...serverEnvelope('session.finished', sessionId),
    session: {
      ...liveSession(sessionId),
      status: 'finished',
      ended_at: '2026-05-06T00:00:01Z',
    },
  }
}

function serverErrorEvent(
  sessionId: string,
  code: LiveRealtimeServerErrorEvent['error']['code'],
): LiveRealtimeServerErrorEvent {
  return {
    ...serverEnvelope('server.error', sessionId),
    error: {
      code,
      message: 'Realtime event is invalid',
    },
  }
}

function serverEnvelope<TType extends LiveRealtimeServerEvent['type']>(
  type: TType,
  sessionId: string,
) {
  return {
    type,
    protocol_version: 1,
    session_id: sessionId,
    event_id: `server-${type}`,
    sent_at: '2026-05-06T00:00:00Z',
  }
}

function liveTrack(sessionId: string, trackId: string, source: LiveTrackSource): LiveTrack {
  return {
    track_id: trackId,
    session_id: sessionId,
    source,
    label: null,
    device_label: null,
    sample_rate: 16000,
    channel_count: 1,
    started_at: '2026-05-06T00:00:00Z',
    ended_at: null,
    created_at: '2026-05-06T00:00:00Z',
  }
}

function liveSession(sessionId: string): LiveSessionDetail {
  return {
    session_id: sessionId,
    title: null,
    mode: 'streaming',
    status: 'active',
    language_hint: null,
    model_id: null,
    runtime: null,
    audio_format: null,
    started_at: '2026-05-06T00:00:00Z',
    ended_at: null,
    error: null,
    created_at: '2026-05-06T00:00:00Z',
    updated_at: '2026-05-06T00:00:00Z',
    tracks: [],
    segments: [],
    segment_total: 0,
    segment_limit: 100,
    segment_offset: 0,
  }
}
