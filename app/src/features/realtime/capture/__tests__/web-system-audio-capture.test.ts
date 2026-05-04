// @vitest-environment jsdom

import { waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { startSystemAudioCapture } from '../web-system-audio-capture'

const originalSetSinkIdDescriptor = Object.getOwnPropertyDescriptor(
  HTMLMediaElement.prototype,
  'setSinkId',
)

interface MockTrack {
  enabled: boolean
  kind: string
  stop: ReturnType<typeof vi.fn>
  addEventListener: ReturnType<typeof vi.fn>
  removeEventListener: ReturnType<typeof vi.fn>
}

function buildTrack(kind: string): MockTrack {
  return {
    enabled: true,
    kind,
    stop: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }
}

function buildStream(tracks: MockTrack[]): MediaStream {
  return {
    getTracks: () => tracks,
    getAudioTracks: () => tracks.filter((track) => track.kind === 'audio'),
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
  return { close, source }
}

function restoreSpeakerSelectionSupport(): void {
  Reflect.deleteProperty(HTMLMediaElement.prototype, 'setSinkId')
  if (originalSetSinkIdDescriptor) {
    Object.defineProperty(HTMLMediaElement.prototype, 'setSinkId', originalSetSinkIdDescriptor)
  }
}

describe('startSystemAudioCapture', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    restoreSpeakerSelectionSupport()
  })

  it('throws a stable unsupported error when getDisplayMedia is unavailable', async () => {
    vi.stubGlobal('navigator', {
      mediaDevices: {},
    })

    await expect(startSystemAudioCapture()).rejects.toMatchObject({
      code: 'system_audio_capture_unsupported',
    })
  })

  it('maps display capture permission denial into a capture error', async () => {
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getDisplayMedia: vi
          .fn()
          .mockRejectedValue(new DOMException('Permission denied', 'NotAllowedError')),
      },
    })

    await expect(startSystemAudioCapture()).rejects.toMatchObject({
      code: 'system_audio_permission_denied',
    })
  })

  it('starts system capture from display media and emits levels', async () => {
    vi.useFakeTimers()
    installAudioContextMock()
    const audioTrack = buildTrack('audio')
    const videoTrack = buildTrack('video')
    const stream = buildStream([audioTrack, videoTrack])
    const getDisplayMedia = vi.fn().mockResolvedValue(stream)
    const setSinkId = vi.fn()
    Object.defineProperty(HTMLMediaElement.prototype, 'setSinkId', {
      configurable: true,
      value: setSinkId,
    })
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getDisplayMedia,
      },
    })

    const session = await startSystemAudioCapture({ levelSampleIntervalMs: 10 })
    const levels: number[] = []
    session.onLevel((level) => levels.push(level.level))

    vi.advanceTimersByTime(10)

    expect(getDisplayMedia).toHaveBeenCalledWith({
      audio: true,
      video: true,
    })
    expect(session.sourceKind).toBe('system')
    expect(session.deviceId).toBeNull()
    expect(levels[0]).toBeGreaterThan(0)
    expect(setSinkId).not.toHaveBeenCalled()

    await session.stop()
    expect(audioTrack.stop).toHaveBeenCalledTimes(1)
    expect(videoTrack.stop).toHaveBeenCalledTimes(1)
  })

  it('stops returned tracks when display media has no audio track', async () => {
    const videoTrack = buildTrack('video')
    const getDisplayMedia = vi.fn().mockResolvedValue(buildStream([videoTrack]))
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getDisplayMedia,
      },
    })

    await expect(startSystemAudioCapture()).rejects.toMatchObject({
      code: 'system_audio_track_missing',
    })
    expect(videoTrack.stop).toHaveBeenCalledTimes(1)
  })

  it('cleans up every track when display capture is interrupted', async () => {
    installAudioContextMock()
    const audioTrack = buildTrack('audio')
    const videoTrack = buildTrack('video')
    const stream = buildStream([audioTrack, videoTrack])
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getDisplayMedia: vi.fn().mockResolvedValue(stream),
      },
    })

    const session = await startSystemAudioCapture()
    const stateChanges: string[] = []
    session.onStateChange((change) => stateChanges.push(change.state))

    const endedListener = audioTrack.addEventListener.mock.calls.find(
      ([eventName]) => eventName === 'ended',
    )?.[1] as EventListener | undefined
    expect(endedListener).toBeDefined()
    endedListener?.(new Event('ended'))

    expect(audioTrack.stop).toHaveBeenCalledTimes(1)
    expect(videoTrack.stop).toHaveBeenCalledTimes(1)
    await waitFor(() => {
      expect(session.state).toBe('failed')
    })
    expect(stateChanges).toEqual(['failed'])
  })
})
