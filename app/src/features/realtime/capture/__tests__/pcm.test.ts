import { describe, expect, it } from 'vitest'

import {
  buildRealtimeAudioFrame,
  downmixToMono,
  float32ToPcm16le,
  getSamplesPerFrame,
  resampleLinear,
} from '../pcm'

describe('realtime PCM helpers', () => {
  it('downmixes multiple channels to mono without mutating the inputs', () => {
    const left = new Float32Array([1, 0, -1])
    const right = new Float32Array([-1, 0.5, 1])

    expect(Array.from(downmixToMono([left, right]))).toEqual([0, 0.25, 0])
    expect(Array.from(left)).toEqual([1, 0, -1])
  })

  it('resamples linearly to 16 kHz', () => {
    const input = new Float32Array(480)
    input.fill(0.5)

    const output = resampleLinear(input, 48000)

    expect(output).toHaveLength(160)
    expect(output[0]).toBeCloseTo(0.5)
    expect(output.at(-1)).toBeCloseTo(0.5)
  })

  it('clips float samples and writes signed 16-bit little-endian PCM', () => {
    const payload = float32ToPcm16le(new Float32Array([-2, -1, -0.5, 0, 0.5, 1, 2, NaN]))
    const view = new DataView(payload)

    expect(view.getInt16(0, true)).toBe(-32768)
    expect(view.getInt16(2, true)).toBe(-32768)
    expect(view.getInt16(4, true)).toBe(-16384)
    expect(view.getInt16(6, true)).toBe(0)
    expect(view.getInt16(8, true)).toBe(16384)
    expect(view.getInt16(10, true)).toBe(32767)
    expect(view.getInt16(12, true)).toBe(32767)
    expect(view.getInt16(14, true)).toBe(0)
  })

  it('builds the frontend realtime audio frame contract', () => {
    const frame = buildRealtimeAudioFrame({
      source: 'microphone',
      sequence: 3,
      samples: new Float32Array(getSamplesPerFrame(20)),
      capturedAtMs: 60,
      durationMs: 20,
    })

    expect(frame).toMatchObject({
      source: 'microphone',
      sequence: 3,
      sampleRate: 16000,
      channelCount: 1,
      format: 'pcm_s16le',
      durationMs: 20,
      capturedAtMs: 60,
    })
    expect(frame.payload.byteLength).toBe(640)
  })
})
