// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'

import { startMicrophoneCapture } from '../web-microphone-capture'

interface MockTrack {
  enabled: boolean
  kind: string
  stop: ReturnType<typeof vi.fn>
  addEventListener: ReturnType<typeof vi.fn>
  removeEventListener: ReturnType<typeof vi.fn>
}

function buildTrack(kind = 'audio'): MockTrack {
  return {
    enabled: true,
    kind,
    stop: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }
}

function buildStream(tracks = [buildTrack()]): MediaStream {
  return {
    getTracks: () => tracks,
  } as unknown as MediaStream
}

function installAudioContextMock(sample = 255) {
  const analyser = {
    fftSize: 0,
    disconnect: vi.fn(),
    getByteTimeDomainData: vi.fn((samples: Uint8Array) => {
      samples.fill(sample)
    }),
  }
  const source = {
    connect: vi.fn(),
    disconnect: vi.fn(),
  }
  const close = vi.fn().mockResolvedValue(undefined)
  class MockAudioContext {
    createAnalyser() {
      return analyser
    }

    createMediaStreamSource() {
      return source
    }

    close = close
  }

  vi.stubGlobal('AudioContext', MockAudioContext)
  return { analyser, close, source }
}

describe('startMicrophoneCapture', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('starts capture with an exact real device constraint and manages state', async () => {
    installAudioContextMock()
    const track = buildTrack()
    const stream = buildStream([track])
    const getUserMedia = vi.fn().mockResolvedValue(stream)
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia,
      },
    })

    const session = await startMicrophoneCapture({ deviceId: 'mic-1' })
    const stateChanges: string[] = []
    session.onStateChange((change) => stateChanges.push(change.state))

    expect(getUserMedia).toHaveBeenCalledWith({
      audio: { deviceId: { exact: 'mic-1' } },
    })
    expect(session.sourceKind).toBe('microphone')
    expect(session.deviceId).toBe('mic-1')
    expect(session.state).toBe('capturing')

    await session.pause()
    expect(track.enabled).toBe(false)
    expect(session.state).toBe('paused')

    await session.resume()
    expect(track.enabled).toBe(true)
    expect(session.state).toBe('capturing')

    await session.stop()
    expect(track.stop).toHaveBeenCalledTimes(1)
    expect(session.state).toBe('stopped')
    expect(stateChanges).toEqual(['paused', 'capturing', 'stopping', 'stopped'])
  })

  it('falls back to the default device for temporary IDs and emits levels', async () => {
    vi.useFakeTimers()
    installAudioContextMock()
    const track = buildTrack()
    const stream = buildStream([track])
    const getUserMedia = vi.fn().mockResolvedValue(stream)
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia,
      },
    })

    const session = await startMicrophoneCapture({
      deviceId: 'temp-microphone-1',
      levelSampleIntervalMs: 10,
    })
    const levels: number[] = []
    session.onLevel((level) => levels.push(level.level))

    vi.advanceTimersByTime(10)

    expect(getUserMedia).toHaveBeenCalledWith({ audio: true })
    expect(session.deviceId).toBeNull()
    expect(levels[0]).toBeGreaterThan(0)

    await session.stop()
  })

  it('throws a stable unsupported error when getUserMedia is unavailable', async () => {
    vi.stubGlobal('navigator', {
      mediaDevices: {},
    })

    await expect(startMicrophoneCapture()).rejects.toMatchObject({
      code: 'microphone_capture_unsupported',
    })
  })

  it('maps microphone permission denial into a capture error', async () => {
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: vi
          .fn()
          .mockRejectedValue(new DOMException('Permission denied', 'NotAllowedError')),
      },
    })

    await expect(startMicrophoneCapture()).rejects.toMatchObject({
      code: 'microphone_permission_denied',
    })
  })
})
