import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  clearDesktopConnectionConfig,
  getDesktopConnectionRuntimeOptions,
  getDesktopRuntimeInfo,
  invokeTauriCommand,
  listenNativeAudioFrames,
  listenTauriEvent,
  loadDesktopConnectionConfig,
  listNativeAudioDevices,
  pauseNativeCapture,
  resumeNativeCapture,
  saveDesktopConnectionConfig,
  startNativeMicrophoneCapture,
  startNativeSystemCapture,
  stopNativeCapture,
} from '../tauri-api'

const getRuntimeEnvironmentMock = vi.hoisted(() => vi.fn())
const invokeMock = vi.hoisted(() => vi.fn())
const listenMock = vi.hoisted(() => vi.fn())

vi.mock('../runtime-environment', () => ({
  getRuntimeEnvironment: getRuntimeEnvironmentMock,
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: listenMock,
}))

describe('tauri-api boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getRuntimeEnvironmentMock.mockReturnValue('tauri')
  })

  it('blocks command invocation outside the desktop runtime', async () => {
    getRuntimeEnvironmentMock.mockReturnValue('web')

    await expect(invokeTauriCommand('desktop_runtime_info')).rejects.toThrow(
      'Tauri commands are unavailable outside the desktop runtime',
    )
    expect(invokeMock).not.toHaveBeenCalled()
  })

  it('blocks event subscriptions outside the desktop runtime', async () => {
    getRuntimeEnvironmentMock.mockReturnValue('web')

    await expect(listenTauriEvent('native_audio_frame', vi.fn())).rejects.toThrow(
      'Tauri events are unavailable outside the desktop runtime',
    )
    expect(listenMock).not.toHaveBeenCalled()
  })

  it('invokes Tauri commands through the centralized dynamic import boundary', async () => {
    invokeMock.mockResolvedValueOnce({ ok: true })

    await expect(invokeTauriCommand('desktop_runtime_info', { scope: 'shell' })).resolves.toEqual({
      ok: true,
    })
    expect(invokeMock).toHaveBeenCalledWith('desktop_runtime_info', { scope: 'shell' })
  })

  it('fetches desktop runtime info from the shell command', async () => {
    const runtimeInfo = {
      platform: 'windows',
      appVersion: '0.1.0',
      nativeAudioSupport: 'not_implemented',
    }
    invokeMock.mockResolvedValueOnce(runtimeInfo)

    await expect(getDesktopRuntimeInfo()).resolves.toEqual(runtimeInfo)
    expect(invokeMock).toHaveBeenCalledWith('desktop_runtime_info', undefined)
  })

  it('invokes desktop connection config commands through stable command names', async () => {
    const coreSidecarStatus = {
      mode: 'remote',
      httpOrigin: null,
      apiStatus: 'not-started',
      workerStatus: 'not-started',
      dataDir: null,
      logDir: null,
      error: null,
    }
    invokeMock
      .mockResolvedValueOnce({
        backendUrl: 'https://nola.example.com',
        coreSidecarStatus,
        gatewayHttpOrigin: null,
        managedLocalHttpOrigin: null,
      })
      .mockResolvedValueOnce('{"version":1}')
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)

    await expect(getDesktopConnectionRuntimeOptions()).resolves.toEqual({
      backendUrl: 'https://nola.example.com',
      coreSidecarStatus,
      gatewayHttpOrigin: null,
      managedLocalHttpOrigin: null,
    })
    await expect(loadDesktopConnectionConfig()).resolves.toBe('{"version":1}')
    await expect(saveDesktopConnectionConfig('{"version":1}')).resolves.toBeUndefined()
    await expect(clearDesktopConnectionConfig()).resolves.toBeUndefined()

    expect(invokeMock).toHaveBeenNthCalledWith(1, 'desktop_connection_runtime_options', undefined)
    expect(invokeMock).toHaveBeenNthCalledWith(2, 'load_desktop_connection_config', undefined)
    expect(invokeMock).toHaveBeenNthCalledWith(3, 'save_desktop_connection_config', {
      payload: '{"version":1}',
    })
    expect(invokeMock).toHaveBeenNthCalledWith(4, 'clear_desktop_connection_config', undefined)
  })

  it('fetches native audio devices with the current selection state', async () => {
    const current = {
      microphone: {
        selectedDeviceId: 'mic-1',
        activeDeviceId: null,
      },
      speaker: {
        selectedDeviceId: null,
        activeDeviceId: 'speaker-1',
      },
    }
    const inventory = {
      microphones: [],
      speakers: [],
      current,
      permissions: {
        microphone: 'unsupported',
        speakerSelection: 'unsupported',
      },
      capabilities: {
        microphoneCapture: 'unsupported',
        speakerSelection: 'unsupported',
        systemAudioCapture: 'unsupported',
      },
      warnings: ['media_devices_unsupported'],
    }
    invokeMock.mockResolvedValueOnce(inventory)

    await expect(listNativeAudioDevices(current)).resolves.toEqual(inventory)
    expect(invokeMock).toHaveBeenCalledWith('list_native_audio_devices', { current })
  })

  it('invokes native capture commands through stable command names', async () => {
    const request = {
      sessionId: 'capture-1',
      deviceId: 'mic-1',
    }
    const control = {
      sessionId: 'capture-1',
    }
    invokeMock
      .mockResolvedValueOnce({ sessionId: 'capture-1' })
      .mockResolvedValueOnce({ sessionId: 'capture-2' })
      .mockResolvedValueOnce({ sessionId: 'capture-1', state: 'paused' })
      .mockResolvedValueOnce({ sessionId: 'capture-1', state: 'capturing' })
      .mockResolvedValueOnce({ sessionId: 'capture-1', state: 'stopped' })

    await startNativeMicrophoneCapture(request)
    await startNativeSystemCapture({ ...request, sessionId: 'capture-2', deviceId: null })
    await pauseNativeCapture(control)
    await resumeNativeCapture(control)
    await stopNativeCapture(control)

    expect(invokeMock).toHaveBeenNthCalledWith(1, 'start_native_microphone_capture', { request })
    expect(invokeMock).toHaveBeenNthCalledWith(2, 'start_native_system_capture', {
      request: { ...request, sessionId: 'capture-2', deviceId: null },
    })
    expect(invokeMock).toHaveBeenNthCalledWith(3, 'pause_native_capture', { control })
    expect(invokeMock).toHaveBeenNthCalledWith(4, 'resume_native_capture', { control })
    expect(invokeMock).toHaveBeenNthCalledWith(5, 'stop_native_capture', { control })
  })

  it('subscribes to native audio frame events through the centralized event boundary', async () => {
    const unlisten = vi.fn()
    const callback = vi.fn()
    listenMock.mockImplementationOnce(async (_eventName, handler) => {
      handler({ payload: { sessionId: 'capture-1' } })
      return unlisten
    })

    const unsubscribe = await listenNativeAudioFrames(callback)
    unsubscribe()

    expect(listenMock).toHaveBeenCalledWith('native_audio_frame', expect.any(Function))
    expect(callback).toHaveBeenCalledWith({ sessionId: 'capture-1' })
    expect(unlisten).toHaveBeenCalledTimes(1)
  })
})
