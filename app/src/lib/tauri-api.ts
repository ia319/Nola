import { getRuntimeEnvironment } from './runtime-environment'

export type NativeAudioSupportStatus = 'not_implemented' | 'unsupported' | 'available'

export type NativeAudioDeviceKind = 'microphone' | 'speaker'

export type NativeDevicePermissionState =
  | 'granted'
  | 'prompt'
  | 'denied'
  | 'unsupported'
  | 'unknown'

export type NativeRuntimeCapabilityState =
  | 'available'
  | 'limited'
  | 'unsupported'
  | 'not_implemented'

export type NativeDeviceWarningCode =
  | 'microphone_permission_required'
  | 'microphone_permission_denied'
  | 'microphone_device_unavailable'
  | 'microphone_hardware_unavailable'
  | 'speaker_enumeration_unsupported'
  | 'speaker_labels_hidden'
  | 'speaker_selection_unsupported'
  | 'system_audio_capture_limited'
  | 'media_devices_unsupported'
  | 'devicechange_unsupported'
  | 'insecure_context'
  | 'tauri_device_inventory_not_implemented'

export interface DesktopRuntimeInfo {
  platform: string
  appVersion: string
  nativeAudioSupport: NativeAudioSupportStatus
}

export interface NativeDeviceUseStateDto {
  selectedDeviceId: string | null
  activeDeviceId: string | null
}

export interface NativeCurrentDevicesDto {
  microphone: NativeDeviceUseStateDto
  speaker: NativeDeviceUseStateDto
}

export interface NativeAudioDeviceDto {
  id: string
  kind: NativeAudioDeviceKind
  label: string | null
  isDefault: boolean
  isSelected: boolean
  isActive: boolean
}

export interface NativeAudioInventoryDto {
  microphones: NativeAudioDeviceDto[]
  speakers: NativeAudioDeviceDto[]
  current: NativeCurrentDevicesDto
  permissions: {
    microphone: NativeDevicePermissionState
    speakerSelection: NativeDevicePermissionState
  }
  capabilities: {
    microphoneCapture: NativeRuntimeCapabilityState
    speakerSelection: NativeRuntimeCapabilityState
    systemAudioCapture: NativeRuntimeCapabilityState
  }
  warnings: NativeDeviceWarningCode[]
}

export type TauriCommandArgs = Record<string, unknown>

/** Invoke a Tauri command only after the desktop runtime is detected. */
export async function invokeTauriCommand<TResponse>(
  command: string,
  args?: TauriCommandArgs,
): Promise<TResponse> {
  if (getRuntimeEnvironment() !== 'tauri') {
    throw new Error('Tauri commands are unavailable outside the desktop runtime')
  }

  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<TResponse>(command, args)
}

/** Fetch static desktop runtime capabilities from the Tauri shell. */
export function getDesktopRuntimeInfo(): Promise<DesktopRuntimeInfo> {
  return invokeTauriCommand<DesktopRuntimeInfo>('desktop_runtime_info')
}

/** Fetch the native desktop audio device inventory through the Tauri shell. */
export function listNativeAudioDevices(
  current: NativeCurrentDevicesDto,
): Promise<NativeAudioInventoryDto> {
  return invokeTauriCommand<NativeAudioInventoryDto>('list_native_audio_devices', { current })
}
