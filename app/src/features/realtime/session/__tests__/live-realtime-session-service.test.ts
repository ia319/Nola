import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  LiveRealtimeSessionService,
  type CreateAudioCaptureRepositoryFunction,
  type CreateLiveSessionFunction,
  type CreateRealtimeTransportFunction,
} from '../live-realtime-session-service'
import type { LiveAudioCaptureRepository } from '../../capture/audio-capture-repository'
import { LiveCaptureError } from '../../capture/errors'
import type {
  LiveAudioLevel,
  LiveAudioSourceKind,
  LiveCaptureErrorCode,
  LiveCaptureSession,
  LiveCaptureState,
  LiveCaptureStateChange,
  RealtimeAudioFrame,
} from '../../capture/types'
import { useLiveRealtimeStore } from '../../store/live-realtime-store'
import type { LiveUnsubscribe } from '../../types'
import type {
  LiveRealtimeAudioFrame,
  LiveRealtimeClientControlEventInput,
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
  LiveRealtimeTranscriptFinalPayload,
  LiveRealtimeTranscriptPartialPayload,
} from '../../transport/types'
import type { CreateLiveSessionRequest, LiveSessionDetail, LiveTrack } from '@/shared/types'

afterEach(() => {
  useLiveRealtimeStore.getState().resetLiveRealtimeRuntimeState()
  vi.clearAllMocks()
})

describe('LiveRealtimeSessionService', () => {
  it('starts capture, creates tracks, forwards frames, and stores transcripts', async () => {
    const setup = createServiceSetup()

    await setup.service.start({
      title: 'Live test',
      sources: ['microphone', 'system'],
      microphoneCapture: {
        deviceId: 'temp-microphone-1',
      },
      diagnosticsWav: true,
    })

    expect(setup.createSession).toHaveBeenCalledWith({
      mode: 'streaming',
      title: 'Live test',
    })
    expect(setup.transport.connectCalls).toEqual(['session-1'])
    expect(setup.captureRepository.microphoneSessions).toHaveLength(1)
    expect(setup.captureRepository.systemSessions).toHaveLength(1)
    expect(setup.transport.trackStarts.map((track) => track.source)).toEqual([
      'microphone',
      'system',
    ])
    expect(setup.transport.diagnosticsStarts).toEqual([undefined])

    setup.captureRepository.microphoneSessions[0]?.emitFrame(audioFrame('microphone', 0))
    expect(setup.transport.audioFrames).toHaveLength(1)
    expect(setup.transport.audioFrames[0]).toMatchObject({
      trackId: 'track-microphone-1',
      source: 'microphone',
      sequence: 0,
      capturedAtMs: 0,
      durationMs: 20,
    })

    setup.transport.emitEvent(transcriptPartialEvent('session-1', 'track-microphone-1'))
    expect(
      useLiveRealtimeStore.getState().latestPartialsByTrackId['track-microphone-1']?.text,
    ).toBe('partial text')

    setup.transport.emitEvent(transcriptFinalEvent('session-1', 'track-microphone-1'))
    const state = useLiveRealtimeStore.getState()
    expect(state.latestPartialsByTrackId['track-microphone-1']).toBeUndefined()
    expect(state.finalTranscripts[0]?.text).toBe('final text')
  })

  it('stops capture, stops tracks, and finishes the live session', async () => {
    const setup = createServiceSetup()

    await setup.service.start({ sources: ['microphone'] })
    await setup.service.stop()

    expect(setup.captureRepository.microphoneSessions[0]?.stop).toHaveBeenCalledTimes(1)
    expect(setup.transport.stoppedTracks).toEqual(['track-microphone-1'])
    expect(setup.transport.finishCalls).toBe(1)
    expect(setup.transport.closeCalls).toBe(1)

    const state = useLiveRealtimeStore.getState()
    expect(state.runState).toBe('finished')
    expect(state.connectionState).toBe('closed')
    expect(state.tracksBySource).toEqual({})
  })

  it('cleans up transport when capture permission fails after connect', async () => {
    const setup = createServiceSetup()
    setup.captureRepository.microphoneError = new LiveCaptureError(
      'microphone_permission_denied',
      'Microphone permission denied',
    )

    await expect(setup.service.start({ sources: ['microphone'] })).rejects.toMatchObject({
      code: 'microphone_permission_denied',
      retryable: false,
    })

    expect(setup.transport.trackStarts).toHaveLength(0)
    expect(setup.transport.finishCalls).toBe(1)
    expect(setup.transport.closeCalls).toBe(1)

    const state = useLiveRealtimeStore.getState()
    expect(state.runState).toBe('failed')
    expect(state.lastError?.code).toBe('microphone_permission_denied')
  })

  it('stops active capture when the transport fails', async () => {
    const setup = createServiceSetup()

    await setup.service.start({ sources: ['microphone'] })
    setup.transport.fail({
      code: 'websocket_closed',
      message: 'Realtime WebSocket closed unexpectedly',
      retryable: false,
    })
    await flushAsyncWork()

    expect(setup.captureRepository.microphoneSessions[0]?.stop).toHaveBeenCalledTimes(1)
    expect(setup.transport.closeCalls).toBe(1)

    const state = useLiveRealtimeStore.getState()
    expect(state.runState).toBe('failed')
    expect(state.lastError?.code).toBe('websocket_closed')
  })
})

