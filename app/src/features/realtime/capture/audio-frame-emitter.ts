import {
  REALTIME_AUDIO_DEFAULT_FRAME_DURATION_MS,
  REALTIME_AUDIO_TARGET_SAMPLE_RATE,
  buildRealtimeAudioFrame,
  downmixToMono,
  getSamplesPerFrame,
  resampleLinear,
} from './pcm'
import logger from '@/config/logger'
import type { LiveAudioSourceKind, RealtimeAudioFrame } from './types'
import type { LiveDurationMs, LiveUnsubscribe } from '../types'

interface BrowserAudioGlobal {
  AudioContext?: typeof AudioContext
  webkitAudioContext?: typeof AudioContext
}

export interface AudioFrameEmitterOptions {
  sourceKind: LiveAudioSourceKind
  stream: MediaStream
  frameDurationMs?: LiveDurationMs
}

const PROCESSOR_BUFFER_SIZE = 4096

function getAudioContextConstructor(): typeof AudioContext | null {
  const audioGlobal = globalThis as typeof globalThis & BrowserAudioGlobal
  return audioGlobal.AudioContext ?? audioGlobal.webkitAudioContext ?? null
}

export class AudioFrameEmitter {
  private readonly callbacks = new Set<(frame: RealtimeAudioFrame) => void>()
  private readonly sourceKind: LiveAudioSourceKind
  private readonly frameDurationMs: LiveDurationMs
  private readonly samplesPerFrame: number
  private readonly context: AudioContext | null
  private readonly source: MediaStreamAudioSourceNode | null
  private readonly processor: ScriptProcessorNode | null
  private pendingSamples = new Float32Array()
  private sequence = 0
  private emittedSamples = 0
  private paused = false
  private stopped = false

  constructor(options: AudioFrameEmitterOptions) {
    this.sourceKind = options.sourceKind
    this.frameDurationMs = options.frameDurationMs ?? REALTIME_AUDIO_DEFAULT_FRAME_DURATION_MS
    this.samplesPerFrame = getSamplesPerFrame(this.frameDurationMs)

    const AudioContextConstructor = getAudioContextConstructor()
    if (!AudioContextConstructor) {
      this.context = null
      this.source = null
      this.processor = null
      return
    }

    this.context = new AudioContextConstructor()
    if (typeof this.context.createScriptProcessor !== 'function') {
      this.source = null
      this.processor = null
      return
    }

    this.source = this.context.createMediaStreamSource(options.stream)
    this.processor = this.context.createScriptProcessor(PROCESSOR_BUFFER_SIZE)
    this.processor.onaudioprocess = (event) => {
      this.handleAudioProcess(event)
    }
  }

  start(): void {
    if (this.stopped || !this.source || !this.processor || !this.context) {
      return
    }

    this.source.connect(this.processor)
    this.processor.connect(this.context.destination)
  }

  pause(): void {
    this.paused = true
  }

  resume(): void {
    this.paused = false
  }

  async stop(): Promise<void> {
    if (this.stopped) {
      return
    }

    this.stopped = true
    this.callbacks.clear()
    this.pendingSamples = new Float32Array()
    this.source?.disconnect()
    this.processor?.disconnect()
    await this.context?.close()
  }

  onAudioFrame(callback: (frame: RealtimeAudioFrame) => void): LiveUnsubscribe {
    this.callbacks.add(callback)
    return () => {
      this.callbacks.delete(callback)
    }
  }

  private handleAudioProcess(event: AudioProcessingEvent): void {
    this.silenceOutput(event.outputBuffer)
    if (this.stopped || this.paused || this.callbacks.size === 0) {
      return
    }

    const monoInput = downmixToMono(readInputChannels(event.inputBuffer))
    const resampled = resampleLinear(
      monoInput,
      event.inputBuffer.sampleRate,
      REALTIME_AUDIO_TARGET_SAMPLE_RATE,
    )
    this.appendSamples(resampled)
    this.emitReadyFrames()
  }

  private appendSamples(samples: Float32Array): void {
    if (samples.length === 0) {
      return
    }

    const nextSamples = new Float32Array(this.pendingSamples.length + samples.length)
    nextSamples.set(this.pendingSamples)
    nextSamples.set(samples, this.pendingSamples.length)
    this.pendingSamples = nextSamples
  }

  private emitReadyFrames(): void {
    while (this.pendingSamples.length >= this.samplesPerFrame) {
      const frameSamples = this.pendingSamples.slice(0, this.samplesPerFrame)
      this.pendingSamples = this.pendingSamples.slice(this.samplesPerFrame)

      const frame = buildRealtimeAudioFrame({
        source: this.sourceKind,
        sequence: this.sequence,
        samples: frameSamples,
        capturedAtMs: Math.round((this.emittedSamples * 1000) / REALTIME_AUDIO_TARGET_SAMPLE_RATE),
        durationMs: this.frameDurationMs,
      })
      this.sequence += 1
      this.emittedSamples += this.samplesPerFrame

      this.emitFrame(frame)
    }
  }

  private emitFrame(frame: RealtimeAudioFrame): void {
    for (const callback of this.callbacks) {
      try {
        callback(frame)
      } catch (error) {
        logger.error('Live audio frame listener failed', error)
      }
    }
  }

  private silenceOutput(outputBuffer: AudioBuffer): void {
    for (let channelIndex = 0; channelIndex < outputBuffer.numberOfChannels; channelIndex += 1) {
      outputBuffer.getChannelData(channelIndex).fill(0)
    }
  }
}

function readInputChannels(inputBuffer: AudioBuffer): Float32Array[] {
  const channels: Float32Array[] = []

  for (let channelIndex = 0; channelIndex < inputBuffer.numberOfChannels; channelIndex += 1) {
    channels.push(inputBuffer.getChannelData(channelIndex))
  }

  return channels
}
