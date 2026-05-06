import { createLiveSession as defaultCreateLiveSession } from '../api'
import type { LiveAudioCaptureRepository } from '../capture/audio-capture-repository'
import { createAudioCaptureRepository } from '../capture/audio-capture-repository'
import { LiveCaptureError } from '../capture/errors'
import type {
  LiveAudioSourceKind,
  LiveCaptureSession,
  LiveMicrophoneCaptureOptions,
  LiveSystemAudioCaptureOptions,
  RealtimeAudioFrame,
} from '../capture/types'
import {
  LIVE_REALTIME_AUDIO_CHANNEL_COUNT,
  LIVE_REALTIME_AUDIO_SAMPLE_RATE,
} from '../transport/protocol'
import { createRealtimeTransport } from '../transport/realtime-transport'
import { isLiveRealtimeTransportError } from '../transport/errors'
import type {
  LiveRealtimeConnectOptions,
  LiveRealtimeDiagnosticsWavStartOptions,
  LiveRealtimeServerEvent,
  LiveRealtimeTransport,
} from '../transport/types'
import type { LiveDurationMs, LiveUnsubscribe } from '../types'
import {
  useLiveRealtimeStore,
  type LiveRealtimeRunState,
  type LiveRealtimeRuntimeError,
  type LiveRealtimeRuntimeErrorCode,
} from '../store/live-realtime-store'
import type { CreateLiveSessionRequest, LiveSessionDetail, LiveTrack } from '@/shared/types'

const DEFAULT_SOURCES: LiveAudioSourceKind[] = ['microphone']
const DEFAULT_TRACK_READY_TIMEOUT_MS = 10_000
const DEFAULT_SESSION_FINISH_TIMEOUT_MS = 10_000

export type CreateLiveSessionFunction = (
  payload: CreateLiveSessionRequest,
) => Promise<LiveSessionDetail>

export type CreateRealtimeTransportFunction = () => Promise<LiveRealtimeTransport>

export type CreateAudioCaptureRepositoryFunction = () => Promise<LiveAudioCaptureRepository>

export interface LiveRealtimeSessionServiceDependencies {
  createLiveSession?: CreateLiveSessionFunction
  createRealtimeTransport?: CreateRealtimeTransportFunction
  createAudioCaptureRepository?: CreateAudioCaptureRepositoryFunction
  trackReadyTimeoutMs?: LiveDurationMs
  sessionFinishTimeoutMs?: LiveDurationMs
}

export interface LiveRealtimeSessionStartOptions {
  title?: string | null
  languageHint?: string | null
  modelId?: string | null
  sources?: LiveAudioSourceKind[]
  microphoneCapture?: LiveMicrophoneCaptureOptions
  systemAudioCapture?: LiveSystemAudioCaptureOptions
  connect?: LiveRealtimeConnectOptions
  diagnosticsWav?: LiveRealtimeDiagnosticsWavStartOptions | true
}

export class LiveRealtimeSessionError extends Error implements LiveRealtimeRuntimeError {
  readonly code: LiveRealtimeRuntimeErrorCode
  readonly retryable: boolean

  constructor(error: LiveRealtimeRuntimeError) {
    super(error.message)
    this.name = 'LiveRealtimeSessionError'
    this.code = error.code
    this.retryable = error.retryable
  }
}

export function isLiveRealtimeSessionError(value: unknown): value is LiveRealtimeSessionError {
  return value instanceof LiveRealtimeSessionError
}

export class LiveRealtimeSessionService {
  private readonly createLiveSession: CreateLiveSessionFunction
  private readonly createTransport: CreateRealtimeTransportFunction
  private readonly createCaptureRepository: CreateAudioCaptureRepositoryFunction
  private readonly trackReadyTimeoutMs: LiveDurationMs
  private readonly sessionFinishTimeoutMs: LiveDurationMs
  private readonly captureSessions = new Map<LiveAudioSourceKind, LiveCaptureSession>()
  private readonly tracksBySource = new Map<LiveAudioSourceKind, LiveTrack>()
  private readonly captureUnsubscribers: LiveUnsubscribe[] = []
  private readonly transportUnsubscribers: LiveUnsubscribe[] = []
  private transport: LiveRealtimeTransport | null = null
  private session: LiveSessionDetail | null = null
  private runState: LiveRealtimeRunState = 'idle'
  private failureCleanupPromise: Promise<void> | null = null

