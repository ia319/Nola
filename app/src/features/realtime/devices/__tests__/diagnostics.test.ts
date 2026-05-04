// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'

import { installLiveDeviceDiagnostics, logLiveDeviceInventory } from '../diagnostics'
import type { LiveAudioDeviceRepository } from '../audio-device-repository'
import type { LiveDeviceInventory } from '../types'

type DiagnosticWindow = Window & {
  __NOLA_LIVE_DEVICES__?: unknown
}

const inventory: LiveDeviceInventory = {
  microphones: [],
  speakers: [],
  current: {
    microphone: {
      selectedDeviceId: null,
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
    microphoneCapture: 'available',
    speakerSelection: 'unsupported',
    systemAudioCapture: 'unsupported',
  },
  warnings: [],
}

describe('live device diagnostics', () => {
  afterEach(() => {
    delete (window as DiagnosticWindow).__NOLA_LIVE_DEVICES__
  })

  it('logs and returns inventory through an injected repository', async () => {
    const repository: LiveAudioDeviceRepository = {
      listDevices: vi.fn().mockResolvedValue(inventory),
      requestMicrophonePermission: vi.fn(),
      subscribeToDeviceChanges: vi.fn(),
    }

    await expect(logLiveDeviceInventory(undefined, repository)).resolves.toBe(inventory)
    expect(repository.listDevices).toHaveBeenCalledTimes(1)
  })

  it('installs a dev-only browser console helper', () => {
    installLiveDeviceDiagnostics()

    expect((window as DiagnosticWindow).__NOLA_LIVE_DEVICES__).toEqual({
      logInventory: expect.any(Function),
    })
  })
})
