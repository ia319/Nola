import type { LiveCaptureErrorCode } from './types'

export class LiveCaptureError extends Error {
  readonly code: LiveCaptureErrorCode

  constructor(code: LiveCaptureErrorCode, message = code) {
    super(message)
    this.name = 'LiveCaptureError'
    this.code = code
  }
}
