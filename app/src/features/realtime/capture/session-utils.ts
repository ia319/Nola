import type { LiveAudioSourceKind, LiveCaptureSession } from './types'

export function isReusableLiveCaptureSession(
  session: LiveCaptureSession | null | undefined,
  sourceKind: LiveAudioSourceKind,
): session is LiveCaptureSession {
  return session?.sourceKind === sourceKind && session.state === 'capturing'
}
