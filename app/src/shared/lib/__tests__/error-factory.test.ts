import { describe, expect, it } from 'vitest'

import {
  createApiError,
  createNetworkError,
  createValidationError,
  isAppError,
} from '../error-factory'

describe('error factory helpers', () => {
  it('creates non-retriable validation errors', () => {
    expect(createValidationError('VALIDATION', 'error.validation', { field: 'name' })).toEqual({
      code: 'VALIDATION',
      i18nKey: 'error.validation',
      params: { field: 'name' },
      retriable: false,
    })
  })

  it('creates retriable network errors', () => {
    expect(createNetworkError('NETWORK_OFFLINE', 'error.network.offline')).toEqual({
      code: 'NETWORK_OFFLINE',
      i18nKey: 'error.network.offline',
      retriable: true,
    })
  })

  it('marks only transient client statuses as retriable', () => {
    expect(createApiError(400, 'bad request').retriable).toBe(false)
    expect(createApiError(408, 'timeout').retriable).toBe(true)
    expect(createApiError(429, 'too many').retriable).toBe(true)
  })

  it('marks server errors as retriable', () => {
    expect(createApiError(503, 'server down')).toEqual({
      code: 'API_SERVER_503',
      i18nKey: 'error.api.serverError',
      params: { status: 503, detail: 'server down' },
      retriable: true,
    })
  })

  it('preserves structured backend error codes', () => {
    expect(createApiError(422, 'invalid runtime', 'runtime_config_invalid')).toMatchObject({
      code: 'runtime_config_invalid',
      params: { status: 422, detail: 'invalid runtime' },
      retriable: false,
    })
  })

  it('checks the full AppError contract', () => {
    expect(
      isAppError({
        code: 'NETWORK_TIMEOUT',
        i18nKey: 'error.network.timeout',
        retriable: true,
      }),
    ).toBe(true)

    expect(isAppError({ code: 'ERR_BAD_REQUEST' })).toBe(false)
    expect(isAppError(null)).toBe(false)
  })
})
