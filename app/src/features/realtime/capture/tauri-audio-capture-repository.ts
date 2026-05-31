import {
  listenNativeAudioFrames,
  listenNativeAudioLevels,
  listenNativeCaptureStates,
  pauseNativeCapture,
  resumeNativeCapture,
  startNativeMicrophoneCapture,
  startNativeSystemCapture,
  stopNativeCapture,
  type NativeAudioErrorDto,
  type NativeAudioFrameEventDto,
  type NativeAudioLevelEventDto,
  type NativeAudioSource,
  type NativeCaptureSessionDto,
  type NativeCaptureState,
  type TauriUnlisten,
} from '@/lib/tauri-api'

import type { LiveAudioCaptureRepository } from './audio-capture-repository'
import { LiveCaptureError } from './errors'
import {
  REALTIME_AUDIO_PCM_FORMAT,
  REALTIME_AUDIO_TARGET_CHANNEL_COUNT,
  REALTIME_AUDIO_TARGET_SAMPLE_RATE,
} from './pcm'
import { createLiveCaptureSessionId } from './session-id'
import type {
  LiveAudioLevel,
  LiveAudioSourceKind,
  LiveCaptureErrorCode,
  LiveCaptureSession,
  LiveCaptureState,
  LiveCaptureStateChange,
  LiveMicrophoneCaptureOptions,
  LiveSystemAudioCaptureOptions,
  RealtimeAudioFrame,
} from './types'
import type { LiveTimestampMs, LiveUnsubscribe } from '../types'

function buildNativeCaptureRequest(sourceKind: LiveAudioSourceKind, deviceId: string | null) {
  return {
    sessionId: createLiveCaptureSessionId(sourceKind),
    deviceId,
  }
}

function mapNativeSource(source: NativeAudioSource): LiveAudioSourceKind {
  return source === 'system' ? 'system' : 'microphone'
}

function mapNativeCaptureState(state: NativeCaptureState): LiveCaptureState {
  if (
    state === 'idle' ||
    state === 'starting' ||
    state === 'capturing' ||
    state === 'paused' ||
    state === 'stopping' ||
    state === 'stopped' ||
    state === 'failed' ||
    state === 'unsupported'
  ) {
    return state
  }

  return 'failed'
}

function mapNativeCaptureError(
  error: unknown,
  sourceKind: LiveAudioSourceKind,
): LiveCaptureErrorCode {
  if (isNativeAudioError(error)) {
    if (error.code === 'permission_denied') {
      return sourceKind === 'microphone'
        ? 'microphone_permission_denied'
        : 'system_audio_permission_denied'
    }

    if (error.code === 'command_not_implemented') {
      return sourceKind === 'microphone'
        ? 'microphone_capture_unsupported'
        : 'system_audio_capture_unsupported'
    }
  }

  return sourceKind === 'microphone' ? 'microphone_capture_failed' : 'system_audio_capture_failed'
}

function isNativeAudioError(error: unknown): error is NativeAudioErrorDto {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return false
  }

  return (
    error.code === 'command_not_implemented' ||
    error.code === 'session_id_invalid' ||
    error.code === 'session_params_mismatch' ||
    error.code === 'session_not_found' ||
    error.code === 'session_state_invalid' ||
    error.code === 'device_not_found' ||
    error.code === 'permission_denied' ||
    error.code === 'capture_failed' ||
    error.code === 'internal_error'
  )
}

function toArrayBuffer(payload: number[]): ArrayBuffer {
  const bytes = Uint8Array.from(payload)
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
}

function mapNativeAudioFrame(event: NativeAudioFrameEventDto): RealtimeAudioFrame | null {
  if (
    event.sampleRate !== REALTIME_AUDIO_TARGET_SAMPLE_RATE ||
    event.channelCount !== REALTIME_AUDIO_TARGET_CHANNEL_COUNT ||
    event.encoding !== REALTIME_AUDIO_PCM_FORMAT
  ) {
    return null
  }

  return {
    source: mapNativeSource(event.source),
    sequence: event.sequence,
    sampleRate: REALTIME_AUDIO_TARGET_SAMPLE_RATE,
    channelCount: REALTIME_AUDIO_TARGET_CHANNEL_COUNT,
    format: REALTIME_AUDIO_PCM_FORMAT,
    durationMs: event.durationMs,
    capturedAtMs: event.capturedAtMs,
    payload: toArrayBuffer(event.payload),
  }
}

function mapNativeAudioLevel(event: NativeAudioLevelEventDto): LiveAudioLevel {
  return {
    level: event.level,
    peak: event.peak,
    isMutedLike: event.isMutedLike,
    measuredAt: event.measuredAtMs,
  }
}

class TauriLiveCaptureSession implements LiveCaptureSession {
  readonly id: string
  readonly sourceKind: LiveAudioSourceKind
  deviceId: string | null
  state: LiveCaptureState = 'starting'
  startedAt: LiveTimestampMs = Date.now()
  private readonly levelCallbacks = new Set<(level: LiveAudioLevel) => void>()
  private readonly frameCallbacks = new Set<(frame: RealtimeAudioFrame) => void>()
  private readonly stateCallbacks = new Set<(change: LiveCaptureStateChange) => void>()
  private readonly unlisteners: TauriUnlisten[] = []
  private cleanupPromise: Promise<void> | null = null

  constructor(sourceKind: LiveAudioSourceKind, sessionId: string, deviceId: string | null) {
    this.sourceKind = sourceKind
    this.id = sessionId
    this.deviceId = deviceId
  }

