import type { LiveAudioSourceKind } from './types'

let captureSessionSequence = 0

export function createLiveCaptureSessionId(sourceKind: LiveAudioSourceKind): string {
  captureSessionSequence += 1
  return `live-${sourceKind}-${Date.now()}-${captureSessionSequence}`
}
