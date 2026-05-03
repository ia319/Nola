import type { LiveRuntimeCapabilityState } from '../types'

export type LiveDeviceKind = 'microphone' | 'speaker'

export type LiveDevicePermissionState = 'granted' | 'prompt' | 'denied' | 'unsupported' | 'unknown'

export type LiveDeviceCapabilityState = LiveRuntimeCapabilityState

export interface LiveDeviceUseState {
  selectedDeviceId: string | null
  activeDeviceId: string | null
}

export type LiveDeviceWarningCode =
  | 'microphone_permission_required'
  | 'microphone_permission_denied'
  | 'speaker_enumeration_unsupported'
  | 'speaker_labels_hidden'
  | 'speaker_selection_unsupported'
  | 'system_audio_capture_limited'
  | 'media_devices_unsupported'
  | 'devicechange_unsupported'
  | 'insecure_context'
  | 'tauri_device_inventory_not_implemented'

export interface LiveAudioDevice {
  id: string
  kind: LiveDeviceKind
  label: string | null
  groupId: string | null
  isDefault: boolean
  isSelected: boolean
  isActive: boolean
}

export interface LiveDeviceInventory {
  microphones: LiveAudioDevice[]
  speakers: LiveAudioDevice[]
  current: {
    microphone: LiveDeviceUseState
    speaker: LiveDeviceUseState
  }
  permissions: {
    microphone: LiveDevicePermissionState
    speakerSelection: LiveDevicePermissionState
  }
  capabilities: {
    microphoneCapture: LiveDeviceCapabilityState
    speakerSelection: LiveDeviceCapabilityState
    systemAudioCapture: LiveDeviceCapabilityState
  }
  warnings: LiveDeviceWarningCode[]
}
