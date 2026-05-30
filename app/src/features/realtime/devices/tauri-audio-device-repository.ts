import type {
  NativeAudioDeviceDto,
  NativeAudioInventoryDto,
  NativeCurrentDevicesDto,
  NativeDevicePermissionState,
  NativeDeviceWarningCode,
  NativeRuntimeCapabilityState,
} from '@/lib/tauri-api'
import { listNativeAudioDevices } from '@/lib/tauri-api'

import type {
  LiveAudioDeviceRepository,
  LiveDevicePermissionResult,
  LiveDeviceSelectionState,
} from './audio-device-repository'
import type {
  LiveAudioDevice,
  LiveDeviceCapabilityState,
  LiveDeviceInventory,
  LiveDeviceKind,
  LiveDevicePermissionState,
  LiveDeviceWarningCode,
} from './types'

function buildCurrentState(state: LiveDeviceSelectionState = {}): NativeCurrentDevicesDto {
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

function buildUnavailableInventory(
  state: LiveDeviceSelectionState,
  warning: LiveDeviceWarningCode,
): LiveDeviceInventory {
  return {
    microphones: [],
    speakers: [],
    current: buildCurrentState(state),
    permissions: {
      microphone: 'unknown',
      speakerSelection: 'unsupported',
    },
    capabilities: {
      microphoneCapture: 'unsupported',
      speakerSelection: 'unsupported',
      systemAudioCapture: 'unsupported',
    },
    warnings: [warning],
  }
}

function mapDeviceKind(kind: NativeAudioDeviceDto['kind']): LiveDeviceKind {
  return kind === 'speaker' ? 'speaker' : 'microphone'
}

function mapPermissionState(state: NativeDevicePermissionState): LiveDevicePermissionState {
  if (
    state === 'granted' ||
    state === 'prompt' ||
    state === 'denied' ||
    state === 'unsupported' ||
    state === 'unknown'
  ) {
    return state
  }

  return 'unknown'
}

function mapCapabilityState(state: NativeRuntimeCapabilityState): LiveDeviceCapabilityState {
  if (
    state === 'available' ||
    state === 'limited' ||
    state === 'unsupported' ||
    state === 'not_implemented'
  ) {
    return state
  }

  return 'unsupported'
}

function mapWarningCode(warning: NativeDeviceWarningCode): LiveDeviceWarningCode {
  return warning
}

function mapNativeDevice(device: NativeAudioDeviceDto): LiveAudioDevice {
  return {
    id: device.id,
    kind: mapDeviceKind(device.kind),
    label: device.label,
    groupId: null,
    isTemporary: false,
    isDefault: device.isDefault,
    isSelected: device.isSelected,
    isActive: device.isActive,
  }
}

function mapNativeInventory(inventory: NativeAudioInventoryDto): LiveDeviceInventory {
  return {
    microphones: inventory.microphones.map(mapNativeDevice),
    speakers: inventory.speakers.map(mapNativeDevice),
    current: inventory.current,
    permissions: {
      microphone: mapPermissionState(inventory.permissions.microphone),
      speakerSelection: mapPermissionState(inventory.permissions.speakerSelection),
    },
    capabilities: {
      microphoneCapture: mapCapabilityState(inventory.capabilities.microphoneCapture),
      speakerSelection: mapCapabilityState(inventory.capabilities.speakerSelection),
      systemAudioCapture: mapCapabilityState(inventory.capabilities.systemAudioCapture),
    },
    warnings: inventory.warnings.map(mapWarningCode),
  }
}

function getMicrophonePermissionWarning(
  inventory: LiveDeviceInventory,
  deviceId?: string,
): LiveDeviceWarningCode | null {
  if (inventory.warnings.includes('media_devices_unsupported')) {
    return 'media_devices_unsupported'
  }

  if (deviceId && !inventory.microphones.some((device) => device.id === deviceId)) {
    return 'microphone_device_unavailable'
  }

  if (inventory.warnings.includes('microphone_permission_denied')) {
    return 'microphone_permission_denied'
  }

  if (inventory.warnings.includes('microphone_permission_required')) {
    return 'microphone_permission_required'
  }

  if (inventory.microphones.length === 0) {
    return 'microphone_device_unavailable'
  }

  if (inventory.permissions.microphone === 'unsupported') {
    return 'media_devices_unsupported'
  }

  return null
}

export class TauriAudioDeviceRepository implements LiveAudioDeviceRepository {
  async listDevices(state: LiveDeviceSelectionState = {}): Promise<LiveDeviceInventory> {
    try {
      const inventory = await listNativeAudioDevices(buildCurrentState(state))
      return mapNativeInventory(inventory)
    } catch {
      return buildUnavailableInventory(state, 'media_devices_unsupported')
    }
  }

  async requestMicrophonePermission(deviceId?: string): Promise<LiveDevicePermissionResult> {
    const inventory = await this.listDevices({
      selectedMicrophoneId: deviceId ?? null,
    })
    const warning = getMicrophonePermissionWarning(inventory, deviceId)
    if (warning) {
      return {
        state: inventory.permissions.microphone,
        granted: false,
        warning,
      }
    }

    return {
      state: inventory.permissions.microphone,
      granted: inventory.permissions.microphone === 'granted',
      warning: null,
    }
  }

  subscribeToDeviceChanges(): () => void {
    return () => undefined
  }
}

export function createTauriAudioDeviceRepository(): LiveAudioDeviceRepository {
  return new TauriAudioDeviceRepository()
}