  constructor(dependencies: LiveRealtimeSessionServiceDependencies = {}) {
    this.createLiveSession = dependencies.createLiveSession ?? defaultCreateLiveSession
    this.createTransport = dependencies.createRealtimeTransport ?? createRealtimeTransport
    this.createCaptureRepository =
      dependencies.createAudioCaptureRepository ?? createAudioCaptureRepository
    this.trackReadyTimeoutMs = dependencies.trackReadyTimeoutMs ?? DEFAULT_TRACK_READY_TIMEOUT_MS
    this.sessionFinishTimeoutMs =
      dependencies.sessionFinishTimeoutMs ?? DEFAULT_SESSION_FINISH_TIMEOUT_MS
  }

  get sessionId(): string | null {
    return this.session?.session_id ?? null
  }

  get state(): LiveRealtimeRunState {
    return this.runState
  }

  async start(options: LiveRealtimeSessionStartOptions = {}): Promise<LiveSessionDetail> {
    this.requireState('idle', 'Live realtime session has already started')

    const sources = normalizeSources(options.sources)
    this.runState = 'starting'
    useLiveRealtimeStore.getState().setLiveRealtimeStarting()

    try {
      const session = await this.createLiveSession(buildCreateLiveSessionPayload(options))
      this.session = session
      useLiveRealtimeStore.getState().setLiveRealtimeSession(session)

      const transport = await this.createTransport()
      this.transport = transport
      this.bindTransport(transport)

      const ready = await transport.connect(session.session_id, options.connect)
      this.session = ready.session
      useLiveRealtimeStore.getState().setLiveRealtimeSession(ready.session)

      if (options.diagnosticsWav) {
        transport.startDiagnosticsWav(
          options.diagnosticsWav === true ? undefined : options.diagnosticsWav,
        )
      }

      const captureRepository = await this.createCaptureRepository()
      for (const source of sources) {
        await this.startSource(source, captureRepository, transport, options)
      }

      this.runState = 'active'
      useLiveRealtimeStore.getState().setLiveRealtimeActive()
      return ready.session
    } catch (error) {
      const normalized = normalizeLiveRealtimeSessionError(error, {
        code: 'live_session_start_failed',
        message: 'Live realtime session failed to start',
        retryable: false,
      })
      if (this.failureCleanupPromise) {
        await this.failureCleanupPromise
      } else {
        await this.cleanupAfterFailure(normalized)
      }
      throw new LiveRealtimeSessionError(normalized)
    }
  }

  async stop(): Promise<void> {
    if (this.failureCleanupPromise) {
      await this.failureCleanupPromise
      return
    }

    if (this.runState === 'idle' || this.runState === 'finished') {
      return
    }

    const transport = this.transport
    if (!transport) {
      this.resetRuntimeReferences()
      return
    }

    this.runState = 'finishing'
    useLiveRealtimeStore.getState().setLiveRealtimeFinishing()

    try {
      await this.stopCaptureSessions()
      this.stopTracks(transport)

      const sessionFinishedPromise = this.waitForSessionFinished(transport)
      transport.finish()
      const session = await sessionFinishedPromise
      this.session = session
      this.runState = 'finished'
      useLiveRealtimeStore.getState().setLiveRealtimeFinished(session)
    } catch (error) {
      const normalized = normalizeLiveRealtimeSessionError(error, {
        code: 'live_session_stop_failed',
        message: 'Live realtime session failed to stop',
        retryable: false,
      })
      useLiveRealtimeStore.getState().setLiveRealtimeFailure(normalized)
      throw new LiveRealtimeSessionError(normalized)
    } finally {
      this.closeTransport()
      this.resetRuntimeReferences()
    }
  }

  startDiagnosticsWav(options?: LiveRealtimeDiagnosticsWavStartOptions): void {
    this.requireActiveTransport().startDiagnosticsWav(options)
  }

  stopDiagnosticsWav(): void {
    this.requireActiveTransport().stopDiagnosticsWav()
  }