  async bindNativeEvents(): Promise<void> {
    try {
      this.unlisteners.push(
        await listenNativeAudioFrames((event) => {
          this.handleNativeAudioFrame(event)
        }),
      )
      this.unlisteners.push(
        await listenNativeAudioLevels((event) => {
          this.handleNativeAudioLevel(event)
        }),
      )
      this.unlisteners.push(
        await listenNativeCaptureStates((event) => {
          this.handleNativeCaptureState(event)
        }),
      )
    } catch (error) {
      await this.cleanup()
      throw error
    }
  }

  applyNativeSession(session: NativeCaptureSessionDto): void {
    if (!this.isOwnSession(session)) {
      return
    }

    this.deviceId = session.deviceId
    this.startedAt = session.startedAtMs
    this.setState(mapNativeCaptureState(session.state), null)
  }

  async dispose(): Promise<void> {
    await this.cleanup()
  }

  async stop(): Promise<void> {
    if (this.state === 'stopped' || this.state === 'failed') {
      await this.cleanup()
      return
    }

    this.setState('stopping', null)

    try {
      const session = await stopNativeCapture({ sessionId: this.id })
      this.applyNativeSession(session)
      await this.cleanup()
    } catch (error) {
      const code = mapNativeCaptureError(error, this.sourceKind)
      this.setState('failed', code)
      await this.cleanup()
      throw new LiveCaptureError(code)
    }
  }

  async pause(): Promise<void> {
    if (this.state !== 'capturing') {
      return
    }

    try {
      const session = await pauseNativeCapture({ sessionId: this.id })
      this.applyNativeSession(session)
    } catch (error) {
      const code = mapNativeCaptureError(error, this.sourceKind)
      this.setState('failed', code)
      throw new LiveCaptureError(code)
    }
  }

  async resume(): Promise<void> {
    if (this.state !== 'paused') {
      return
    }

    try {
      const session = await resumeNativeCapture({ sessionId: this.id })
      this.applyNativeSession(session)
    } catch (error) {
      const code = mapNativeCaptureError(error, this.sourceKind)
      this.setState('failed', code)
      throw new LiveCaptureError(code)
    }
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

  private handleNativeAudioFrame(event: NativeAudioFrameEventDto): void {
    if (event.sessionId !== this.id || mapNativeSource(event.source) !== this.sourceKind) {
      return
    }

    const frame = mapNativeAudioFrame(event)
    if (!frame) {
      return
    }

    for (const callback of this.frameCallbacks) {
      callback(frame)
    }
  }

  private handleNativeAudioLevel(event: NativeAudioLevelEventDto): void {
    if (event.sessionId !== this.id || mapNativeSource(event.source) !== this.sourceKind) {
      return
    }

    const level = mapNativeAudioLevel(event)
    for (const callback of this.levelCallbacks) {
      callback(level)
    }
  }

  private handleNativeCaptureState(session: NativeCaptureSessionDto): void {
    if (!this.isOwnSession(session)) {
      return
    }

    const state = mapNativeCaptureState(session.state)
    const errorCode =
      state === 'failed'
        ? this.sourceKind === 'microphone'
          ? 'microphone_capture_failed'
          : 'system_audio_capture_failed'
        : null

    this.deviceId = session.deviceId
    this.startedAt = session.startedAtMs
    this.setState(state, errorCode)

    if (state === 'stopped' || state === 'failed') {
      void this.cleanup()
    }
  }

  private isOwnSession(session: NativeCaptureSessionDto): boolean {
    return session.sessionId === this.id && mapNativeSource(session.source) === this.sourceKind
  }

  private setState(state: LiveCaptureState, errorCode: LiveCaptureErrorCode | null): void {
    this.state = state
    const change: LiveCaptureStateChange = {
      state,
      changedAt: Date.now(),
      errorCode,
    }

    for (const callback of this.stateCallbacks) {
      callback(change)
    }
  }

  private cleanup(): Promise<void> {
    this.cleanupPromise ??= this.runCleanup()
    return this.cleanupPromise
  }

  private async runCleanup(): Promise<void> {
    const unlisteners = this.unlisteners.splice(0)
    for (const unlisten of unlisteners) {
      unlisten()
    }
  }
}

async function startNativeCaptureSession(
  sourceKind: LiveAudioSourceKind,
  deviceId: string | null,
): Promise<LiveCaptureSession> {
  const request = buildNativeCaptureRequest(sourceKind, deviceId)
  const session = new TauriLiveCaptureSession(sourceKind, request.sessionId, deviceId)

  try {
    await session.bindNativeEvents()
    const nativeSession =
      sourceKind === 'microphone'
        ? await startNativeMicrophoneCapture(request)
        : await startNativeSystemCapture(request)
    session.applyNativeSession(nativeSession)
    return session
  } catch (error) {
    await session.dispose()
    throw new LiveCaptureError(mapNativeCaptureError(error, sourceKind))
  }
}

export class TauriAudioCaptureRepository implements LiveAudioCaptureRepository {
  async startMicrophoneCapture(
    options: LiveMicrophoneCaptureOptions = {},
  ): Promise<LiveCaptureSession> {
    return startNativeCaptureSession('microphone', options.deviceId ?? null)
  }

  async startSystemAudioCapture(
    _options: LiveSystemAudioCaptureOptions = {},
  ): Promise<LiveCaptureSession> {
    return startNativeCaptureSession('system', null)
  }
}

export function createTauriAudioCaptureRepository(): LiveAudioCaptureRepository {
  return new TauriAudioCaptureRepository()
}
