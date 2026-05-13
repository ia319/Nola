// @vitest-environment jsdom
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { listLiveSessions } from '@/features/realtime/api'
import { useHistoryLiveSessions } from '../useHistoryLiveSessions'

vi.mock('@/features/realtime/api', () => ({
  listLiveSessions: vi.fn(),
}))

const listLiveSessionsMock = vi.mocked(listLiveSessions)

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('useHistoryLiveSessions', () => {
  it('builds live list query params from history query state', async () => {
    listLiveSessionsMock.mockResolvedValue({
      limit: 50,
      offset: 50,
      sessions: [],
      total: 0,
    })

    renderHook(
      () =>
        useHistoryLiveSessions({
          query: {
            order: 'asc',
            page: 2,
            page_size: 50,
            q: ' session ',
            sort_by: 'title',
            status: 'finished',
          },
        }),
      {
        wrapper: createWrapper(),
      },
    )

    await waitFor(() => {
      expect(listLiveSessionsMock).toHaveBeenCalledWith(
        {
          limit: 50,
          offset: 50,
          order: 'asc',
          q: 'session',
          sort_by: 'title',
          status: 'finished',
        },
        expect.any(AbortSignal),
      )
    })
  })
})
