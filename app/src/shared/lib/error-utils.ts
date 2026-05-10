import type { ApiError } from '@/shared/types'

function isDetailObject(value: unknown): value is { code?: unknown; message?: unknown } {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Normalize FastAPI error payloads to a single readable message string. */
export function formatApiError(data: ApiError): string {
  if (typeof data.detail === 'string') return data.detail
  if (Array.isArray(data.detail)) return data.detail.map((item) => item.msg).join('; ')
  if (isDetailObject(data.detail) && typeof data.detail.message === 'string') {
    return data.detail.message
  }

  return 'Unexpected API error'
}

/** Return a stable backend error code when the API includes one. */
export function getApiErrorCode(data: ApiError): string | undefined {
  if (!isDetailObject(data.detail)) return undefined

  return typeof data.detail.code === 'string' ? data.detail.code : undefined
}
