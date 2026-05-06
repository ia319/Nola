// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'

import { AudioFrameEmitter } from '../audio-frame-emitter'
import type { RealtimeAudioFrame } from '../types'

function buildStream(): MediaStream {
  return {} as MediaStream
}

function installAudioContextMock() {
  const source = {
    connect: vi.fn(),
    disconnect: vi.fn(),
  }
  const processor = {
    connect: vi.fn(),
    disconnect: vi.fn(),
    onaudioprocess: null as ((event: AudioProcessingEvent) => void) | null,
  }
  const destination = {}
  const close = vi.fn().mockResolvedValue(undefined)
  class MockAudioContext {
    sampleRate = 48000
    destination = destination

    createMediaStreamSource() {
      return source
    }

    createScriptProcessor() {
      return processor
    }

    close = close
  }

  vi.stubGlobal('AudioContext', MockAudioContext)
  return { close, processor, source }
}

function buildAudioProcessEvent(samples: Float32Array): AudioProcessingEvent {
  return {
    inputBuffer: {
      sampleRate: 48000,
      numberOfChannels: 1,
      getChannelData: () => samples,
    },
    outputBuffer: {
      numberOfChannels: 1,
      getChannelData: () => new Float32Array(samples.length),
    },
  } as unknown as AudioProcessingEvent
}

describe('AudioFrameEmitter', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('continues notifying later listeners when one listener fails', async () => {
    const { processor } = installAudioContextMock()
    const emitter = new AudioFrameEmitter({
      sourceKind: 'microphone',
      stream: buildStream(),
    })
    const frames: RealtimeAudioFrame[] = []

    emitter.onAudioFrame(() => {
      throw new Error('listener failed')
    })
    emitter.onAudioFrame((frame) => {
      frames.push(frame)
    })
    emitter.start()

    const samples = new Float32Array(960)
    samples.fill(0.5)
    expect(processor.onaudioprocess).toBeDefined()
    expect(() => processor.onaudioprocess?.(buildAudioProcessEvent(samples))).not.toThrow()

    expect(frames).toHaveLength(1)
    expect(frames[0]).toMatchObject({
      source: 'microphone',
      sequence: 0,
      sampleRate: 16000,
      channelCount: 1,
      format: 'pcm_s16le',
    })

    await emitter.stop()
  })
})
