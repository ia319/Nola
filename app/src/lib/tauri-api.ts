import { getRuntimeEnvironment } from './runtime-environment'

export type NativeAudioSupportStatus = 'not_implemented' | 'unsupported' | 'available'

export type NativeAudioDeviceKind = 'microphone' | 'speaker'
export type NativeAudioSource = 'microphone' | 'system'

export type NativeCaptureState =
  | 'idle'
  | 'starting'
  | 'capturing'
  | 'paused'
  | 'stopping'
  | 'stopped'
  | 'failed'
  | 'unsupported'

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

export type NativeAudioErrorCode =
  | 'command_not_implemented'
  | 'session_id_invalid'
  | 'session_params_mismatch'
  | 'session_not_found'
  | 'session_state_invalid'
  | 'device_not_found'
  | 'device_disconnected'
  | 'system_audio_unavailable'
  | 'permission_denied'
  | 'capture_failed'
  | 'internal_error'

export const NATIVE_AUDIO_FRAME_EVENT = 'native_audio_frame'
export const NATIVE_AUDIO_LEVEL_EVENT = 'native_audio_level'
export const NATIVE_AUDIO_STATE_EVENT = 'native_audio_state'

export interface DesktopRuntimeInfo {
  platform: string
  appVersion: string
  nativeAudioSupport: NativeAudioSupportStatus
}

export interface DesktopConnectionRuntimeOptionsDto {
  backendUrl: string | null
  managedLocalHttpOrigin: string | null
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

export interface NativeStartCaptureRequestDto {
  sessionId: string
  deviceId: string | null
}

export interface NativeCaptureSessionControlDto {
  sessionId: string
}

export interface NativeCaptureSessionDto {
  sessionId: string
  source: NativeAudioSource
  deviceId: string | null
  state: NativeCaptureState
  startedAtMs: number
  error?: NativeAudioErrorDto | null
}

export interface NativeAudioFrameEventDto {
  sessionId: string
  source: NativeAudioSource
  sequence: number
  sampleRate: number
  channelCount: number
  encoding: string
  durationMs: number
  capturedAtMs: number
  payload: number[]
}

export interface NativeAudioLevelEventDto {
  sessionId: string
  source: NativeAudioSource
  level: number
  peak: number
  isMutedLike: boolean
  measuredAtMs: number
}

export interface NativeAudioErrorDto {
  code: NativeAudioErrorCode
  message: string
  retryable: boolean
}

export type TauriCommandArgs = Record<string, unknown>
export type TauriUnlisten = () => void
export type TauriEventCallback<TPayload> = (payload: TPayload) => void

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

/** Subscribe to a Tauri event only after the desktop runtime is detected. */
export async function listenTauriEvent<TPayload>(
  eventName: string,
  callback: TauriEventCallback<TPayload>,
): Promise<TauriUnlisten> {
  if (getRuntimeEnvironment() !== 'tauri') {
    throw new Error('Tauri events are unavailable outside the desktop runtime')
  }

  const { listen } = await import('@tauri-apps/api/event')
  const unlisten = await listen<TPayload>(eventName, (event) => {
    callback(event.payload)
  })

  return () => {
    void unlisten()
  }
}

/** Fetch static desktop runtime capabilities from the Tauri shell. */
export function getDesktopRuntimeInfo(): Promise<DesktopRuntimeInfo> {
  return invokeTauriCommand<DesktopRuntimeInfo>('desktop_runtime_info')
}

export function getDesktopConnectionRuntimeOptions(): Promise<DesktopConnectionRuntimeOptionsDto> {
  return invokeTauriCommand<DesktopConnectionRuntimeOptionsDto>(
    'desktop_connection_runtime_options',
  )
}

export function loadDesktopConnectionConfig(): Promise<string | null> {
  return invokeTauriCommand<string | null>('load_desktop_connection_config')
}

export function saveDesktopConnectionConfig(payload: string): Promise<void> {
  return invokeTauriCommand<void>('save_desktop_connection_config', { payload })
}

export function clearDesktopConnectionConfig(): Promise<void> {
  return invokeTauriCommand<void>('clear_desktop_connection_config')
}

/** Fetch the native desktop audio device inventory through the Tauri shell. */
export function listNativeAudioDevices(
  current: NativeCurrentDevicesDto,
): Promise<NativeAudioInventoryDto> {
  return invokeTauriCommand<NativeAudioInventoryDto>('list_native_audio_devices', { current })
}

export function startNativeMicrophoneCapture(
  request: NativeStartCaptureRequestDto,
): Promise<NativeCaptureSessionDto> {
  return invokeTauriCommand<NativeCaptureSessionDto>('start_native_microphone_capture', {
    request,
  })
}

export function startNativeSystemCapture(
  request: NativeStartCaptureRequestDto,
): Promise<NativeCaptureSessionDto> {
  return invokeTauriCommand<NativeCaptureSessionDto>('start_native_system_capture', { request })
}

export function pauseNativeCapture(
  control: NativeCaptureSessionControlDto,
): Promise<NativeCaptureSessionDto> {
  return invokeTauriCommand<NativeCaptureSessionDto>('pause_native_capture', { control })
}

export function resumeNativeCapture(
  control: NativeCaptureSessionControlDto,
): Promise<NativeCaptureSessionDto> {
  return invokeTauriCommand<NativeCaptureSessionDto>('resume_native_capture', { control })
}

export function stopNativeCapture(
  control: NativeCaptureSessionControlDto,
): Promise<NativeCaptureSessionDto> {
  return invokeTauriCommand<NativeCaptureSessionDto>('stop_native_capture', { control })
}

export function listenNativeAudioFrames(
  callback: TauriEventCallback<NativeAudioFrameEventDto>,
): Promise<TauriUnlisten> {
  return listenTauriEvent(NATIVE_AUDIO_FRAME_EVENT, callback)
}

export function listenNativeAudioLevels(
  callback: TauriEventCallback<NativeAudioLevelEventDto>,
): Promise<TauriUnlisten> {
  return listenTauriEvent(NATIVE_AUDIO_LEVEL_EVENT, callback)
}

export function listenNativeCaptureStates(
  callback: TauriEventCallback<NativeCaptureSessionDto>,
): Promise<TauriUnlisten> {
  return listenTauriEvent(NATIVE_AUDIO_STATE_EVENT, callback)
}
