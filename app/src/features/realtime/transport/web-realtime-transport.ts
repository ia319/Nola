import { LiveRealtimeTransportError, mapServerErrorEvent, normalizeTransportError } from './errors'
import {
  LIVE_REALTIME_AUDIO_CHANNEL_COUNT,
  LIVE_REALTIME_AUDIO_ENCODING,
  LIVE_REALTIME_AUDIO_SAMPLE_RATE,
  LIVE_REALTIME_DEFAULT_CLIENT_CAPABILITIES,
  LIVE_REALTIME_PROTOCOL_VERSION,
  buildLiveRealtimeWebSocketUrl,
  parseLiveRealtimeServerEvent,
} from './protocol'
import type {
  LiveRealtimeAudioFrame,
  LiveRealtimeAudioPayload,
  LiveRealtimeClientControlEventInput,
  LiveRealtimeClientEvent,
  LiveRealtimeConnectOptions,
  LiveRealtimeConnectionState,
  LiveRealtimeDiagnosticsWavStartOptions,
  LiveRealtimeServerEvent,
  LiveRealtimeServerEventCallback,
  LiveRealtimeServerReadyEvent,
  LiveRealtimeTrackStartOptions,
  LiveRealtimeTrackStopOptions,
  LiveRealtimeTransport,
  LiveRealtimeTransportErrorShape,
  LiveRealtimeTransportStateCallback,
  LiveRealtimeTransportStateChange,
} from './types'

const LIVE_REALTIME_CONNECT_TIMEOUT_MS = 10_000

interface PendingConnect {
  resolve: (event: LiveRealtimeServerReadyEvent) => void
  reject: (error: LiveRealtimeTransportError) => void
  timeoutId: ReturnType<typeof setTimeout>
}

interface TrackRuntimeState {
  source: LiveRealtimeAudioFrame['source']
  nextSequence: number
}

export interface WebLiveRealtimeTransportOptions {
  baseUrl?: string
  connectTimeoutMs?: number
  eventIdFactory?: () => string
  sentAtFactory?: () => string
  nowMs?: () => number
  WebSocketCtor?: typeof WebSocket
}

export class WebLiveRealtimeTransport implements LiveRealtimeTransport {
  private socket: WebSocket | null = null
  private sessionId: string | null = null
  private pendingConnect: PendingConnect | null = null
  private readonly eventCallbacks = new Set<LiveRealtimeServerEventCallback>()
  private readonly stateCallbacks = new Set<LiveRealtimeTransportStateCallback>()
  private readonly tracks = new Map<string, TrackRuntimeState>()
  private readonly options: WebLiveRealtimeTransportOptions
  private expectedClose = false
  private connectionState: LiveRealtimeConnectionState = 'idle'

  constructor(options: WebLiveRealtimeTransportOptions = {}) {
    this.options = options
  }

  get state(): LiveRealtimeConnectionState {
    return this.connectionState
  }

  connect(
    sessionId: string,
    options: LiveRealtimeConnectOptions = {},
  ): Promise<LiveRealtimeServerReadyEvent> {
    if (this.connectionState !== 'idle') {
      return Promise.reject(
        new LiveRealtimeTransportError({
          code: 'transport_state_invalid',
          message: 'Realtime transport must be idle before connect',
        }),
      )
    }

    this.sessionId = sessionId
    this.expectedClose = false
    this.setState('connecting')

    return new Promise<LiveRealtimeServerReadyEvent>((resolve, reject) => {
      try {
        const WebSocketCtor = this.resolveWebSocketCtor()
        const url = buildLiveRealtimeWebSocketUrl(sessionId, this.options.baseUrl)
        const socket = new WebSocketCtor(url)
        socket.binaryType = 'arraybuffer'
        this.socket = socket

        this.pendingConnect = {
          resolve,
          reject,
          timeoutId: setTimeout(() => {
            const error = new LiveRealtimeTransportError({
              code: 'websocket_connect_failed',
              message: 'Realtime WebSocket handshake timed out',
            })
            this.fail(error)
            socket.close()
          }, this.options.connectTimeoutMs ?? LIVE_REALTIME_CONNECT_TIMEOUT_MS),
        }

        socket.onopen = () => {
          this.sendRawEvent({
            ...this.buildEnvelope('client.hello'),
            client_capabilities: {
              ...LIVE_REALTIME_DEFAULT_CLIENT_CAPABILITIES,
              ...options.clientCapabilities,
            },
          })
        }
        socket.onmessage = (event: MessageEvent<unknown>) => {
          this.handleSocketMessage(event)
        }
        socket.onerror = () => {
          this.fail(
            new LiveRealtimeTransportError({
              code: 'websocket_connect_failed',
              message: 'Realtime WebSocket connection failed',
            }),
          )
        }
        socket.onclose = (event: CloseEvent) => {
          this.handleSocketClose(event)
        }
      } catch (error) {
        const normalized = normalizeTransportError(error, {
          code: 'websocket_unavailable',
          message: 'Realtime WebSocket is unavailable',
        })
        this.fail(normalized)
        reject(normalized)
      }
    })
  }

