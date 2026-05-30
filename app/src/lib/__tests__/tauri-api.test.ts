import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getDesktopRuntimeInfo, invokeTauriCommand, listNativeAudioDevices } from '../tauri-api'

const getRuntimeEnvironmentMock = vi.hoisted(() => vi.fn())
const invokeMock = vi.hoisted(() => vi.fn())

vi.mock('../runtime-environment', () => ({
  getRuntimeEnvironment: getRuntimeEnvironmentMock,
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
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
})