  private async startSource(
    source: LiveAudioSourceKind,
    captureRepository: LiveAudioCaptureRepository,
    transport: LiveRealtimeTransport,
    options: LiveRealtimeSessionStartOptions,
  ): Promise<void> {
    const captureSession = await this.startCaptureSession(source, captureRepository, options)
    this.captureSessions.set(source, captureSession)
    this.captureUnsubscribers.push(
      captureSession.onStateChange((change) => {
        if (change.state === 'failed') {
          this.handleRuntimeFailure(
            new LiveRealtimeSessionError(
              toRuntimeError({
                code: change.errorCode ?? fallbackCaptureErrorCode(source),
                message: 'Live capture session failed',
                retryable: false,
              }),
            ),
          )
        }
      }),
    )

    const trackReadyPromise = this.waitForTrackReady(source, transport)
    transport.startTrack({
      source,
      label: getTrackLabel(source),
      sampleRate: LIVE_REALTIME_AUDIO_SAMPLE_RATE,
      channelCount: LIVE_REALTIME_AUDIO_CHANNEL_COUNT,
    })
    const track = await trackReadyPromise
    this.tracksBySource.set(source, track)
    useLiveRealtimeStore.getState().setLiveRealtimeTrack(track)

    this.captureUnsubscribers.push(
      captureSession.onAudioFrame((frame) => {
        this.sendCaptureFrame(frame)
      }),
    )
  }

  private startCaptureSession(
    source: LiveAudioSourceKind,
    captureRepository: LiveAudioCaptureRepository,
    options: LiveRealtimeSessionStartOptions,
  ): Promise<LiveCaptureSession> {
    if (source === 'microphone') {
      return captureRepository.startMicrophoneCapture(options.microphoneCapture)
    }

    return captureRepository.startSystemAudioCapture(options.systemAudioCapture)
  }

  private sendCaptureFrame(frame: RealtimeAudioFrame): void {
    const transport = this.transport
    const track = this.tracksBySource.get(frame.source)

    if (!transport || !track || this.runState === 'finishing' || this.runState === 'finished') {
      return
    }

    try {
      transport.sendAudioFrame({
        trackId: track.track_id,
        source: frame.source,
        sequence: frame.sequence,
        capturedAtMs: frame.capturedAtMs,
        durationMs: frame.durationMs,
        payload: frame.payload,
        encoding: frame.format,
        sampleRate: frame.sampleRate,
        channelCount: frame.channelCount,
      })
    } catch (error) {
      this.handleRuntimeFailure(error)
    }
  }

  private bindTransport(transport: LiveRealtimeTransport): void {
    this.transportUnsubscribers.push(
      transport.onEvent((event) => {
        this.handleTransportEvent(event)
      }),
      transport.onStateChange((change) => {
        useLiveRealtimeStore.getState().setLiveRealtimeConnectionState(change)
        if (change.state === 'failed' && change.error) {
          this.handleRuntimeFailure(new LiveRealtimeSessionError(toRuntimeError(change.error)))
        }
      }),
    )
  }

  private handleTransportEvent(event: LiveRealtimeServerEvent): void {
    if (event.type === 'track.ready') {
      this.tracksBySource.set(event.track.source, event.track)
      useLiveRealtimeStore.getState().setLiveRealtimeTrack(event.track)
    } else if (event.type === 'transcript.partial') {
      useLiveRealtimeStore.getState().setLiveRealtimePartial(event.transcript)
    } else if (event.type === 'transcript.final') {
      useLiveRealtimeStore.getState().appendLiveRealtimeFinal(event.transcript)
    } else if (event.type === 'diagnostics.wav.started') {
      useLiveRealtimeStore.getState().setLiveRealtimeDiagnosticsStarted(event)
    } else if (event.type === 'diagnostics.wav.stopped') {
      useLiveRealtimeStore.getState().setLiveRealtimeDiagnosticsStopped(event)
    } else if (event.type === 'session.finished') {
      this.session = event.session
      if (this.runState === 'finishing') {
        useLiveRealtimeStore.getState().setLiveRealtimeFinished(event.session)
      }
    } else if (event.type === 'server.error') {
      useLiveRealtimeStore.getState().setLiveRealtimeFailure(
        toRuntimeError({
          code: event.error.code,
          message: event.error.message,
          retryable: false,
        }),
      )
    }
  }