  disconnect(code?: number, reason?: string): void {
    this.close(code, reason)
  }

  close(code = 1000, reason = 'client_close'): void {
    this.expectedClose = true
    this.rejectPendingConnect(
      new LiveRealtimeTransportError({
        code: 'websocket_closed',
        message: 'Realtime WebSocket was closed',
      }),
    )
    this.tracks.clear()

    const socket = this.socket
    this.socket = null
    if (socket && socket.readyState !== this.resolveWebSocketCtor().CLOSED) {
      socket.close(code, reason)
    }

    this.setState('closed')
  }

  sendControlEvent(event: LiveRealtimeClientControlEventInput): void {
    this.sendRawEvent({
      ...this.buildEnvelope(event.type),
      ...event,
    } as LiveRealtimeClientEvent)
  }

  startTrack(options: LiveRealtimeTrackStartOptions): void {
    this.sendControlEvent({
      type: 'track.start',
      source: options.source,
      sequence: 0,
      label: options.label,
      device_label: options.deviceLabel,
      sample_rate: options.sampleRate,
      channel_count: options.channelCount,
    })
  }

  sendAudioFrame(frame: LiveRealtimeAudioFrame): void {
    const payloadByteLength = getAudioPayloadByteLength(frame.payload)
    const trackState = this.tracks.get(frame.trackId)
    if (!trackState) {
      throw new LiveRealtimeTransportError({
        code: 'invalid_track',
        message: 'Realtime track is not ready',
      })
    }
    if (trackState.source !== frame.source || trackState.nextSequence !== frame.sequence) {
      throw new LiveRealtimeTransportError({
        code: 'audio_sequence_invalid',
        message: 'Realtime audio frame sequence is out of order',
      })
    }

    this.sendRawEvent({
      ...this.buildEnvelope('audio.frame'),
      track_id: frame.trackId,
      source: frame.source,
      sequence: frame.sequence,
      captured_at_ms: frame.capturedAtMs,
      duration_ms: frame.durationMs,
      byte_length: payloadByteLength,
      encoding: frame.encoding ?? LIVE_REALTIME_AUDIO_ENCODING,
      sample_rate: frame.sampleRate ?? LIVE_REALTIME_AUDIO_SAMPLE_RATE,
      channel_count: frame.channelCount ?? LIVE_REALTIME_AUDIO_CHANNEL_COUNT,
    })
    this.sendRawPayload(frame.payload)
    trackState.nextSequence = frame.sequence + 1
    this.setState('streaming')
  }

  stopTrack(trackId: string, options: LiveRealtimeTrackStopOptions = {}): void {
    const trackState = this.tracks.get(trackId)
    const source = options.source ?? trackState?.source
    const sequence = options.sequence ?? trackState?.nextSequence

    if (!source || sequence === undefined) {
      throw new LiveRealtimeTransportError({
        code: 'invalid_track',
        message: 'Realtime track is not ready',
      })
    }

    this.sendControlEvent({
      type: 'track.stop',
      track_id: trackId,
      source,
      sequence,
    })
    this.tracks.delete(trackId)
  }

  startDiagnosticsWav(options: LiveRealtimeDiagnosticsWavStartOptions = {}): void {
    this.sendControlEvent({
      type: 'diagnostics.wav.start',
      output_target: options.outputTarget,
      max_duration_ms: options.maxDurationMs,
      max_bytes: options.maxBytes,
      tracks: options.tracks,
    })
  }

  stopDiagnosticsWav(): void {
    this.sendControlEvent({ type: 'diagnostics.wav.stop' })
  }

  ping(): void {
    this.sendControlEvent({ type: 'client.ping' })
  }

  finish(): void {
    this.setState('finishing')
    this.sendControlEvent({ type: 'session.finish' })
  }

  onEvent(callback: LiveRealtimeServerEventCallback): () => void {
    this.eventCallbacks.add(callback)
    return () => {
      this.eventCallbacks.delete(callback)
    }
  }

  onStateChange(callback: LiveRealtimeTransportStateCallback): () => void {
    this.stateCallbacks.add(callback)
    return () => {
      this.stateCallbacks.delete(callback)
    }
  }

  private resolveWebSocketCtor(): typeof WebSocket {
    const WebSocketCtor = this.options.WebSocketCtor ?? globalThis.WebSocket
    if (!WebSocketCtor) {
      throw new LiveRealtimeTransportError({
        code: 'websocket_unavailable',
        message: 'Realtime WebSocket is unavailable',
      })
    }

    return WebSocketCtor
  }

  private handleSocketMessage(event: MessageEvent<unknown>): void {
    if (typeof event.data !== 'string') {
      this.fail(
        new LiveRealtimeTransportError({
          code: 'server_event_invalid',
          message: 'Realtime server sent a non-JSON event',
        }),
      )
      return
    }

    const serverEvent = parseLiveRealtimeServerEvent(event.data)
    if (!serverEvent) {
      this.fail(
        new LiveRealtimeTransportError({
          code: 'server_event_invalid',
          message: 'Realtime server event is invalid',
        }),
      )
      return
    }

    this.handleServerEvent(serverEvent)
  }

