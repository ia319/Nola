import type { LiveDurationMs, LiveTimestampMs } from '../types'

export type LiveOutputDeviceTestStatus = 'played' | 'unsupported' | 'not_implemented' | 'failed'

export type LiveOutputDeviceTestErrorCode =
  | 'set_sink_id_unsupported'
  | 'audio_output_unsupported'
  | 'playback_failed'
  | 'tauri_output_test_not_implemented'

export interface LiveOutputDeviceTestOptions {
  deviceId?: string | null
  durationMs?: LiveDurationMs
  volume?: number
}

export interface LiveOutputDeviceTestResult {
  status: LiveOutputDeviceTestStatus
  deviceId: string | null
  startedAt: LiveTimestampMs
  endedAt: LiveTimestampMs
  errorCode: LiveOutputDeviceTestErrorCode | null
}

export interface LiveOutputDeviceTester {
  testOutputDevice(options?: LiveOutputDeviceTestOptions): Promise<LiveOutputDeviceTestResult>
  stop(): Promise<void>
}
