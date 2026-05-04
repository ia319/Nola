import { afterEach, describe, expect, it } from 'vitest'

import { getLiveDeviceSelectionState, useLiveDeviceStore } from '../live-device-store'
import type { LiveCaptureStateChange } from '../../capture/types'

const STOPPED_CHANGE: LiveCaptureStateChange = {
  state: 'stopped',
  changedAt: 1,
  errorCode: null,
}

afterEach(() => {
  useLiveDeviceStore.getState().resetLiveDeviceState()
})

describe('live device store', () => {
  it('keeps temporary browser device IDs out of selectable state', () => {
    const store = useLiveDeviceStore.getState()

    store.setSelectedMicrophoneId('temp-microphone-1')
    store.setSelectedSpeakerId('speaker-1')
    store.setActiveSpeakerId('temp-speaker-1')

    const state = useLiveDeviceStore.getState()
    expect(state.selectedMicrophoneId).toBeNull()
    expect(state.selectedSpeakerId).toBe('speaker-1')
    expect(state.activeSpeakerId).toBeNull()
    expect(getLiveDeviceSelectionState(state)).toEqual({
      selectedMicrophoneId: null,
      activeMicrophoneId: null,
      selectedSpeakerId: 'speaker-1',
      activeSpeakerId: null,
    })
  })

  it('stores inventory readiness separately from structured inventory data', () => {
    const store = useLiveDeviceStore.getState()

    store.setInventoryLoading()
    expect(useLiveDeviceStore.getState().inventoryStatus).toBe('loading')

    store.setInventoryReady({
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
        systemAudioCapture: 'limited',
      },
      warnings: ['speaker_selection_unsupported'],
    })

    const state = useLiveDeviceStore.getState()
    expect(state.inventoryStatus).toBe('ready')
    expect(state.inventory?.warnings).toEqual(['speaker_selection_unsupported'])
    expect(state.inventoryError).toBeNull()
  })

  it('clears active microphone state when microphone capture stops', () => {
    const store = useLiveDeviceStore.getState()

    store.setMicrophoneCaptureSession({
      sessionId: 'session-1',
      deviceId: 'mic-1',
      startedAt: 1,
    })
    expect(useLiveDeviceStore.getState().activeMicrophoneId).toBe('mic-1')

    store.setMicrophoneCaptureState(STOPPED_CHANGE)

    const state = useLiveDeviceStore.getState()
    expect(state.activeMicrophoneId).toBeNull()
    expect(state.microphoneCapture.state).toBe('stopped')
  })

  it('keeps system audio capture state separate from speaker devices', () => {
    const store = useLiveDeviceStore.getState()

    store.setSelectedSpeakerId('speaker-1')
    store.setSystemAudioCaptureSession({
      sessionId: 'system-session-1',
      deviceId: null,
      startedAt: 1,
    })
    store.setSystemAudioCaptureState(STOPPED_CHANGE)

    const state = useLiveDeviceStore.getState()
    expect(state.selectedSpeakerId).toBe('speaker-1')
    expect(state.systemAudioCapture).toMatchObject({
      sessionId: 'system-session-1',
      sourceKind: 'system',
      deviceId: null,
      state: 'stopped',
    })
  })
})
