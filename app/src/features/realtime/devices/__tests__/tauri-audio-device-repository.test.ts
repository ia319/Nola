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

  it('returns a not-implemented inventory when the native command is unavailable', async () => {
    listNativeAudioDevicesMock.mockRejectedValue({
      code: 'command_not_implemented',
      message: 'Native device inventory is not implemented',
      retryable: false,
    })
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
        microphoneCapture: 'not_implemented',
        speakerSelection: 'not_implemented',
        systemAudioCapture: 'not_implemented',
      },
      warnings: ['tauri_device_inventory_not_implemented'],
    })
  })

  it('rejects retryable native inventory failures', async () => {
    const error = {
      code: 'internal_error',
      message: 'Audio device enumeration failed',
      retryable: true,
    }
    listNativeAudioDevicesMock.mockRejectedValue(error)
    const repository = new TauriAudioDeviceRepository()

    await expect(repository.listDevices()).rejects.toBe(error)
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

  it('maps unavailable native commands to a stable permission warning', async () => {
    listNativeAudioDevicesMock.mockRejectedValue({
      code: 'command_not_implemented',
      message: 'Native device inventory is not implemented',
      retryable: false,
    })
    const repository = new TauriAudioDeviceRepository()

    await expect(repository.requestMicrophonePermission('mic-1')).resolves.toEqual({
      state: 'unknown',
      granted: false,
      warning: 'tauri_device_inventory_not_implemented',
    })
  })

  it('rejects permission requests when native inventory fails', async () => {
    const error = {
      code: 'internal_error',
      message: 'Audio device enumeration failed',
      retryable: true,
    }
    listNativeAudioDevicesMock.mockRejectedValue(error)
    const repository = new TauriAudioDeviceRepository()

    await expect(repository.requestMicrophonePermission('mic-1')).rejects.toBe(error)
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
