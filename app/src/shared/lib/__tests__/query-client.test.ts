import type { DefaultOptions } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'

import { createAppQueryClient } from '@/shared/lib/query-client'
import type { AppError } from '@/shared/types'

function getQueryRetryHandler(defaultOptions: DefaultOptions) {
  const retry = defaultOptions.queries?.retry
  if (typeof retry !== 'function') {
    throw new Error('query retry handler is not configured')
  }
  return retry as (failureCount: number, error: unknown) => boolean
}

describe('createAppQueryClient', () => {
  it('retries retriable app errors up to two attempts', () => {
    const queryClient = createAppQueryClient()
    const retry = getQueryRetryHandler(queryClient.getDefaultOptions())
    const error: AppError = {
      code: 'NETWORK_OFFLINE',
      i18nKey: 'error.network.offline',
      retriable: true,
    }

    expect(retry(0, error)).toBe(true)
    expect(retry(1, error)).toBe(true)
    expect(retry(2, error)).toBe(false)
  })

  it('does not retry non-retriable app errors', () => {
    const queryClient = createAppQueryClient()
    const retry = getQueryRetryHandler(queryClient.getDefaultOptions())
    const error: AppError = {
      code: 'API_CLIENT_400',
      i18nKey: 'error.api.clientError',
      retriable: false,
    }

    expect(retry(0, error)).toBe(false)
  })

  it('disables mutation retries by default', () => {
    const queryClient = createAppQueryClient()

    expect(queryClient.getDefaultOptions().mutations?.retry).toBe(false)
  })
})