interface ServiceSetup {
  service: LiveRealtimeSessionService
  transport: MockRealtimeTransport
  captureRepository: MockCaptureRepository
  createSession: ReturnType<typeof vi.fn<CreateLiveSessionFunction>>
}

class MockRealtimeTransport implements LiveRealtimeTransport {
  readonly connectCalls: string[] = []
  readonly trackStarts: LiveRealtimeTrackStartOptions[] = []
  readonly audioFrames: LiveRealtimeAudioFrame[] = []
  readonly stoppedTracks: string[] = []
  readonly diagnosticsStarts: Array<LiveRealtimeDiagnosticsWavStartOptions | undefined> = []
  closeCalls = 0
  finishCalls = 0
  private readonly eventCallbacks = new Set<LiveRealtimeServerEventCallback>()
  private readonly stateCallbacks = new Set<LiveRealtimeTransportStateCallback>()
  private connectionState: LiveRealtimeConnectionState = 'idle'
  private sessionId: string | null = null
  private trackIndexBySource = new Map<LiveAudioSourceKind, number>()

  get state(): LiveRealtimeConnectionState {
    return this.connectionState
  }

  async connect(sessionId: string): Promise<LiveRealtimeServerReadyEvent> {
    this.sessionId = sessionId
    this.connectCalls.push(sessionId)
    this.setState('connecting')
    this.setState('ready')
    const event = serverReadyEvent(sessionId)
    this.emitEvent(event)
    return event
  }

  disconnect(): void {
    this.close()
  }

  close(): void {
    this.closeCalls += 1
    this.setState('closed')
  }

  sendControlEvent(event: LiveRealtimeClientControlEventInput): void {
    if (event.type === 'session.finish') {
      this.finish()
    }
  }

  startTrack(options: LiveRealtimeTrackStartOptions): void {
    const sessionId = requireSessionId(this.sessionId)
    const nextIndex = (this.trackIndexBySource.get(options.source) ?? 0) + 1
    this.trackIndexBySource.set(options.source, nextIndex)
    this.trackStarts.push(options)
    this.emitEvent(
      trackReadyEvent(sessionId, `track-${options.source}-${nextIndex}`, options.source),
    )
  }

  sendAudioFrame(frame: LiveRealtimeAudioFrame): void {
    this.audioFrames.push(frame)
    this.setState('streaming')
  }

  stopTrack(trackId: string, _options?: LiveRealtimeTrackStopOptions): void {
    this.stoppedTracks.push(trackId)
  }

  startDiagnosticsWav(options?: LiveRealtimeDiagnosticsWavStartOptions): void {
    this.diagnosticsStarts.push(options)
  }

  stopDiagnosticsWav(): void {
    return
  }

  ping(): void {
    return
  }

  finish(): void {
    const sessionId = requireSessionId(this.sessionId)
    this.finishCalls += 1
    this.setState('finishing')
    this.emitEvent(sessionFinishedEvent(sessionId))
    this.setState('closed')
  }

  onEvent(callback: LiveRealtimeServerEventCallback): LiveUnsubscribe {
    this.eventCallbacks.add(callback)
    return () => {
      this.eventCallbacks.delete(callback)
    }
  }

  onStateChange(callback: LiveRealtimeTransportStateCallback): LiveUnsubscribe {
    this.stateCallbacks.add(callback)
    return () => {
      this.stateCallbacks.delete(callback)
    }
  }

  emitEvent(event: LiveRealtimeServerEvent): void {
    for (const callback of this.eventCallbacks) {
      callback(event)
    }
  }

  fail(error: LiveRealtimeTransportErrorShape): void {
    this.setState('failed', error)
  }

  private setState(
    state: LiveRealtimeConnectionState,
    error: LiveRealtimeTransportErrorShape | null = null,
  ): void {
    const previousState = this.connectionState
    this.connectionState = state
    const change: LiveRealtimeTransportStateChange = {
      state,
      previousState,
      changedAt: 1,
      error,
    }

    for (const callback of this.stateCallbacks) {
      callback(change)
    }
  }
}

class MockCaptureRepository implements LiveAudioCaptureRepository {
  readonly microphoneSessions: MockCaptureSession[] = []
  readonly systemSessions: MockCaptureSession[] = []
  microphoneError: LiveCaptureError | null = null
  systemError: LiveCaptureError | null = null

  async startMicrophoneCapture(): Promise<LiveCaptureSession> {
    if (this.microphoneError) {
      throw this.microphoneError
    }

    const session = new MockCaptureSession('microphone')
    this.microphoneSessions.push(session)
    return session
  }

  async startSystemAudioCapture(): Promise<LiveCaptureSession> {
    if (this.systemError) {
      throw this.systemError
    }

    const session = new MockCaptureSession('system')
    this.systemSessions.push(session)
    return session
  }
}

