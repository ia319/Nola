export type {
  LiveDurationMs,
  LiveRuntimeCapabilityState,
  LiveTimestampMs,
  LiveUnsubscribe,
} from './types'

export type {
  LiveAudioDevice,
  LiveDeviceCapabilityState,
  LiveDeviceInventory,
  LiveDeviceKind,
  LiveDevicePermissionState,
  LiveDeviceUseState,
  LiveDeviceWarningCode,
} from './devices/types'
export { TEMPORARY_LIVE_DEVICE_ID_PREFIX, isTemporaryLiveDeviceId } from './devices/types'
export type {
  LiveAudioDeviceRepository,
  LiveDeviceChangeCallback,
  LiveDevicePermissionResult,
  LiveDeviceSelectionState,
} from './devices/audio-device-repository'
export { createAudioDeviceRepository } from './devices/audio-device-repository'
export { installLiveDeviceDiagnostics, logLiveDeviceInventory } from './devices/diagnostics'

export type {
  LiveAudioLevel,
  LiveAudioSourceKind,
  LiveCaptureErrorCode,
  LiveCaptureSession,
  LiveCaptureState,
  LiveCaptureStateChange,
  LiveMicrophoneCaptureOptions,
  LiveSystemAudioCaptureOptions,
} from './capture/types'
export type { LiveAudioCaptureRepository } from './capture/audio-capture-repository'
export { createAudioCaptureRepository } from './capture/audio-capture-repository'
export { LiveCaptureError } from './capture/errors'

export type {
  RealtimeRuntimeAdapterFactory,
  RealtimeRuntimeEnvironment,
} from './platform/runtime-environment'
export {
  createRealtimeRuntimeAdapter,
  getRealtimeRuntimeEnvironment,
} from './platform/runtime-environment'
