import type { LiveDurationMs, LiveTimestampMs, LiveUnsubscribe } from '../types'

export type LiveAudioSourceKind = 'microphone' | 'system'

export type LiveCaptureState =
  | 'idle'
  | 'starting'
  | 'capturing'
  | 'paused'
  | 'stopping'
  | 'stopped'
  | 'failed'
  | 'unsupported'

export type LiveCaptureErrorCode =
  | 'microphone_permission_required'
  | 'microphone_permission_denied'
  | 'microphone_capture_unsupported'
  | 'microphone_capture_failed'
  | 'capture_interrupted'
  | 'system_audio_capture_unsupported'
  | 'system_audio_permission_denied'
  | 'system_audio_track_missing'
  | 'system_audio_capture_failed'
  | 'tauri_capture_not_implemented'

export interface LiveAudioLevel {
  level: number
  peak: number
  isMutedLike: boolean
  measuredAt: LiveTimestampMs
}

export interface LiveCaptureStateChange {
  state: LiveCaptureState
  changedAt: LiveTimestampMs
  errorCode: LiveCaptureErrorCode | null
}

export interface LiveCaptureSession {
  id: string
  sourceKind: LiveAudioSourceKind
  deviceId: string | null
  state: LiveCaptureState
  startedAt: LiveTimestampMs
  stop(): Promise<void>
  pause(): Promise<void>
  resume(): Promise<void>
  onLevel(callback: (level: LiveAudioLevel) => void): LiveUnsubscribe
  onStateChange(callback: (change: LiveCaptureStateChange) => void): LiveUnsubscribe
}

export interface LiveMicrophoneCaptureOptions {
  deviceId?: string | null
  levelSampleIntervalMs?: LiveDurationMs
}

export interface LiveSystemAudioCaptureOptions {
  levelSampleIntervalMs?: LiveDurationMs
}
