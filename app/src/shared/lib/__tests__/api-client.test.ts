import axios, { type AxiosError } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import apiClient from '@/shared/lib/api-client'
import type { ApiError, AppError } from '@/shared/types'

vi.mock('@/config/logger', () => ({
  default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

interface ResponseInterceptorManager {
  handlers: Array<{ rejected?: (error: AxiosError<ApiError>) => Promise<never> }>
}

/**
 * Read the installed interceptor directly so the test exercises the real
 * rejection mapping without mocking Axios internals.
 */
function getRejectedInterceptor(): (error: AxiosError<ApiError>) => Promise<never> {
  const manager = apiClient.interceptors.response as unknown as ResponseInterceptorManager
  const rejected = manager.handlers.at(-1)?.rejected
  if (!rejected) {
    throw new Error('response interceptor is not registered')
  }
  return rejected
}

describe('apiClient response interceptor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('preserves canceled errors for caller-specific handling', async () => {
    const rejected = getRejectedInterceptor()
    const canceled = new axios.CanceledError('aborted')

    await expect(rejected(canceled as AxiosError<ApiError>)).rejects.toBe(canceled)
  })

  it('maps transient client errors with retry semantics', async () => {
    const rejected = getRejectedInterceptor()
    const error = {
      message: 'Too Many Requests',
      response: {
        status: 429,
        data: { detail: 'Too many requests' },
      },
    } as AxiosError<ApiError>
    const expected: AppError = {
      code: 'API_CLIENT_429',
      i18nKey: 'error.api.clientError',
      params: { status: 429, detail: 'Too many requests' },
      retriable: true,
    }

    await expect(rejected(error)).rejects.toEqual(expected)
  })

  it('maps timeout errors to the network timeout category', async () => {
    const rejected = getRejectedInterceptor()
    const error = {
      code: 'ECONNABORTED',
      message: 'timeout of 30000ms exceeded',
    } as AxiosError<ApiError>
    const expected: AppError = {
      code: 'NETWORK_TIMEOUT',
      i18nKey: 'error.network.timeout',
      retriable: true,
    }

    await expect(rejected(error)).rejects.toEqual(expected)
  })

  it('maps non-timeout network failures to the offline category', async () => {
    const rejected = getRejectedInterceptor()
    const error = {
      code: 'ERR_NETWORK',
      message: 'network error',
    } as AxiosError<ApiError>
    const expected: AppError = {
      code: 'NETWORK_OFFLINE',
      i18nKey: 'error.network.offline',
      retriable: true,
    }

    await expect(rejected(error)).rejects.toEqual(expected)
  })

  it('maps server errors as retriable AppError values', async () => {
    const rejected = getRejectedInterceptor()
    const error = {
      message: 'Server Error',
      response: {
        status: 503,
        data: { detail: 'backend unavailable' },
      },
    } as AxiosError<ApiError>
    const expected: AppError = {
      code: 'API_SERVER_503',
      i18nKey: 'error.api.serverError',
      params: { status: 503, detail: 'backend unavailable' },
      retriable: true,
    }

    await expect(rejected(error)).rejects.toEqual(expected)
  })

  it('falls back to the Axios message when the response payload shape is invalid', async () => {
    const rejected = getRejectedInterceptor()
    const error = {
      message: 'Bad Request',
      response: {
        status: 400,
        data: {} as ApiError,
      },
    } as AxiosError<ApiError>
    const expected: AppError = {
      code: 'API_CLIENT_400',
      i18nKey: 'error.api.clientError',
      params: { status: 400, detail: 'Bad Request' },
      retriable: false,
    }

    await expect(rejected(error)).rejects.toEqual(expected)
  })
})
