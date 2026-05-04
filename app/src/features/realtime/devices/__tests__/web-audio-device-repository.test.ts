// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'

import { WebAudioDeviceRepository } from '../web-audio-device-repository'

const originalSetSinkIdDescriptor = Object.getOwnPropertyDescriptor(
  HTMLMediaElement.prototype,
  'setSinkId',
)

function buildDevice(
  kind: MediaDeviceKind,
  deviceId: string,
  label = '',
  groupId = '',
): MediaDeviceInfo {
  return {
    kind,
    deviceId,
    label,
    groupId,
    toJSON: () => ({}),
  } as MediaDeviceInfo
}

function buildStream(stop = vi.fn()): MediaStream {
  return {
    getTracks: () => [{ stop }],
  } as unknown as MediaStream
}

function setSpeakerSelectionSupport(enabled: boolean): void {
  if (enabled) {
    Object.defineProperty(HTMLMediaElement.prototype, 'setSinkId', {
      configurable: true,
      value: vi.fn(),
    })
    return
  }

  Reflect.deleteProperty(HTMLMediaElement.prototype, 'setSinkId')
}

function restoreSpeakerSelectionSupport(): void {
  Reflect.deleteProperty(HTMLMediaElement.prototype, 'setSinkId')
  if (originalSetSinkIdDescriptor) {
    Object.defineProperty(HTMLMediaElement.prototype, 'setSinkId', originalSetSinkIdDescriptor)
  }
}