  private handleServerEvent(event: LiveRealtimeServerEvent): void {
    if (event.type === 'server.error') {
      this.fail(mapServerErrorEvent(event))
      this.emitEvent(event)
      return
    }

    if (event.type === 'server.ready') {
      this.resolvePendingConnect(event)
      this.setState('ready')
    } else if (event.type === 'track.ready') {
      if (event.track.ended_at) {
        this.tracks.delete(event.track.track_id)
      } else {
        this.tracks.set(event.track.track_id, {
          source: event.track.source,
          nextSequence: 0,
        })
        this.setState('streaming')
      }
    } else if (event.type === 'session.finished') {
      this.expectedClose = true
      this.tracks.clear()
      this.emitEvent(event)
      this.setState('closed')
      return
    }

    this.emitEvent(event)
  }

  private handleSocketClose(event: CloseEvent): void {
    this.socket = null
    this.tracks.clear()
    this.rejectPendingConnect(
      new LiveRealtimeTransportError({
        code: 'websocket_closed',
        message: event.reason || 'Realtime WebSocket closed before ready',
      }),
    )

    if (this.expectedClose || event.code === 1000) {
      this.setState('closed')
      return
    }

    this.setState('failed', {
      code: 'websocket_closed',
      message: event.reason || 'Realtime WebSocket closed unexpectedly',
      retryable: false,
    })
  }

  private sendRawEvent(event: LiveRealtimeClientEvent): void {
    const socket = this.requireOpenSocket()
    socket.send(JSON.stringify(stripUndefinedFields(event)))
  }

  private sendRawPayload(payload: LiveRealtimeAudioPayload): void {
    const socket = this.requireOpenSocket()
    socket.send(payload)
  }

  private requireOpenSocket(): WebSocket {
    const socket = this.socket
    if (!socket || socket.readyState !== this.resolveWebSocketCtor().OPEN) {
      throw new LiveRealtimeTransportError({
        code: 'transport_not_connected',
        message: 'Realtime transport is not connected',
      })
    }

    return socket
  }

  private buildEnvelope<TType extends LiveRealtimeClientEvent['type']>(type: TType) {
    if (!this.sessionId) {
      throw new LiveRealtimeTransportError({
        code: 'transport_not_connected',
        message: 'Realtime session is not connected',
      })
    }

    return {
      type,
      protocol_version: LIVE_REALTIME_PROTOCOL_VERSION,
      session_id: this.sessionId,
      event_id: this.createEventId(),
      sent_at: this.createSentAt(),
    }
  }

  private createEventId(): string {
    if (this.options.eventIdFactory) {
      return this.options.eventIdFactory()
    }

    if (globalThis.crypto?.randomUUID) {
      return `client-${globalThis.crypto.randomUUID()}`
    }

    return `client-${Date.now()}-${Math.random().toString(16).slice(2)}`
  }

  private createSentAt(): string {
    return this.options.sentAtFactory ? this.options.sentAtFactory() : new Date().toISOString()
  }

  private setState(
    state: LiveRealtimeConnectionState,
    error: LiveRealtimeTransportErrorShape | null = null,
  ): void {
    if (this.connectionState === state && error === null) {
      return
    }

    const previousState = this.connectionState
    this.connectionState = state

    const change: LiveRealtimeTransportStateChange = {
      state,
      previousState,
      changedAt: this.options.nowMs ? this.options.nowMs() : Date.now(),
      error,
    }

    for (const callback of this.stateCallbacks) {
      callback(change)
    }
  }

  private fail(error: LiveRealtimeTransportError): void {
    this.rejectPendingConnect(error)
    this.tracks.clear()
    this.setState('failed', error)
  }

  private resolvePendingConnect(event: LiveRealtimeServerReadyEvent): void {
    if (!this.pendingConnect) {
      return
    }

    clearTimeout(this.pendingConnect.timeoutId)
    this.pendingConnect.resolve(event)
    this.pendingConnect = null
  }

  private rejectPendingConnect(error: LiveRealtimeTransportError): void {
    if (!this.pendingConnect) {
      return
    }

    clearTimeout(this.pendingConnect.timeoutId)
    this.pendingConnect.reject(error)
    this.pendingConnect = null
  }

  private emitEvent(event: LiveRealtimeServerEvent): void {
    for (const callback of this.eventCallbacks) {
      callback(event)
    }
  }
}

export function createWebRealtimeTransport(
  options?: WebLiveRealtimeTransportOptions,
): LiveRealtimeTransport {
  return new WebLiveRealtimeTransport(options)
}

function getAudioPayloadByteLength(payload: LiveRealtimeAudioPayload): number {
  return payload.byteLength
}

function stripUndefinedFields(value: LiveRealtimeClientEvent): Record<string, unknown> {
  const payload: Record<string, unknown> = {}

  for (const [fieldName, fieldValue] of Object.entries(value)) {
    if (fieldValue !== undefined) {
      payload[fieldName] = fieldValue
    }
  }

  return payload
}
