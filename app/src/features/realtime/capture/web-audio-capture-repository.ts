import type { LiveAudioCaptureRepository } from './audio-capture-repository'
import type {
  LiveCaptureSession,
  LiveMicrophoneCaptureOptions,
  LiveSystemAudioCaptureOptions,
} from './types'
import { startMicrophoneCapture } from './web-microphone-capture'
import { startSystemAudioCapture } from './web-system-audio-capture'

export class WebAudioCaptureRepository implements LiveAudioCaptureRepository {
  startMicrophoneCapture(options?: LiveMicrophoneCaptureOptions): Promise<LiveCaptureSession> {
    return startMicrophoneCapture(options)
  }

  startSystemAudioCapture(options?: LiveSystemAudioCaptureOptions): Promise<LiveCaptureSession> {
    return startSystemAudioCapture(options)
  }
}

export function createWebAudioCaptureRepository(): LiveAudioCaptureRepository {
  return new WebAudioCaptureRepository()
}
