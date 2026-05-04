import type { LiveAudioLevel } from './types'
import type { LiveDurationMs, LiveUnsubscribe } from '../types'

interface BrowserAudioGlobal {
  AudioContext?: typeof AudioContext
  webkitAudioContext?: typeof AudioContext
}

export interface AudioLevelMeterOptions {
  levelSampleIntervalMs?: LiveDurationMs
  mutedThreshold?: number
  mutedAfterMs?: LiveDurationMs
}

const DEFAULT_SAMPLE_INTERVAL_MS = 250
const DEFAULT_MUTED_THRESHOLD = 0.015
const DEFAULT_MUTED_AFTER_MS = 1500
const ANALYSER_FFT_SIZE = 2048

function getAudioContextConstructor(): typeof AudioContext | null {
  const audioGlobal = globalThis as typeof globalThis & BrowserAudioGlobal
  return audioGlobal.AudioContext ?? audioGlobal.webkitAudioContext ?? null
}

function clampLevel(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.min(1, Math.max(0, value))
}

export class AudioLevelMeter {
  private readonly callbacks = new Set<(level: LiveAudioLevel) => void>()
  private readonly sampleIntervalMs: LiveDurationMs
  private readonly mutedThreshold: number
  private readonly mutedAfterMs: LiveDurationMs
  private readonly context: AudioContext | null
  private readonly source: MediaStreamAudioSourceNode | null
  private readonly analyser: AnalyserNode | null
  private readonly samples: Uint8Array<ArrayBuffer> | null
  private intervalId: ReturnType<typeof setInterval> | null = null
  private mutedSince: number | null = null

  constructor(stream: MediaStream, options: AudioLevelMeterOptions = {}) {
    this.sampleIntervalMs = options.levelSampleIntervalMs ?? DEFAULT_SAMPLE_INTERVAL_MS
    this.mutedThreshold = options.mutedThreshold ?? DEFAULT_MUTED_THRESHOLD
    this.mutedAfterMs = options.mutedAfterMs ?? DEFAULT_MUTED_AFTER_MS

    const AudioContextConstructor = getAudioContextConstructor()
    if (!AudioContextConstructor) {
      this.context = null
      this.source = null
      this.analyser = null
      this.samples = null
      return
    }

    this.context = new AudioContextConstructor()
    this.analyser = this.context.createAnalyser()
    this.analyser.fftSize = ANALYSER_FFT_SIZE
    this.samples = new Uint8Array(this.analyser.fftSize)
    this.source = this.context.createMediaStreamSource(stream)
    this.source.connect(this.analyser)
  }

  start(): void {
    if (!this.analyser || !this.samples || this.intervalId !== null) {
      return
    }

    this.intervalId = setInterval(() => {
      this.emitSample()
    }, this.sampleIntervalMs)
  }

  async stop(): Promise<void> {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }

    this.callbacks.clear()
    this.source?.disconnect()
    this.analyser?.disconnect()
    await this.context?.close()
  }

  onLevel(callback: (level: LiveAudioLevel) => void): LiveUnsubscribe {
    this.callbacks.add(callback)
    return () => {
      this.callbacks.delete(callback)
    }
  }

  private emitSample(): void {
    if (!this.analyser || !this.samples || this.callbacks.size === 0) {
      return
    }

    this.analyser.getByteTimeDomainData(this.samples)
    const measuredAt = Date.now()
    let sumSquares = 0
    let peak = 0

    for (const sample of this.samples) {
      const normalized = (sample - 128) / 128
      const absolute = Math.abs(normalized)
      sumSquares += normalized * normalized
      peak = Math.max(peak, absolute)
    }

    const level = clampLevel(Math.sqrt(sumSquares / this.samples.length))
    const mutedSince = this.resolveMutedSince(level, measuredAt)
    const payload: LiveAudioLevel = {
      level,
      peak: clampLevel(peak),
      isMutedLike: mutedSince !== null && measuredAt - mutedSince >= this.mutedAfterMs,
      measuredAt,
    }

    for (const callback of this.callbacks) {
      callback(payload)
    }
  }

  private resolveMutedSince(level: number, measuredAt: number): number | null {
    if (level > this.mutedThreshold) {
      this.mutedSince = null
      return null
    }

    this.mutedSince ??= measuredAt
    return this.mutedSince
  }
}