  private waitForTrackReady(
    source: LiveAudioSourceKind,
    transport: LiveRealtimeTransport,
  ): Promise<LiveTrack> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        cleanup()
        reject(
          new LiveRealtimeSessionError({
            code: 'live_track_ready_timeout',
            message: 'Live realtime track did not become ready',
            retryable: false,
          }),
        )
      }, this.trackReadyTimeoutMs)

      const cleanup = createWaitCleanup([
        transport.onEvent((event) => {
          if (event.type === 'track.ready' && event.track.source === source) {
            cleanup()
            resolve(event.track)
          } else if (event.type === 'server.error') {
            cleanup()
            reject(
              new LiveRealtimeSessionError({
                code: event.error.code,
                message: event.error.message,
                retryable: false,
              }),
            )
          }
        }),
        transport.onStateChange((change) => {
          if (change.state === 'failed') {
            cleanup()
            reject(
              new LiveRealtimeSessionError(
                change.error
                  ? toRuntimeError(change.error)
                  : {
                      code: 'websocket_closed',
                      message: 'Live realtime transport failed',
                      retryable: false,
                    },
              ),
            )
          }
        }),
        () => {
          clearTimeout(timeoutId)
        },
      ])
    })
  }

  private waitForSessionFinished(transport: LiveRealtimeTransport): Promise<LiveSessionDetail> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        cleanup()
        reject(
          new LiveRealtimeSessionError({
            code: 'live_session_finish_timeout',
            message: 'Live realtime session finish timed out',
            retryable: false,
          }),
        )
      }, this.sessionFinishTimeoutMs)

      const cleanup = createWaitCleanup([
        transport.onEvent((event) => {
          if (event.type === 'session.finished') {
            cleanup()
            resolve(event.session)
          } else if (event.type === 'server.error') {
            cleanup()
            reject(
              new LiveRealtimeSessionError({
                code: event.error.code,
                message: event.error.message,
                retryable: false,
              }),
            )
          }
        }),
        transport.onStateChange((change) => {
          if (change.state === 'failed') {
            cleanup()
            reject(
              new LiveRealtimeSessionError(
                change.error
                  ? toRuntimeError(change.error)
                  : {
                      code: 'websocket_closed',
                      message: 'Live realtime transport failed',
                      retryable: false,
                    },
              ),
            )
          }
        }),
        () => {
          clearTimeout(timeoutId)
        },
      ])
    })
  }

  private handleRuntimeFailure(error: unknown): void {
    if (this.failureCleanupPromise || this.runState === 'finished') {
      return
    }

    const normalized = normalizeLiveRealtimeSessionError(error, {
      code: 'live_session_start_failed',
      message: 'Live realtime session failed',
      retryable: false,
    })
    this.failureCleanupPromise = this.cleanupAfterFailure(normalized)
  }

  private async cleanupAfterFailure(error: LiveRealtimeRuntimeError): Promise<void> {
    this.runState = 'failed'
    useLiveRealtimeStore.getState().setLiveRealtimeFailure(error)
    await this.stopCaptureSessionsBestEffort()

    const transport = this.transport
    if (transport) {
      this.stopTracksBestEffort(transport)
      if (transport.state === 'ready' || transport.state === 'streaming') {
        try {
          transport.finish()
        } catch {
          // Cleanup is best effort after the primary failure has been recorded.
        }
      }
      this.closeTransport()
    }

    this.resetRuntimeReferences()
  }

  private async stopCaptureSessions(): Promise<void> {
    runUnsubscribers(this.captureUnsubscribers)
    const sessions = [...this.captureSessions.values()]
    this.captureSessions.clear()

    let firstError: unknown = null
    for (const session of sessions) {
      try {
        await session.stop()
      } catch (error) {
        firstError ??= error
      }
    }

    if (firstError) {
      throw firstError
    }
  }

  private async stopCaptureSessionsBestEffort(): Promise<void> {
    try {
      await this.stopCaptureSessions()
    } catch {
      // Preserve the primary failure and continue transport cleanup.
    }
  }

  private stopTracks(transport: LiveRealtimeTransport): void {
    let firstError: unknown = null

    for (const track of this.tracksBySource.values()) {
      try {
        transport.stopTrack(track.track_id)
        useLiveRealtimeStore.getState().removeLiveRealtimeTrack(track.source)
      } catch (error) {
        firstError ??= error
      }
    }
    this.tracksBySource.clear()

    if (firstError) {
      throw firstError
    }
  }

  private stopTracksBestEffort(transport: LiveRealtimeTransport): void {
    try {
      this.stopTracks(transport)
    } catch {
      this.tracksBySource.clear()
    }
  }

  private closeTransport(): void {
    runUnsubscribers(this.transportUnsubscribers)
    this.transport?.close(1000, 'client_cleanup')
    this.transport = null
  }

  private resetRuntimeReferences(): void {
    this.captureSessions.clear()
    this.tracksBySource.clear()
    runUnsubscribers(this.captureUnsubscribers)
    runUnsubscribers(this.transportUnsubscribers)
    this.transport = null
  }

  private requireActiveTransport(): LiveRealtimeTransport {
    if (!this.transport || (this.runState !== 'active' && this.runState !== 'starting')) {
      throw new LiveRealtimeSessionError({
        code: 'live_session_state_invalid',
        message: 'Live realtime session is not active',
        retryable: false,
      })
    }

    return this.transport
  }

  private requireState(state: LiveRealtimeRunState, message: string): void {
    if (this.runState !== state) {
      throw new LiveRealtimeSessionError({
        code: 'live_session_state_invalid',
        message,
        retryable: false,
      })
    }
  }
}

