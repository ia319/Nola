import { isTemporaryLiveDeviceId } from '../devices/types'
import { stopStreamTracks, createLiveCaptureSession } from './capture-session'
import { LiveCaptureError } from './errors'
import type {
  LiveCaptureErrorCode,
  LiveCaptureSession,
  LiveMicrophoneCaptureOptions,
} from './types'

type BrowserMediaDevices = Pick<MediaDevices, 'getUserMedia'>

function getBrowserMediaDevices(): BrowserMediaDevices | null {
  if (typeof navigator === 'undefined') {
    return null
  }

  return (navigator.mediaDevices as BrowserMediaDevices | undefined) ?? null
}

function getPersistableDeviceId(deviceId: string | null | undefined): string | null {
  if (!deviceId || isTemporaryLiveDeviceId(deviceId)) {
    return null
  }

  return deviceId
}

function buildMicrophoneConstraints(deviceId: string | null): MediaStreamConstraints {
  return {
    audio: deviceId ? { deviceId: { exact: deviceId } } : true,
  }
}

function mapMicrophoneError(error: unknown): LiveCaptureErrorCode {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
      return 'microphone_permission_denied'
    }

    if (error.name === 'NotFoundError' || error.name === 'NotReadableError') {
      return 'microphone_capture_failed'
    }
  }

  return 'microphone_capture_failed'
}

export async function startMicrophoneCapture(
  options: LiveMicrophoneCaptureOptions = {},
): Promise<LiveCaptureSession> {
  const mediaDevices = getBrowserMediaDevices()
  if (!mediaDevices?.getUserMedia) {
    throw new LiveCaptureError('microphone_capture_unsupported')
  }

  const deviceId = getPersistableDeviceId(options.deviceId)
  let stream: MediaStream

  try {
    stream = await mediaDevices.getUserMedia(buildMicrophoneConstraints(deviceId))
  } catch (error) {
    throw new LiveCaptureError(mapMicrophoneError(error))
  }

  try {
    return createLiveCaptureSession({
      sourceKind: 'microphone',
      deviceId,
      stream,
      levelSampleIntervalMs: options.levelSampleIntervalMs,
    })
  } catch (error) {
    stopStreamTracks(stream)
    throw error
  }
}
