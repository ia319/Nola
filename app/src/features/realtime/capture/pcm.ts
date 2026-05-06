import type { LiveAudioSourceKind, RealtimeAudioFrame } from './types'
import type { LiveDurationMs, LiveTimestampMs } from '../types'

export const REALTIME_AUDIO_PCM_FORMAT = 'pcm_s16le'
export const REALTIME_AUDIO_TARGET_SAMPLE_RATE = 16000
export const REALTIME_AUDIO_TARGET_CHANNEL_COUNT = 1
export const REALTIME_AUDIO_DEFAULT_FRAME_DURATION_MS = 20
export const REALTIME_AUDIO_BYTES_PER_SAMPLE = 2

export interface BuildRealtimeAudioFrameOptions {
  source: LiveAudioSourceKind
  sequence: number
  samples: Float32Array
  capturedAtMs: LiveTimestampMs
  durationMs: LiveDurationMs
}

export function getSamplesPerFrame(
  frameDurationMs: LiveDurationMs = REALTIME_AUDIO_DEFAULT_FRAME_DURATION_MS,
): number {
  return Math.round((REALTIME_AUDIO_TARGET_SAMPLE_RATE * frameDurationMs) / 1000)
}

export function downmixToMono(channels: readonly Float32Array[]): Float32Array {
  if (channels.length === 0) {
    return new Float32Array()
  }
  if (channels.length === 1) {
    return channels[0].slice()
  }

  const sampleCount = Math.min(...channels.map((channel) => channel.length))
  const mono = new Float32Array(sampleCount)

  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
    let sum = 0
    for (const channel of channels) {
      sum += channel[sampleIndex] ?? 0
    }
    mono[sampleIndex] = sum / channels.length
  }

  return mono
}

export function resampleLinear(
  samples: Float32Array,
  inputSampleRate: number,
  outputSampleRate = REALTIME_AUDIO_TARGET_SAMPLE_RATE,
): Float32Array {
  if (inputSampleRate <= 0 || outputSampleRate <= 0) {
    throw new RangeError('Audio sample rates must be positive')
  }
  if (samples.length === 0) {
    return new Float32Array()
  }
  if (inputSampleRate === outputSampleRate) {
    return samples.slice()
  }

  const ratio = inputSampleRate / outputSampleRate
  const outputLength = Math.floor(samples.length / ratio)
  const output = new Float32Array(outputLength)

  for (let outputIndex = 0; outputIndex < outputLength; outputIndex += 1) {
    const sourcePosition = outputIndex * ratio
    const leftIndex = Math.floor(sourcePosition)
    const rightIndex = Math.min(leftIndex + 1, samples.length - 1)
    const fraction = sourcePosition - leftIndex
    const left = samples[leftIndex] ?? 0
    const right = samples[rightIndex] ?? left
    output[outputIndex] = left + (right - left) * fraction
  }

  return output
}

export function float32ToPcm16le(samples: Float32Array): ArrayBuffer {
  const payload = new ArrayBuffer(samples.length * REALTIME_AUDIO_BYTES_PER_SAMPLE)
  const view = new DataView(payload)

  for (let sampleIndex = 0; sampleIndex < samples.length; sampleIndex += 1) {
    const sample = clampAudioSample(samples[sampleIndex] ?? 0)
    const pcmValue = sample < 0 ? Math.round(sample * 32768) : Math.round(sample * 32767)
    view.setInt16(sampleIndex * REALTIME_AUDIO_BYTES_PER_SAMPLE, pcmValue, true)
  }

  return payload
}

export function buildRealtimeAudioFrame(
  options: BuildRealtimeAudioFrameOptions,
): RealtimeAudioFrame {
  return {
    source: options.source,
    sequence: options.sequence,
    sampleRate: REALTIME_AUDIO_TARGET_SAMPLE_RATE,
    channelCount: REALTIME_AUDIO_TARGET_CHANNEL_COUNT,
    format: REALTIME_AUDIO_PCM_FORMAT,
    durationMs: options.durationMs,
    capturedAtMs: options.capturedAtMs,
    payload: float32ToPcm16le(options.samples),
  }
}

function clampAudioSample(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.min(1, Math.max(-1, value))
}