describe('WebAudioDeviceRepository', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    restoreSpeakerSelectionSupport()
  })

  it('maps browser devices into microphone and speaker inventories', async () => {
    setSpeakerSelectionSupport(true)
    vi.stubGlobal('navigator', {
      mediaDevices: {
        enumerateDevices: vi
          .fn()
          .mockResolvedValue([
            buildDevice('audioinput', 'default', 'System microphone', 'group-1'),
            buildDevice('audioinput', 'mic-2', 'USB microphone', 'group-2'),
            buildDevice('audiooutput', 'speaker-1', 'USB speaker', 'group-3'),
          ]),
        getUserMedia: vi.fn(),
        getDisplayMedia: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
      permissions: {
        query: vi.fn().mockResolvedValue({ state: 'granted' }),
      },
    })

    const repository = new WebAudioDeviceRepository()
    const inventory = await repository.listDevices({
      selectedMicrophoneId: 'mic-2',
      activeMicrophoneId: 'default',
      selectedSpeakerId: 'speaker-1',
      activeSpeakerId: 'speaker-1',
    })

    expect(inventory.microphones).toEqual([
      {
        id: 'default',
        kind: 'microphone',
        label: 'System microphone',
        groupId: 'group-1',
        isDefault: true,
        isSelected: false,
        isActive: true,
      },
      {
        id: 'mic-2',
        kind: 'microphone',
        label: 'USB microphone',
        groupId: 'group-2',
        isDefault: false,
        isSelected: true,
        isActive: false,
      },
    ])
    expect(inventory.speakers).toEqual([
      {
        id: 'speaker-1',
        kind: 'speaker',
        label: 'USB speaker',
        groupId: 'group-3',
        isDefault: false,
        isSelected: true,
        isActive: true,
      },
    ])
    expect(inventory.permissions.microphone).toBe('granted')
    expect(inventory.capabilities).toEqual({
      microphoneCapture: 'available',
      speakerSelection: 'available',
      systemAudioCapture: 'limited',
    })
    expect(inventory.warnings).toEqual(['system_audio_capture_limited'])
  })

  it('returns structured unsupported inventory when mediaDevices is unavailable', async () => {
    vi.stubGlobal('navigator', {})

    const repository = new WebAudioDeviceRepository()
    const inventory = await repository.listDevices({
      selectedMicrophoneId: 'mic-1',
      activeSpeakerId: 'speaker-1',
    })

    expect(inventory).toEqual({
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
        microphoneCapture: 'unsupported',
        speakerSelection: 'unsupported',
        systemAudioCapture: 'unsupported',
      },
      warnings: ['media_devices_unsupported'],
    })
  })

  it('uses fallback labels and warning codes when labels are hidden', async () => {
    setSpeakerSelectionSupport(false)
    vi.stubGlobal('navigator', {
      mediaDevices: {
        enumerateDevices: vi
          .fn()
          .mockResolvedValue([
            buildDevice('audioinput', 'mic-1'),
            buildDevice('audiooutput', 'speaker-1'),
          ]),
        getUserMedia: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    })

    const repository = new WebAudioDeviceRepository()
    const inventory = await repository.listDevices()

    expect(inventory.microphones[0]?.label).toBe('Microphone 1')
    expect(inventory.speakers[0]?.label).toBe('Speaker 1')
    expect(inventory.permissions.microphone).toBe('unknown')
    expect(inventory.permissions.speakerSelection).toBe('unsupported')
    expect(inventory.warnings).toEqual([
      'microphone_permission_required',
      'speaker_labels_hidden',
      'speaker_selection_unsupported',
    ])
  })

  it('warns when speaker enumeration returns no output devices', async () => {
    setSpeakerSelectionSupport(true)
    vi.stubGlobal('navigator', {
      mediaDevices: {
        enumerateDevices: vi.fn().mockResolvedValue([buildDevice('audioinput', 'mic-1', 'Mic')]),
        getUserMedia: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
      permissions: {
        query: vi.fn().mockResolvedValue({ state: 'granted' }),
      },
    })

    const repository = new WebAudioDeviceRepository()
    const inventory = await repository.listDevices()

    expect(inventory.speakers).toEqual([])
    expect(inventory.warnings).toContain('speaker_enumeration_unsupported')
  })

  it('warns when devicechange events are unavailable', async () => {
    setSpeakerSelectionSupport(true)
    vi.stubGlobal('navigator', {
      mediaDevices: {
        enumerateDevices: vi
          .fn()
          .mockResolvedValue([
            buildDevice('audioinput', 'mic-1', 'Mic'),
            buildDevice('audiooutput', 'speaker-1', 'Speaker'),
          ]),
        getUserMedia: vi.fn(),
      },
      permissions: {
        query: vi.fn().mockResolvedValue({ state: 'granted' }),
      },
    })

    const repository = new WebAudioDeviceRepository()
    const inventory = await repository.listDevices()

    expect(inventory.warnings).toContain('devicechange_unsupported')
  })

  it('requests microphone permission with an exact device constraint and stops tracks', async () => {
    const stop = vi.fn()
    const getUserMedia = vi.fn().mockResolvedValue(buildStream(stop))
    vi.stubGlobal('navigator', {
      mediaDevices: {
        enumerateDevices: vi.fn(),
        getUserMedia,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    })

    const repository = new WebAudioDeviceRepository()
    const result = await repository.requestMicrophonePermission('mic-1')

    expect(getUserMedia).toHaveBeenCalledWith({
      audio: { deviceId: { exact: 'mic-1' } },
    })
    expect(stop).toHaveBeenCalledTimes(1)
    expect(result).toEqual({
      state: 'granted',
      granted: true,
      warning: null,
    })
  })

  it('maps microphone permission denial into a stable result', async () => {
    vi.stubGlobal('navigator', {
      mediaDevices: {
        enumerateDevices: vi.fn(),
        getUserMedia: vi
          .fn()
          .mockRejectedValue(new DOMException('Permission denied', 'NotAllowedError')),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    })

    const repository = new WebAudioDeviceRepository()

    await expect(repository.requestMicrophonePermission()).resolves.toEqual({
      state: 'denied',
      granted: false,
      warning: 'microphone_permission_denied',
    })
  })

  it('subscribes to devicechange and cleans up the listener', () => {
    const addEventListener = vi.fn()
    const removeEventListener = vi.fn()
    const callback = vi.fn()
    vi.stubGlobal('navigator', {
      mediaDevices: {
        enumerateDevices: vi.fn(),
        getUserMedia: vi.fn(),
        addEventListener,
        removeEventListener,
      },
    })

    const repository = new WebAudioDeviceRepository()
    const unsubscribe = repository.subscribeToDeviceChanges(callback)

    expect(addEventListener).toHaveBeenCalledWith('devicechange', callback)
    unsubscribe()
    expect(removeEventListener).toHaveBeenCalledWith('devicechange', callback)
  })
})
