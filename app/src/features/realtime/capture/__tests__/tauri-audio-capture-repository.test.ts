import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  listenNativeAudioFrames,
  listenNativeAudioLevels,
  listenNativeCaptureStates,
  pauseNativeCapture,
  resumeNativeCapture,
  startNativeMicrophoneCapture,
  startNativeSystemCapture,
  stopNativeCapture,
  type NativeAudioFrameEventDto,
  type NativeAudioLevelEventDto,
  type NativeCaptureSessionDto,
} from '@/lib/tauri-api'

import { TauriAudioCaptureRepository } from '../tauri-audio-capture-repository'

vi.mock('@/lib/tauri-api', () => ({
  listenNativeAudioFrames: vi.fn(),
  listenNativeAudioLevels: vi.fn(),
  listenNativeCaptureStates: vi.fn(),
  pauseNativeCapture: vi.fn(),
  resumeNativeCapture: vi.fn(),
  startNativeMicrophoneCapture: vi.fn(),
  startNativeSystemCapture: vi.fn(),
  stopNativeCapture: vi.fn(),
}))

const listenNativeAudioFramesMock = vi.mocked(listenNativeAudioFrames)
const listenNativeAudioLevelsMock = vi.mocked(listenNativeAudioLevels)
const listenNativeCaptureStatesMock = vi.mocked(listenNativeCaptureStates)
const pauseNativeCaptureMock = vi.mocked(pauseNativeCapture)
const resumeNativeCaptureMock = vi.mocked(resumeNativeCapture)
const startNativeMicrophoneCaptureMock = vi.mocked(startNativeMicrophoneCapture)
const startNativeSystemCaptureMock = vi.mocked(startNativeSystemCapture)
const stopNativeCaptureMock = vi.mocked(stopNativeCapture)

let frameListeners: Array<(event: NativeAudioFrameEventDto) => void>
let levelListeners: Array<(event: NativeAudioLevelEventDto) => void>
let stateListeners: Array<(event: NativeCaptureSessionDto) => void>
let unlisteners: Array<ReturnType<typeof vi.fn>>

function nativeSession(
  sessionId: string,
  source: 'microphone' | 'system',
  state: NativeCaptureSessionDto['state'] = 'capturing',
): NativeCaptureSessionDto {
  return {
    sessionId,
    source,
    deviceId: source === 'microphone' ? 'mic-1' : null,
    state,
    startedAtMs: 1_000,
  }
}

function bindEventMocks(): void {
  listenNativeAudioFramesMock.mockImplementation(async (callback) => {
    frameListeners.push(callback)
    const unlisten = vi.fn()
    unlisteners.push(unlisten)
    return unlisten
  })
  listenNativeAudioLevelsMock.mockImplementation(async (callback) => {
    levelListeners.push(callback)
    const unlisten = vi.fn()
    unlisteners.push(unlisten)
    return unlisten
  })
  listenNativeCaptureStatesMock.mockImplementation(async (callback) => {
    stateListeners.push(callback)
    const unlisten = vi.fn()
    unlisteners.push(unlisten)
    return unlisten
  })
}

