import { AudioLevelMeter } from './audio-level-meter'
import type {
  LiveAudioLevel,
  LiveAudioSourceKind,
  LiveCaptureErrorCode,
  LiveCaptureSession,
  LiveCaptureState,
  LiveCaptureStateChange,
} from './types'
import type { LiveDurationMs, LiveTimestampMs, LiveUnsubscribe } from '../types'

interface CreateLiveCaptureSessionOptions {
  sourceKind: LiveAudioSourceKind
  deviceId: string | null
  stream: MediaStream
  levelSampleIntervalMs?: LiveDurationMs
}

let captureSessionSequence = 0

function createCaptureSessionId(sourceKind: LiveAudioSourceKind): string {
  captureSessionSequence += 1
  return `live-${sourceKind}-${Date.now()}-${captureSessionSequence}`
}

function getStreamTracks(stream: MediaStream): MediaStreamTrack[] {
  return stream.getTracks()
}

export function stopStreamTracks(stream: MediaStream): void {
  for (const track of getStreamTracks(stream)) {
    track.stop()
  }
}

export class WebLiveCaptureSession implements LiveCaptureSession {
  readonly id: string
  readonly sourceKind: LiveAudioSourceKind
  readonly deviceId: string | null
  readonly startedAt: LiveTimestampMs
  private readonly stream: MediaStream
  private readonly levelMeter: AudioLevelMeter
  private readonly stateCallbacks = new Set<(change: LiveCaptureStateChange) => void>()
  private readonly trackEndedHandler = () => {
    void this.handleInterrupted()
  }
  private cleanupPromise: Promise<void> | null = null
  state: LiveCaptureState = 'capturing'

  constructor(options: CreateLiveCaptureSessionOptions) {
    this.id = createCaptureSessionId(options.sourceKind)
    this.sourceKind = options.sourceKind
    this.deviceId = options.deviceId
    this.startedAt = Date.now()
    this.stream = options.stream
    this.levelMeter = new AudioLevelMeter(options.stream, {
      levelSampleIntervalMs: options.levelSampleIntervalMs,
    })
    this.bindTrackEndListeners()
    this.levelMeter.start()
  }

  async stop(): Promise<void> {
    if (this.state === 'stopped' || this.state === 'failed') {
      return
    }

    if (this.state !== 'stopping') {
      this.setState('stopping', null)
    }

    await this.cleanup()
    this.setState('stopped', null)
  }

  async pause(): Promise<void> {
    if (this.state !== 'capturing') {
      return
    }

    for (const track of getStreamTracks(this.stream)) {
      track.enabled = false
    }
    this.setState('paused', null)
  }

  async resume(): Promise<void> {
    if (this.state !== 'paused') {
      return
    }

    for (const track of getStreamTracks(this.stream)) {
      track.enabled = true
    }
    this.setState('capturing', null)
  }

  onLevel(callback: (level: LiveAudioLevel) => void): LiveUnsubscribe {
    return this.levelMeter.onLevel(callback)
  }

  onStateChange(callback: (change: LiveCaptureStateChange) => void): LiveUnsubscribe {
    this.stateCallbacks.add(callback)
    return () => {
      this.stateCallbacks.delete(callback)
    }
  }

  private async handleInterrupted(): Promise<void> {
    if (this.state === 'stopping' || this.state === 'stopped' || this.state === 'failed') {
      return
    }

    await this.cleanup()
    this.setState('failed', 'capture_interrupted')
  }

  private cleanup(): Promise<void> {
    this.cleanupPromise ??= this.runCleanup()
    return this.cleanupPromise
  }

  private async runCleanup(): Promise<void> {
    this.unbindTrackEndListeners()
    stopStreamTracks(this.stream)
    await this.levelMeter.stop()
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

  private bindTrackEndListeners(): void {
    for (const track of getStreamTracks(this.stream)) {
      track.addEventListener?.('ended', this.trackEndedHandler)
    }
  }

  private unbindTrackEndListeners(): void {
    for (const track of getStreamTracks(this.stream)) {
      track.removeEventListener?.('ended', this.trackEndedHandler)
    }
  }
}

export function createLiveCaptureSession(
  options: CreateLiveCaptureSessionOptions,
): LiveCaptureSession {
  return new WebLiveCaptureSession(options)
}
