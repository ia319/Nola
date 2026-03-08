import type { AppError } from '@/shared/types'

/** Build validation errors in one place to keep retry semantics consistent. */
export function createValidationError(
  code: string,
  i18nKey: string,
  params?: Record<string, unknown>,
): AppError {
  return { code, i18nKey, params, retriable: false }
}

/** Network failures are usually transient, so callers may offer retry. */
export function createNetworkError(code: string, i18nKey: string): AppError {
  return { code, i18nKey, retriable: true }
}

/** Map HTTP status into stable frontend categories for presentation logic. */
export function createApiError(status: number, detail: string): AppError {
  if (status >= 500) {
    return {
      code: `API_SERVER_${status}`,
      i18nKey: 'error.api.serverError',
      params: { status, detail },
      retriable: true,
    }
  }

  // Rate-limited or request timeout responses are transient; allow retry.
  const retriable = status === 408 || status === 429

  return {
    code: `API_CLIENT_${status}`,
    i18nKey: 'error.api.clientError',
    params: { status, detail },
    retriable,
  }
}

/** Check whether an unknown value conforms to the AppError shape. */
export function isAppError(err: unknown): err is AppError {
  return (
    typeof err === 'object' &&
    err !== null &&
    typeof (err as AppError).code === 'string' &&
    typeof (err as AppError).i18nKey === 'string' &&
    typeof (err as AppError).retriable === 'boolean'
  )
}
