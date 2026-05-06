import { stopStreamTracks, createLiveCaptureSession } from './capture-session'
import { LiveCaptureError } from './errors'
import type {
  LiveCaptureErrorCode,
  LiveCaptureSession,
  LiveSystemAudioCaptureOptions,
} from './types'

type BrowserMediaDevices = Pick<MediaDevices, 'getDisplayMedia'>

function getBrowserMediaDevices(): BrowserMediaDevices | null {
  if (typeof navigator === 'undefined') {
    return null
  }

  return (navigator.mediaDevices as BrowserMediaDevices | undefined) ?? null
}

function getSystemAudioConstraints(): DisplayMediaStreamOptions {
  return {
    audio: true,
    video: true,
  }
}

function getAudioTracks(stream: MediaStream): MediaStreamTrack[] {
  return stream.getAudioTracks?.() ?? stream.getTracks().filter((track) => track.kind === 'audio')
}

function mapSystemAudioError(error: unknown): LiveCaptureErrorCode {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
      return 'system_audio_permission_denied'
    }

    if (error.name === 'NotFoundError' || error.name === 'NotSupportedError') {
      return 'system_audio_capture_unsupported'
    }
  }

  return 'system_audio_capture_failed'
}

export async function startSystemAudioCapture(
  options: LiveSystemAudioCaptureOptions = {},
): Promise<LiveCaptureSession> {
  const mediaDevices = getBrowserMediaDevices()
  if (!mediaDevices?.getDisplayMedia) {
    throw new LiveCaptureError('system_audio_capture_unsupported')
  }

  let stream: MediaStream
  try {
    stream = await mediaDevices.getDisplayMedia(getSystemAudioConstraints())
  } catch (error) {
    throw new LiveCaptureError(mapSystemAudioError(error))
  }

  if (getAudioTracks(stream).length === 0) {
    stopStreamTracks(stream)
    throw new LiveCaptureError('system_audio_track_missing')
  }

  try {
    return createLiveCaptureSession({
      sourceKind: 'system',
      deviceId: null,
      stream,
      levelSampleIntervalMs: options.levelSampleIntervalMs,
      audioFrameDurationMs: options.audioFrameDurationMs,
    })
  } catch (error) {
    stopStreamTracks(stream)
    throw error
  }
}
