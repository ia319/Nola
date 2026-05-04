import type { LiveAudioCaptureRepository } from './audio-capture-repository'
import { LiveCaptureError } from './errors'
import type {
  LiveCaptureSession,
  LiveMicrophoneCaptureOptions,
  LiveSystemAudioCaptureOptions,
} from './types'

export class TauriAudioCaptureRepository implements LiveAudioCaptureRepository {
  async startMicrophoneCapture(
    _options?: LiveMicrophoneCaptureOptions,
  ): Promise<LiveCaptureSession> {
    throw new LiveCaptureError('tauri_capture_not_implemented')
  }

  async startSystemAudioCapture(
    _options?: LiveSystemAudioCaptureOptions,
  ): Promise<LiveCaptureSession> {
    throw new LiveCaptureError('tauri_capture_not_implemented')
  }
}

export function createTauriAudioCaptureRepository(): LiveAudioCaptureRepository {
  return new TauriAudioCaptureRepository()
}
