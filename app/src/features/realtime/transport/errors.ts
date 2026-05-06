import type {
  LiveRealtimeServerErrorEvent,
  LiveRealtimeTransportErrorCode,
  LiveRealtimeTransportErrorShape,
} from './types'

export interface LiveRealtimeTransportErrorOptions {
  code: LiveRealtimeTransportErrorCode
  message: string
  retryable?: boolean
}

export class LiveRealtimeTransportError extends Error implements LiveRealtimeTransportErrorShape {
  code: LiveRealtimeTransportErrorCode
  retryable: boolean

  constructor(options: LiveRealtimeTransportErrorOptions) {
    super(options.message)
    this.name = 'LiveRealtimeTransportError'
    this.code = options.code
    this.retryable = options.retryable ?? false
  }
}

export function isLiveRealtimeTransportError(value: unknown): value is LiveRealtimeTransportError {
  return value instanceof LiveRealtimeTransportError
}

export function mapServerErrorEvent(
  event: LiveRealtimeServerErrorEvent,
): LiveRealtimeTransportError {
  return new LiveRealtimeTransportError({
    code: event.error.code,
    message: event.error.message,
    retryable: false,
  })
}

export function normalizeTransportError(
  value: unknown,
  fallback: LiveRealtimeTransportErrorOptions,
): LiveRealtimeTransportError {
  if (isLiveRealtimeTransportError(value)) {
    return value
  }

  if (value instanceof Error && value.message) {
    return new LiveRealtimeTransportError({
      ...fallback,
      message: value.message,
    })
  }

  return new LiveRealtimeTransportError(fallback)
}
