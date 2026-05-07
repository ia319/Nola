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
  RealtimeAudioFrame,
  RealtimeAudioFrameFormat,
  LiveSystemAudioCaptureOptions,
} from './capture/types'
export type { LiveAudioCaptureRepository } from './capture/audio-capture-repository'
export { createAudioCaptureRepository } from './capture/audio-capture-repository'
export { LiveCaptureError } from './capture/errors'
export {
  REALTIME_AUDIO_BYTES_PER_SAMPLE,
  REALTIME_AUDIO_DEFAULT_FRAME_DURATION_MS,
  REALTIME_AUDIO_PCM_FORMAT,
  REALTIME_AUDIO_TARGET_CHANNEL_COUNT,
  REALTIME_AUDIO_TARGET_SAMPLE_RATE,
  buildRealtimeAudioFrame,
  downmixToMono,
  float32ToPcm16le,
  getSamplesPerFrame,
  resampleLinear,
} from './capture/pcm'

export type { LiveSessionDetailQuery } from './api'
export { createLiveSession, finishLiveSession, getLiveSession } from './api'

export type {
  LiveCaptureSessionSnapshot,
  LiveCaptureSlotState,
  LiveDeviceInventoryErrorCode,
  LiveDeviceInventoryStatus,
  LiveDeviceStoreState,
} from './store/live-device-store'
export { getLiveDeviceSelectionState, useLiveDeviceStore } from './store/live-device-store'

export type {
  LiveRealtimeDiagnosticsWavState,
  LiveRealtimeRunState,
  LiveRealtimeRuntimeError,
  LiveRealtimeRuntimeErrorCode,
  LiveRealtimeRuntimeState,
} from './store/live-realtime-store'
export { useLiveRealtimeStore } from './store/live-realtime-store'

export type {
  CreateAudioCaptureRepositoryFunction,
  CreateLiveSessionFunction,
  CreateRealtimeTransportFunction,
  LiveRealtimeSessionServiceDependencies,
  LiveRealtimeSessionStartOptions,
} from './session/live-realtime-session-service'
export {
  LiveRealtimeSessionError,
  LiveRealtimeSessionService,
  createLiveRealtimeSessionService,
  isLiveRealtimeSessionError,
} from './session/live-realtime-session-service'

export type {
  UseLiveDeviceInventoryOptions,
  UseLiveDeviceInventoryReturn,
} from './hooks/useLiveDeviceInventory'
export { useLiveDeviceInventory } from './hooks/useLiveDeviceInventory'

export type {
  RealtimeRuntimeAdapterFactory,
  RealtimeRuntimeEnvironment,
} from './platform/runtime-environment'
export {
  createRealtimeRuntimeAdapter,
  getRealtimeRuntimeEnvironment,
} from './platform/runtime-environment'

export type {
  LiveRealtimeAudioContract,
  LiveRealtimeAudioFrame,
  LiveRealtimeAudioFrameMetadataEvent,
  LiveRealtimeClientCapabilities,
  LiveRealtimeClientControlEventInput,
  LiveRealtimeClientEvent,
  LiveRealtimeClientEventType,
  LiveRealtimeConnectionState,
  LiveRealtimeConnectOptions,
  LiveRealtimeDiagnosticsWavFile,
  LiveRealtimeDiagnosticsWavStartOptions,
  LiveRealtimeDiagnosticsWavStartedEvent,
  LiveRealtimeDiagnosticsWavStoppedEvent,
  LiveRealtimeErrorCode,
  LiveRealtimeServerEvent,
  LiveRealtimeServerEventCallback,
  LiveRealtimeServerEventType,
  LiveRealtimeServerReadyEvent,
  LiveRealtimeTrackStartOptions,
  LiveRealtimeTrackStopOptions,
  LiveRealtimeTransport,
  LiveRealtimeTransportErrorCode,
  LiveRealtimeTransportErrorShape,
  LiveRealtimeTransportStateCallback,
  LiveRealtimeTransportStateChange,
  LiveRealtimeTranscriptCommittedPartialEvent,
  LiveRealtimeTranscriptCommittedPartialPayload,
  LiveRealtimeTranscriptFinalEvent,
  LiveRealtimeTranscriptFinalPayload,
  LiveRealtimeTranscriptPreviewEvent,
  LiveRealtimeTranscriptPreviewPayload,
} from './transport/types'
export {
  LIVE_REALTIME_AUDIO_CHANNEL_COUNT,
  LIVE_REALTIME_AUDIO_ENCODING,
  LIVE_REALTIME_AUDIO_SAMPLE_RATE,
  LIVE_REALTIME_DEFAULT_CLIENT_CAPABILITIES,
  LIVE_REALTIME_PROTOCOL_VERSION,
  buildLiveRealtimeWebSocketUrl,
  isLiveRealtimeServerEvent,
  isLiveRealtimeServerEventType,
  parseLiveRealtimeServerEvent,
} from './transport/protocol'
export { LiveRealtimeTransportError, isLiveRealtimeTransportError } from './transport/errors'
export type { CreateRealtimeTransportOptions } from './transport/realtime-transport'
export { createRealtimeTransport } from './transport/realtime-transport'
