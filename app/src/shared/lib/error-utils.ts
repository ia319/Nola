import type { ApiError } from '@/shared/types'

/** Normalize FastAPI error payloads to a single readable message string. */
export function formatApiError(data: ApiError): string {
  if (typeof data.detail === 'string') return data.detail
  return data.detail.map((item) => item.msg).join('; ')
}
