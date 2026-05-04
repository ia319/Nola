import type {
  LiveAudioDeviceRepository,
  LiveDevicePermissionResult,
  LiveDeviceSelectionState,
} from './audio-device-repository'
import type { LiveDeviceInventory } from './types'

function buildCurrentState(state: LiveDeviceSelectionState = {}): LiveDeviceInventory['current'] {
  return {
    microphone: {
      selectedDeviceId: state.selectedMicrophoneId ?? null,
      activeDeviceId: state.activeMicrophoneId ?? null,
    },
    speaker: {
      selectedDeviceId: state.selectedSpeakerId ?? null,
      activeDeviceId: state.activeSpeakerId ?? null,
    },
  }
}

export class TauriAudioDeviceRepository implements LiveAudioDeviceRepository {
  async listDevices(state: LiveDeviceSelectionState = {}): Promise<LiveDeviceInventory> {
    return {
      microphones: [],
      speakers: [],
      current: buildCurrentState(state),
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
    }
  }

  async requestMicrophonePermission(): Promise<LiveDevicePermissionResult> {
    return {
      state: 'unsupported',
      granted: false,
      warning: 'tauri_device_inventory_not_implemented',
    }
  }

  subscribeToDeviceChanges(): () => void {
    return () => undefined
  }
}

export function createTauriAudioDeviceRepository(): LiveAudioDeviceRepository {
  return new TauriAudioDeviceRepository()
}
