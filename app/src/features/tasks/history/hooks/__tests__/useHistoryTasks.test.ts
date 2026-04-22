// @vitest-environment jsdom
import { createElement, type PropsWithChildren } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { listHistoryTasks } from '@/features/tasks/history/api'
import type { TaskListResponse, TaskQueryModel, TaskSummary } from '@/shared/types'

import { useHistoryTasks } from '../useHistoryTasks'

vi.mock('@/features/tasks/history/api', () => ({
  listHistoryTasks: vi.fn(),
}))

const listTasksMock = vi.mocked(listHistoryTasks)

function buildTask(taskId: string, status: TaskSummary['status']): TaskSummary {
  return {
    task_id: taskId,
    file_id: `file-${taskId}`,
    filename: `audio-${taskId}.mp3`,
    status,
    progress: status === 'completed' ? 100 : 10,
    created_at: '2026-03-20T10:00:00.000Z',
    completed_at: status === 'completed' ? '2026-03-20T10:10:00.000Z' : null,
  }
}

function buildResponse(tasks: TaskSummary[], total: number = tasks.length): TaskListResponse {
  return {
    tasks,
    total,
    limit: 20,
    offset: 0,
  }
}

afterEach(() => {
  vi.clearAllMocks()
})

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  })

  return function Wrapper({ children }: PropsWithChildren) {
    return createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

describe('useHistoryTasks', () => {
  it('maps route query state to backend list params', async () => {
    listTasksMock.mockResolvedValue(buildResponse([buildTask('task-1', 'pending')], 25))

    const defaultQuery: TaskQueryModel = {
      q: '',
      status: 'all',
      sort_by: 'created_at',
      order: 'desc',
      page: 1,
      page_size: 20,
    }
    const nextQuery: TaskQueryModel = {
      q: 'alpha',
      status: 'failed',
      sort_by: 'created_at',
      order: 'desc',
      page: 2,
      page_size: 20,
    }

    const { rerender } = renderHook(
      ({ query }) =>
        useHistoryTasks({
          query,
        }),
      {
        initialProps: { query: defaultQuery },
        wrapper: createWrapper(),
      },
    )

    await waitFor(() => {
      expect(listTasksMock).toHaveBeenCalledTimes(1)
    })
    expect(listTasksMock).toHaveBeenLastCalledWith(
      {
        q: undefined,
        status: undefined,
        sort_by: 'created_at',
        order: 'desc',
        limit: 20,
        offset: 0,
      },
      expect.any(AbortSignal),
    )

    await act(async () => {
      rerender({ query: nextQuery })
    })

    await waitFor(() => {
      expect(listTasksMock).toHaveBeenCalledTimes(2)
    })
    expect(listTasksMock).toHaveBeenLastCalledWith(
      {
        q: 'alpha',
        status: 'failed',
        sort_by: 'created_at',
        order: 'desc',
        limit: 20,
        offset: 20,
      },
      expect.any(AbortSignal),
    )
  })

  it('clamps out-of-range pages and skips one follow-up refetch', async () => {
    const onPageClamp = vi.fn()
    listTasksMock
      .mockResolvedValueOnce(buildResponse([], 25))
      .mockResolvedValueOnce(buildResponse([buildTask('task-2', 'failed')], 25))

    const initialQuery: TaskQueryModel = {
      q: '',
      status: 'all',
      sort_by: 'created_at',
      order: 'desc',
      page: 3,
      page_size: 20,
    }

    const { result, rerender } = renderHook(
      ({ query }) =>
        useHistoryTasks({
          query,
          onPageClamp,
        }),
      {
        initialProps: { query: initialQuery },
        wrapper: createWrapper(),
      },
    )

    await waitFor(() => {
      expect(listTasksMock).toHaveBeenCalledTimes(1)
    })
    await waitFor(() => {
      expect(onPageClamp).toHaveBeenCalledWith(2)
    })

    await act(async () => {
      rerender({
        query: {
          ...initialQuery,
          page: 2,
        },
      })
    })

    await waitFor(() => {
      expect(result.current.tasks.map((task) => task.task_id)).toEqual(['task-2'])
    })

    expect(listTasksMock).toHaveBeenNthCalledWith(
      1,
      {
        q: undefined,
        status: undefined,
        sort_by: 'created_at',
        order: 'desc',
        limit: 20,
        offset: 40,
      },
      expect.any(AbortSignal),
    )
    expect(listTasksMock).toHaveBeenNthCalledWith(
      2,
      {
        q: undefined,
        status: undefined,
        sort_by: 'created_at',
        order: 'desc',
        limit: 20,
        offset: 20,
      },
      expect.any(AbortSignal),
    )
    expect(result.current.isLoading).toBe(false)
    expect(listTasksMock).toHaveBeenCalledTimes(2)
  })

  it('exposes AppError shape when list request fails', async () => {
    listTasksMock.mockRejectedValue(new Error('boom'))

    const { result } = renderHook(
      () =>
        useHistoryTasks({
          query: {
            q: '',
            status: 'all',
            sort_by: 'created_at',
            order: 'desc',
            page: 1,
            page_size: 20,
          },
        }),
      {
        wrapper: createWrapper(),
      },
    )

    await waitFor(() => {
      expect(result.current.error).not.toBeNull()
    })

    expect(result.current.error?.code).toBe('API_SERVER_UNKNOWN')
    expect(result.current.tasks).toEqual([])
    expect(result.current.total).toBe(0)
  })
})
