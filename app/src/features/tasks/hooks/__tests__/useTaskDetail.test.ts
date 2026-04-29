// @vitest-environment jsdom
import { createElement, type PropsWithChildren } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { getTask } from '@/features/tasks/api'
import { useTaskDetail } from '../useTaskDetail'

vi.mock('@/features/tasks/api', () => ({
  getTask: vi.fn(),
}))

const getTaskMock = vi.mocked(getTask)

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('useTaskDetail', () => {
  it('keeps refresh as a no-op when no task is selected', async () => {
    const queryClient = createQueryClient()
    const { result } = renderHook(() => useTaskDetail(null), {
      wrapper: createWrapper(queryClient),
    })

    await act(async () => {
      await result.current.refresh()
    })

    expect(getTaskMock).not.toHaveBeenCalled()
  })
})