describe('TauriAudioCaptureRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    frameListeners = []
    levelListeners = []
    stateListeners = []
    unlisteners = []
    bindEventMocks()
  })

  it('starts microphone capture and maps native frame and level events', async () => {
    startNativeMicrophoneCaptureMock.mockImplementation(async (request) =>
      nativeSession(request.sessionId, 'microphone'),
    )
    pauseNativeCaptureMock.mockImplementation(async (control) => ({
      ...nativeSession(control.sessionId, 'microphone'),
      state: 'paused',
    }))
    resumeNativeCaptureMock.mockImplementation(async (control) =>
      nativeSession(control.sessionId, 'microphone'),
    )
    stopNativeCaptureMock.mockImplementation(async (control) => ({
      ...nativeSession(control.sessionId, 'microphone'),
      state: 'stopped',
    }))

    const repository = new TauriAudioCaptureRepository()
    const session = await repository.startMicrophoneCapture({ deviceId: 'mic-1' })
    const frameCallback = vi.fn()
    const levelCallback = vi.fn()
    const stateCallback = vi.fn()
    session.onAudioFrame(frameCallback)
    session.onLevel(levelCallback)
    session.onStateChange(stateCallback)

    frameListeners[0]?.({
      sessionId: 'other-session',
      source: 'microphone',
      sequence: 0,
      sampleRate: 16000,
      channelCount: 1,
      encoding: 'pcm_s16le',
      durationMs: 20,
      capturedAtMs: 0,
      payload: [1, 2],
    })
    frameListeners[0]?.({
      sessionId: session.id,
      source: 'microphone',
      sequence: 7,
      sampleRate: 16000,
      channelCount: 1,
      encoding: 'pcm_s16le',
      durationMs: 20,
      capturedAtMs: 140,
      payload: [1, 2, 3, 4],
    })
    levelListeners[0]?.({
      sessionId: session.id,
      source: 'microphone',
      level: 0.25,
      peak: 0.5,
      isMutedLike: false,
      measuredAtMs: 123,
    })

    await session.pause()
    await session.resume()
    await session.stop()

    expect(startNativeMicrophoneCaptureMock).toHaveBeenCalledWith({
      sessionId: session.id,
      deviceId: 'mic-1',
    })
    expect(frameCallback).toHaveBeenCalledTimes(1)
    expect(frameCallback.mock.calls[0]?.[0]).toMatchObject({
      source: 'microphone',
      sequence: 7,
      sampleRate: 16000,
      channelCount: 1,
      format: 'pcm_s16le',
      durationMs: 20,
      capturedAtMs: 140,
    })
    expect(frameCallback.mock.calls[0]?.[0].payload.byteLength).toBe(4)
    expect(levelCallback).toHaveBeenCalledWith({
      level: 0.25,
      peak: 0.5,
      isMutedLike: false,
      measuredAt: 123,
    })
    expect(pauseNativeCaptureMock).toHaveBeenCalledWith({ sessionId: session.id })
    expect(resumeNativeCaptureMock).toHaveBeenCalledWith({ sessionId: session.id })
    expect(stopNativeCaptureMock).toHaveBeenCalledWith({ sessionId: session.id })
    expect(stateCallback).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'stopped', errorCode: null }),
    )
    expect(unlisteners.every((unlisten) => unlisten.mock.calls.length === 1)).toBe(true)
  })

  it('starts system capture and maps failed state events to stable native errors', async () => {
    startNativeSystemCaptureMock.mockImplementation(async (request) =>
      nativeSession(request.sessionId, 'system'),
    )

    const repository = new TauriAudioCaptureRepository()
    const session = await repository.startSystemAudioCapture()
    const stateCallback = vi.fn()
    session.onStateChange(stateCallback)

    stateListeners[0]?.({
      ...nativeSession(session.id, 'system'),
      state: 'failed',
      error: {
        code: 'device_disconnected',
        message: 'Audio capture device disconnected',
        retryable: true,
      },
    })

    expect(startNativeSystemCaptureMock).toHaveBeenCalledWith({
      sessionId: session.id,
      deviceId: null,
    })
    expect(session.state).toBe('failed')
    expect(stateCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        state: 'failed',
        errorCode: 'system_audio_device_disconnected',
      }),
    )
    expect(unlisteners.every((unlisten) => unlisten.mock.calls.length === 1)).toBe(true)
  })

  it('maps native permission errors into capture errors and clears subscriptions', async () => {
    startNativeMicrophoneCaptureMock.mockRejectedValueOnce({
      code: 'permission_denied',
      message: 'Audio capture permission was denied',
      retryable: false,
    })

    const repository = new TauriAudioCaptureRepository()

    await expect(repository.startMicrophoneCapture()).rejects.toMatchObject({
      code: 'microphone_permission_denied',
    })
    expect(unlisteners.every((unlisten) => unlisten.mock.calls.length === 1)).toBe(true)
  })

  it('maps native device lookup errors into source-specific capture errors', async () => {
    startNativeMicrophoneCaptureMock.mockRejectedValueOnce({
      code: 'device_not_found',
      message: 'Audio capture device was not found',
      retryable: true,
    })
    startNativeSystemCaptureMock.mockRejectedValueOnce({
      code: 'system_audio_unavailable',
      message: 'System audio capture is unavailable',
      retryable: true,
    })

    const repository = new TauriAudioCaptureRepository()

    await expect(repository.startMicrophoneCapture()).rejects.toMatchObject({
      code: 'microphone_device_unavailable',
    })
    await expect(repository.startSystemAudioCapture()).rejects.toMatchObject({
      code: 'system_audio_unavailable',
    })
    expect(unlisteners.every((unlisten) => unlisten.mock.calls.length === 1)).toBe(true)
  })
})
