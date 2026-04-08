import { QueryClient } from '@tanstack/react-query'

import { isAppError } from '@/shared/lib/error-factory'

function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) {
    return false
  }

  if (isAppError(error)) {
    return error.retriable
  }

  return true
}

export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: shouldRetryQuery,
      },
      mutations: {
        retry: false,
      },
    },
  })
}

export const queryClient = createAppQueryClient()