class MockCaptureSession implements LiveCaptureSession {
  readonly id: string
  readonly sourceKind: LiveAudioSourceKind
  readonly deviceId: string | null = null
  readonly startedAt = 1
  state: LiveCaptureState = 'capturing'
  private readonly frameCallbacks = new Set<(frame: RealtimeAudioFrame) => void>()
  private readonly stateCallbacks = new Set<(change: LiveCaptureStateChange) => void>()

  constructor(sourceKind: LiveAudioSourceKind) {
    this.sourceKind = sourceKind
    this.id = `capture-${sourceKind}`
  }

  stop = vi.fn(async (): Promise<void> => {
    this.state = 'stopped'
    this.emitState('stopped', null)
  })

  async pause(): Promise<void> {
    this.state = 'paused'
  }

  async resume(): Promise<void> {
    this.state = 'capturing'
  }

  onLevel(_callback: (level: LiveAudioLevel) => void): LiveUnsubscribe {
    return () => undefined
  }

  onAudioFrame(callback: (frame: RealtimeAudioFrame) => void): LiveUnsubscribe {
    this.frameCallbacks.add(callback)
    return () => {
      this.frameCallbacks.delete(callback)
    }
  }

  onStateChange(callback: (change: LiveCaptureStateChange) => void): LiveUnsubscribe {
    this.stateCallbacks.add(callback)
    return () => {
      this.stateCallbacks.delete(callback)
    }
  }

  emitFrame(frame: RealtimeAudioFrame): void {
    for (const callback of this.frameCallbacks) {
      callback(frame)
    }
  }

  fail(errorCode: LiveCaptureErrorCode): void {
    this.state = 'failed'
    this.emitState('failed', errorCode)
  }

  private emitState(state: LiveCaptureState, errorCode: LiveCaptureErrorCode | null): void {
    for (const callback of this.stateCallbacks) {
      callback({
        state,
        changedAt: 1,
        errorCode,
      })
    }
  }
}

function createServiceSetup(): ServiceSetup {
  const transport = new MockRealtimeTransport()
  const captureRepository = new MockCaptureRepository()
  const createSession = vi.fn<CreateLiveSessionFunction>(async (payload) =>
    liveSession('session-1', payload),
  )
  const createTransport: CreateRealtimeTransportFunction = async () => transport
  const createCaptureRepository: CreateAudioCaptureRepositoryFunction = async () =>
    captureRepository
  const service = new LiveRealtimeSessionService({
    createLiveSession: createSession,
    createRealtimeTransport: createTransport,
    createAudioCaptureRepository: createCaptureRepository,
    trackReadyTimeoutMs: 100,
    sessionFinishTimeoutMs: 100,
  })

  return {
    service,
    transport,
    captureRepository,
    createSession,
  }
}

function audioFrame(source: LiveAudioSourceKind, sequence: number): RealtimeAudioFrame {
  return {
    source,
    sequence,
    sampleRate: 16000,
    channelCount: 1,
    format: 'pcm_s16le',
    durationMs: 20,
    capturedAtMs: sequence * 20,
    payload: new ArrayBuffer(640),
  }
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
  source: LiveAudioSourceKind,
): LiveRealtimeServerEvent {
  return {
    ...serverEnvelope('track.ready', sessionId),
    track: liveTrack(sessionId, trackId, source),
  }
}

function transcriptPartialEvent(sessionId: string, trackId: string): LiveRealtimeServerEvent {
  return {
    ...serverEnvelope('transcript.partial', sessionId),
    transcript: partialTranscript(trackId),
  }
}

function transcriptFinalEvent(sessionId: string, trackId: string): LiveRealtimeServerEvent {
  return {
    ...serverEnvelope('transcript.final', sessionId),
    transcript: finalTranscript(sessionId, trackId),
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

function liveSession(
  sessionId: string,
  payload: Partial<CreateLiveSessionRequest> = {},
): LiveSessionDetail {
  return {
    session_id: sessionId,
    title: payload.title ?? null,
    mode: payload.mode ?? 'streaming',
    status: 'active',
    language_hint: payload.language_hint ?? null,
    model_id: payload.model_id ?? null,
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

function liveTrack(sessionId: string, trackId: string, source: LiveAudioSourceKind): LiveTrack {
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

function partialTranscript(trackId: string): LiveRealtimeTranscriptPartialPayload {
  return {
    track_id: trackId,
    source: 'microphone',
    partial_index: 1,
    start_ms: 0,
    end_ms: 500,
    text: 'partial text',
    language: null,
    confidence: null,
    is_final: false,
  }
}

function finalTranscript(sessionId: string, trackId: string): LiveRealtimeTranscriptFinalPayload {
  return {
    segment_id: 'segment-1',
    session_id: sessionId,
    track_id: trackId,
    source: 'microphone',
    sequence: 1,
    start_ms: 0,
    end_ms: 1000,
    text: 'final text',
    language: null,
    confidence: null,
    is_final: true,
    created_at: '2026-05-06T00:00:00Z',
  }
}

function requireSessionId(sessionId: string | null): string {
  if (!sessionId) {
    throw new Error('Expected session id')
  }

  return sessionId
}

async function flushAsyncWork(): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
}
