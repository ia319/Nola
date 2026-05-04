import type {
  LiveCaptureSession,
  LiveMicrophoneCaptureOptions,
  LiveSystemAudioCaptureOptions,
} from './types'
import type { RealtimeRuntimeEnvironment } from '../platform/runtime-environment'
import { getRealtimeRuntimeEnvironment } from '../platform/runtime-environment'

export interface LiveAudioCaptureRepository {
  startMicrophoneCapture(options?: LiveMicrophoneCaptureOptions): Promise<LiveCaptureSession>
  startSystemAudioCapture(options?: LiveSystemAudioCaptureOptions): Promise<LiveCaptureSession>
}

export async function createAudioCaptureRepository(
  environment: RealtimeRuntimeEnvironment = getRealtimeRuntimeEnvironment(),
): Promise<LiveAudioCaptureRepository> {
  if (environment === 'tauri') {
    const { createTauriAudioCaptureRepository } = await import('./tauri-audio-capture-repository')
    return createTauriAudioCaptureRepository()
  }

  const { createWebAudioCaptureRepository } = await import('./web-audio-capture-repository')
  return createWebAudioCaptureRepository()
}