export function createLiveRealtimeSessionService(
  dependencies?: LiveRealtimeSessionServiceDependencies,
): LiveRealtimeSessionService {
  return new LiveRealtimeSessionService(dependencies)
}

function buildCreateLiveSessionPayload(
  options: LiveRealtimeSessionStartOptions,
): CreateLiveSessionRequest {
  const payload: CreateLiveSessionRequest = {
    mode: 'streaming',
  }

  if (options.title !== undefined) {
    payload.title = options.title
  }
  if (options.languageHint !== undefined) {
    payload.language_hint = options.languageHint
  }
  if (options.modelId !== undefined) {
    payload.model_id = options.modelId
  }

  return payload
}

function normalizeSources(sources: LiveAudioSourceKind[] | undefined): LiveAudioSourceKind[] {
  const sourceSet = new Set(sources ?? DEFAULT_SOURCES)
  if (sourceSet.size === 0) {
    throw new LiveRealtimeSessionError({
      code: 'live_source_required',
      message: 'At least one live audio source is required',
      retryable: false,
    })
  }

  return [...sourceSet]
}

function getTrackLabel(source: LiveAudioSourceKind): string {
  return source === 'microphone' ? 'Microphone' : 'System audio'
}

function fallbackCaptureErrorCode(source: LiveAudioSourceKind): LiveRealtimeRuntimeErrorCode {
  return source === 'microphone' ? 'microphone_capture_failed' : 'system_audio_capture_failed'
}

function toRuntimeError(error: LiveRealtimeRuntimeError): LiveRealtimeRuntimeError {
  return {
    code: error.code,
    message: error.message,
    retryable: error.retryable,
  }
}

function normalizeLiveRealtimeSessionError(
  error: unknown,
  fallback: LiveRealtimeRuntimeError,
): LiveRealtimeRuntimeError {
  if (isLiveRealtimeSessionError(error)) {
    return toRuntimeError(error)
  }

  if (isLiveRealtimeTransportError(error)) {
    return {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
    }
  }

  if (error instanceof LiveCaptureError) {
    return {
      code: error.code,
      message: error.message,
      retryable: false,
    }
  }

  if (error instanceof Error && error.message) {
    return {
      ...fallback,
      message: error.message,
    }
  }

  return fallback
}

function createWaitCleanup(unsubscribers: LiveUnsubscribe[]): LiveUnsubscribe {
  let cleaned = false

  return () => {
    if (cleaned) {
      return
    }

    cleaned = true
    runUnsubscribers(unsubscribers)
  }
}

function runUnsubscribers(unsubscribers: LiveUnsubscribe[]): void {
  while (unsubscribers.length > 0) {
    unsubscribers.pop()?.()
  }
}
