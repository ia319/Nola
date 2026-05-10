import type { ApiError } from '@/shared/types'

/** Normalize FastAPI error payloads to a single readable message string. */
export function formatApiError(data: ApiError): string {
  if (typeof data.detail === 'string') return data.detail
  if (Array.isArray(data.detail)) return data.detail.map((item) => item.msg).join('; ')
  if (typeof data.detail.message === 'string') return data.detail.message

  return 'Unexpected API error'
}

/** Return a stable backend error code when the API includes one. */
export function getApiErrorCode(data: ApiError): string | undefined {
  if (typeof data.detail !== 'object' || Array.isArray(data.detail)) return undefined

  return data.detail.code
}
