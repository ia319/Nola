import { beforeEach, describe, expect, it, vi } from 'vitest'

import { listNativeAudioDevices, type NativeAudioInventoryDto } from '@/lib/tauri-api'

import { TauriAudioDeviceRepository } from '../tauri-audio-device-repository'

vi.mock('@/lib/tauri-api', () => ({
  listNativeAudioDevices: vi.fn(),
}))

const listNativeAudioDevicesMock = vi.mocked(listNativeAudioDevices)

function buildNativeInventory(): NativeAudioInventoryDto {
  return {
    microphones: [
      {
        id: 'mic-1',
        kind: 'microphone',
        label: 'Desk microphone',
        isDefault: true,
        isSelected: false,
        isActive: true,
      },
      {
        id: 'mic-2',
        kind: 'microphone',
        label: null,
        isDefault: false,
        isSelected: true,
        isActive: false,
      },
    ],
    speakers: [
      {
        id: 'speaker-1',
        kind: 'speaker',
        label: 'Speakers',
        isDefault: true,
        isSelected: true,
        isActive: false,
      },
    ],
    current: {
      microphone: {
        selectedDeviceId: 'mic-2',
        activeDeviceId: 'mic-1',
      },
      speaker: {
        selectedDeviceId: 'speaker-1',
        activeDeviceId: null,
      },
    },
    permissions: {
      microphone: 'granted',
      speakerSelection: 'granted',
    },
    capabilities: {
      microphoneCapture: 'available',
      speakerSelection: 'available',
      systemAudioCapture: 'not_implemented',
    },
    warnings: ['devicechange_unsupported'],
  }
}

describe('TauriAudioDeviceRepository', () => {
  beforeEach(() => {
    listNativeAudioDevicesMock.mockReset()
  })

  it('maps the native inventory into the live device contract', async () => {
    listNativeAudioDevicesMock.mockResolvedValue(buildNativeInventory())
    const repository = new TauriAudioDeviceRepository()

    await expect(
      repository.listDevices({
        selectedMicrophoneId: 'mic-1',
        activeSpeakerId: 'speaker-1',
      }),
    ).resolves.toEqual({
      microphones: [
        {
          id: 'mic-1',
          kind: 'microphone',
          label: 'Desk microphone',
          groupId: null,
          isTemporary: false,
          isDefault: true,
          isSelected: false,
          isActive: true,
        },
        {
          id: 'mic-2',
          kind: 'microphone',
          label: null,
          groupId: null,
          isTemporary: false,
          isDefault: false,
          isSelected: true,
          isActive: false,
        },
      ],
      speakers: [
        {
          id: 'speaker-1',
          kind: 'speaker',
          label: 'Speakers',
          groupId: null,
          isTemporary: false,
          isDefault: true,
          isSelected: true,
          isActive: false,
        },
      ],
      current: {
        microphone: {
          selectedDeviceId: 'mic-2',
          activeDeviceId: 'mic-1',
        },
        speaker: {
          selectedDeviceId: 'speaker-1',
          activeDeviceId: null,
        },
      },
      permissions: {
        microphone: 'granted',
        speakerSelection: 'granted',
      },
      capabilities: {
        microphoneCapture: 'available',
        speakerSelection: 'available',
        systemAudioCapture: 'not_implemented',
      },
      warnings: ['devicechange_unsupported'],
    })
    expect(listNativeAudioDevicesMock).toHaveBeenCalledWith({
      microphone: {
        selectedDeviceId: 'mic-1',
        activeDeviceId: null,
      },
      speaker: {
        selectedDeviceId: null,
        activeDeviceId: 'speaker-1',
      },
    })
  })

  it('returns an unavailable inventory when the native command fails', async () => {
    listNativeAudioDevicesMock.mockRejectedValue(new Error('HRESULT 0x80000000'))
    const repository = new TauriAudioDeviceRepository()

    await expect(repository.listDevices({ selectedMicrophoneId: 'mic-1' })).resolves.toEqual({
      microphones: [],
      speakers: [],
      current: {
        microphone: {
          selectedDeviceId: 'mic-1',
          activeDeviceId: null,
        },
        speaker: {
          selectedDeviceId: null,
          activeDeviceId: null,
        },
      },
      permissions: {
        microphone: 'unknown',
        speakerSelection: 'unsupported',
      },
      capabilities: {
        microphoneCapture: 'unsupported',
        speakerSelection: 'unsupported',
        systemAudioCapture: 'unsupported',
      },
      warnings: ['media_devices_unsupported'],
    })
  })

  it('maps native microphone permission to a granted result', async () => {
    listNativeAudioDevicesMock.mockResolvedValue(buildNativeInventory())
    const repository = new TauriAudioDeviceRepository()

    await expect(repository.requestMicrophonePermission('mic-1')).resolves.toEqual({
      state: 'granted',
      granted: true,
      warning: null,
    })
  })

  it('maps native command failures to a stable permission warning', async () => {
    listNativeAudioDevicesMock.mockRejectedValue(new Error('HRESULT 0x80000000'))
    const repository = new TauriAudioDeviceRepository()

    await expect(repository.requestMicrophonePermission('mic-1')).resolves.toEqual({
      state: 'unknown',
      granted: false,
      warning: 'media_devices_unsupported',
    })
  })

  it('reports unavailable microphones without exposing native command details', async () => {
    listNativeAudioDevicesMock.mockResolvedValue({
      ...buildNativeInventory(),
      microphones: [],
      permissions: {
        microphone: 'unsupported',
        speakerSelection: 'granted',
      },
      capabilities: {
        microphoneCapture: 'unsupported',
        speakerSelection: 'available',
        systemAudioCapture: 'not_implemented',
      },
      warnings: ['microphone_device_unavailable'],
    })
    const repository = new TauriAudioDeviceRepository()

    await expect(repository.requestMicrophonePermission('missing-mic')).resolves.toEqual({
      state: 'unsupported',
      granted: false,
      warning: 'microphone_device_unavailable',
    })
  })
})
