import { describe, expect, it } from 'vitest'

import { TauriAudioDeviceRepository } from '../tauri-audio-device-repository'

describe('TauriAudioDeviceRepository', () => {
  it('returns a structured placeholder inventory', async () => {
    const repository = new TauriAudioDeviceRepository()

    await expect(
      repository.listDevices({
        selectedMicrophoneId: 'mic-1',
        activeSpeakerId: 'speaker-1',
      }),
    ).resolves.toEqual({
      microphones: [],
      speakers: [],
      current: {
        microphone: {
          selectedDeviceId: 'mic-1',
          activeDeviceId: null,
        },
        speaker: {
          selectedDeviceId: null,
          activeDeviceId: 'speaker-1',
        },
      },
      permissions: {
        microphone: 'unsupported',
        speakerSelection: 'unsupported',
      },
      capabilities: {
        microphoneCapture: 'not_implemented',
        speakerSelection: 'not_implemented',
        systemAudioCapture: 'not_implemented',
      },
      warnings: ['tauri_device_inventory_not_implemented'],
    })
  })

  it('returns a structured placeholder permission result', async () => {
    const repository = new TauriAudioDeviceRepository()

    await expect(repository.requestMicrophonePermission()).resolves.toEqual({
      state: 'unsupported',
      granted: false,
      warning: 'tauri_device_inventory_not_implemented',
    })
  })
})
