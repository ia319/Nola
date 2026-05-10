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
  LiveRealtimeTranscriptCommittedPartialPayload,
  LiveRealtimeTranscriptFinalPayload,
  LiveRealtimeTranscriptPreviewPayload,
} from '../../transport/types'
import { useLiveDeviceStore } from '../../store/live-device-store'
import type { CreateLiveSessionRequest, LiveSessionDetail, LiveTrack } from '@/shared/types'

afterEach(() => {
  useLiveRealtimeStore.getState().resetLiveRealtimeRuntimeState()
  useLiveDeviceStore.getState().resetLiveDeviceState()
  vi.clearAllMocks()
})

describe('LiveRealtimeSessionService', () => {
  it('starts capture, creates tracks, forwards frames, and stores transcripts', async () => {
    const setup = createServiceSetup()

    await setup.service.start({
      title: 'Live test',
      runtimeOverrides: {
        language: 'en',
        min_chunk_ms: 800,
      },
      sources: ['microphone', 'system'],
      microphoneCapture: {
        deviceId: 'temp-microphone-1',
      },
      diagnosticsWav: true,
    })

    expect(setup.createSession).toHaveBeenCalledWith({
      mode: 'streaming',
      title: 'Live test',
      runtime_overrides: {
        language: 'en',
        min_chunk_ms: 800,
      },
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
    setup.captureRepository.microphoneSessions[0]?.emitLevel({
      level: 0.52,
      peak: 0.6,
      isMutedLike: false,
      measuredAt: 1,
    })
    expect(useLiveDeviceStore.getState().microphoneCapture.level?.level).toBe(0.52)

    setup.transport.emitEvent(transcriptPreviewEvent('session-1', 'track-microphone-1'))
    expect(
      useLiveRealtimeStore.getState().currentPreviewsByTrackId['track-microphone-1']?.text,
    ).toBe('preview text')

    setup.transport.emitEvent(transcriptCommittedPartialEvent('session-1', 'track-microphone-1'))
    expect(
      useLiveRealtimeStore.getState().currentPreviewsByTrackId['track-microphone-1'],
    ).toBeUndefined()
    expect(
      useLiveRealtimeStore.getState().latestCommittedPartialsByTrackId['track-microphone-1']?.text,
    ).toBe('committed partial text')

    setup.transport.emitEvent(transcriptFinalEvent('session-1', 'track-microphone-1'))
    const state = useLiveRealtimeStore.getState()
    expect(state.latestCommittedPartialsByTrackId['track-microphone-1']).toBeUndefined()
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
    expect(useLiveDeviceStore.getState().microphoneCapture.state).toBe('stopped')
  })

  it('reuses provided capture sessions without starting a second browser capture', async () => {
    const setup = createServiceSetup()
    const systemSession = new MockCaptureSession('system')

    await setup.service.start({
      sources: ['system'],
      captureSessions: {
        system: systemSession,
      },
    })

    expect(setup.captureRepository.systemSessions).toHaveLength(0)
    expect(useLiveDeviceStore.getState().systemAudioCapture.sessionId).toBe(systemSession.id)

    systemSession.emitFrame(audioFrame('system', 0))

    expect(setup.transport.audioFrames[0]).toMatchObject({
      trackId: 'track-system-1',
      source: 'system',
      sequence: 0,
    })
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

  it('stops active capture when the transport fails without an error payload', async () => {
    const setup = createServiceSetup()

    await setup.service.start({ sources: ['microphone'] })
    setup.transport.fail()
    await flushAsyncWork()

    expect(setup.captureRepository.microphoneSessions[0]?.stop).toHaveBeenCalledTimes(1)
    expect(setup.transport.closeCalls).toBe(1)

    const state = useLiveRealtimeStore.getState()
    expect(state.runState).toBe('failed')
    expect(state.lastError?.code).toBe('websocket_closed')
  })

  it('fails start when the transport closes before track ready', async () => {
    const setup = createServiceSetup()
    setup.transport.closeAfterStartTrack = true

    await expect(setup.service.start({ sources: ['microphone'] })).rejects.toMatchObject({
      code: 'websocket_closed',
      retryable: false,
    })

    expect(setup.captureRepository.microphoneSessions[0]?.stop).toHaveBeenCalledTimes(1)
    expect(useLiveRealtimeStore.getState().runState).toBe('failed')
  })

  it('fails stop when the transport closes before session finished', async () => {
    const setup = createServiceSetup()
    setup.transport.finishEmitsSessionFinished = false

    await setup.service.start({ sources: ['microphone'] })

    await expect(setup.service.stop()).rejects.toMatchObject({
      code: 'websocket_closed',
      retryable: false,
    })

    expect(setup.service.state).toBe('failed')
    expect(useLiveRealtimeStore.getState().runState).toBe('failed')
  })

  it('marks the service failed when stopping capture fails', async () => {
    const setup = createServiceSetup()

    await setup.service.start({ sources: ['microphone'] })
    const microphoneSession = setup.captureRepository.microphoneSessions[0]!
    expect(microphoneSession).toBeDefined()
    microphoneSession.stopError = new Error('stop failed')

    await expect(setup.service.stop()).rejects.toMatchObject({
      code: 'live_session_stop_failed',
      message: 'stop failed',
      retryable: false,
    })

    expect(setup.service.state).toBe('failed')
    expect(setup.transport.closeCalls).toBe(1)
    expect(useLiveRealtimeStore.getState().runState).toBe('failed')
  })

  it('removes ended tracks and stops sending frames to them', async () => {
    const setup = createServiceSetup()

    await setup.service.start({ sources: ['microphone'] })
    setup.captureRepository.microphoneSessions[0]?.emitFrame(audioFrame('microphone', 0))
    expect(setup.transport.audioFrames).toHaveLength(1)

    setup.transport.emitEvent(
      trackReadyEvent('session-1', 'track-microphone-1', 'microphone', '2026-05-06T00:00:01Z'),
    )
    expect(useLiveRealtimeStore.getState().tracksBySource.microphone).toBeUndefined()

    setup.captureRepository.microphoneSessions[0]?.emitFrame(audioFrame('microphone', 1))
    expect(setup.transport.audioFrames).toHaveLength(1)
  })

  it('cleans up active capture when the server finishes the session', async () => {
    const setup = createServiceSetup()

    await setup.service.start({ sources: ['microphone'] })
    setup.transport.emitEvent(sessionFinishedEvent('session-1'))
    await flushAsyncWork()

    expect(setup.captureRepository.microphoneSessions[0]?.stop).toHaveBeenCalledTimes(1)
    expect(setup.transport.closeCalls).toBe(1)
    expect(setup.service.state).toBe('finished')

    const state = useLiveRealtimeStore.getState()
    expect(state.runState).toBe('finished')
    expect(state.connectionState).toBe('closed')
    expect(state.tracksBySource).toEqual({})
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
  closeAfterStartTrack = false
  finishEmitsSessionFinished = true
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
    if (this.closeAfterStartTrack) {
      this.close()
      return
    }

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
    if (this.finishEmitsSessionFinished) {
      this.emitEvent(sessionFinishedEvent(sessionId))
    }
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

  fail(error: LiveRealtimeTransportErrorShape | null = null): void {
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
  stopError: Error | null = null
  private readonly levelCallbacks = new Set<(level: LiveAudioLevel) => void>()
  private readonly frameCallbacks = new Set<(frame: RealtimeAudioFrame) => void>()
  private readonly stateCallbacks = new Set<(change: LiveCaptureStateChange) => void>()

  constructor(sourceKind: LiveAudioSourceKind) {
    this.sourceKind = sourceKind
    this.id = `capture-${sourceKind}`
  }

  stop = vi.fn(async (): Promise<void> => {
    if (this.stopError) {
      throw this.stopError
    }

    this.state = 'stopped'
    this.emitState('stopped', null)
  })

  async pause(): Promise<void> {
    this.state = 'paused'
  }

  async resume(): Promise<void> {
    this.state = 'capturing'
  }

  onLevel(callback: (level: LiveAudioLevel) => void): LiveUnsubscribe {
    this.levelCallbacks.add(callback)
    return () => {
      this.levelCallbacks.delete(callback)
    }
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

  emitLevel(level: LiveAudioLevel): void {
    for (const callback of this.levelCallbacks) {
      callback(level)
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
  endedAt: string | null = null,
): LiveRealtimeServerEvent {
  return {
    ...serverEnvelope('track.ready', sessionId),
    track: liveTrack(sessionId, trackId, source, endedAt),
  }
}

function transcriptCommittedPartialEvent(
  sessionId: string,
  trackId: string,
): LiveRealtimeServerEvent {
  return {
    ...serverEnvelope('transcript.committed_partial', sessionId),
    transcript: committedPartialTranscript(sessionId, trackId),
  }
}

function transcriptPreviewEvent(sessionId: string, trackId: string): LiveRealtimeServerEvent {
  return {
    ...serverEnvelope('transcript.preview', sessionId),
    transcript: previewTranscript(sessionId, trackId),
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

function liveTrack(
  sessionId: string,
  trackId: string,
  source: LiveAudioSourceKind,
  endedAt: string | null = null,
): LiveTrack {
  return {
    track_id: trackId,
    session_id: sessionId,
    source,
    label: null,
    device_label: null,
    sample_rate: 16000,
    channel_count: 1,
    started_at: '2026-05-06T00:00:00Z',
    ended_at: endedAt,
    created_at: '2026-05-06T00:00:00Z',
  }
}

function committedPartialTranscript(
  sessionId: string,
  trackId: string,
): LiveRealtimeTranscriptCommittedPartialPayload {
  return {
    result_kind: 'committed_partial',
    session_id: sessionId,
    track_id: trackId,
    source: 'microphone',
    committed_index: 1,
    start_ms: 0,
    end_ms: 500,
    text: 'committed partial text',
    language: null,
    confidence: null,
    is_final: false,
  }
}

function previewTranscript(
  sessionId: string,
  trackId: string,
): LiveRealtimeTranscriptPreviewPayload {
  return {
    result_kind: 'preview',
    session_id: sessionId,
    track_id: trackId,
    source: 'microphone',
    preview_index: 1,
    start_ms: 0,
    end_ms: 240,
    text: 'preview text',
    language: null,
    confidence: null,
    is_final: false,
  }
}

function finalTranscript(sessionId: string, trackId: string): LiveRealtimeTranscriptFinalPayload {
  return {
    result_kind: 'final',
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
