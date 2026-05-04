import type { LiveUnsubscribe } from '../types'
import type { LiveDeviceInventory, LiveDevicePermissionState, LiveDeviceWarningCode } from './types'
import type { RealtimeRuntimeEnvironment } from '../platform/runtime-environment'
import { getRealtimeRuntimeEnvironment } from '../platform/runtime-environment'

export interface LiveDeviceSelectionState {
  selectedMicrophoneId?: string | null
  activeMicrophoneId?: string | null
  selectedSpeakerId?: string | null
  activeSpeakerId?: string | null
}

export interface LiveDevicePermissionResult {
  state: LiveDevicePermissionState
  granted: boolean
  warning: LiveDeviceWarningCode | null
}

export type LiveDeviceChangeCallback = () => void

export interface LiveAudioDeviceRepository {
  listDevices(state?: LiveDeviceSelectionState): Promise<LiveDeviceInventory>
  requestMicrophonePermission(deviceId?: string): Promise<LiveDevicePermissionResult>
  subscribeToDeviceChanges(callback: LiveDeviceChangeCallback): LiveUnsubscribe
}

export async function createAudioDeviceRepository(
  environment: RealtimeRuntimeEnvironment = getRealtimeRuntimeEnvironment(),
): Promise<LiveAudioDeviceRepository> {
  if (environment === 'tauri') {
    const { createTauriAudioDeviceRepository } = await import('./tauri-audio-device-repository')
    return createTauriAudioDeviceRepository()
  }

  const { createWebAudioDeviceRepository } = await import('./web-audio-device-repository')
  return createWebAudioDeviceRepository()
}
