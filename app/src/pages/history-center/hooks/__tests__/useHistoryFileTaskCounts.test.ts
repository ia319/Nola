// @vitest-environment jsdom

import { createElement, type PropsWithChildren } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useSessionTasksStore } from '@/features/tasks'
import { queryKeys } from '@/shared/lib/query-keys'
import type { TaskListResponse, TaskSummary } from '@/shared/types'
import { useHistoryFileTaskCounts } from '../useHistoryFileTaskCounts'

function buildTask(taskId: string, fileId: string): TaskSummary {
  return {
    task_id: taskId,
    file_id: fileId,
    filename: `${taskId}.wav`,
    status: 'completed',
    progress: 100,
    created_at: '2026-04-12T09:00:00.000Z',
    completed_at: '2026-04-12T09:05:00.000Z',
  }
}

function buildResponse(tasks: TaskSummary[]): TaskListResponse {
  return {
    tasks,
    total: tasks.length,
    limit: 20,
    offset: 0,
  }
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  useSessionTasksStore.getState().clearSession()
})

describe('useHistoryFileTaskCounts', () => {
  it('aggregates file task counts from cached task lists and session tasks without snapshot warnings', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })

    act(() => {
      queryClient.setQueryData(
        queryKeys.tasks.list({
          limit: 20,
          offset: 0,
          sort_by: 'created_at',
          order: 'desc',
        }),
        buildResponse([
          buildTask('task-1', 'file-a'),
          buildTask('task-2', 'file-a'),
          buildTask('task-3', 'file-b'),
        ]),
      )
    })

    const { result } = renderHook(() => useHistoryFileTaskCounts(), {
      wrapper: createWrapper(queryClient),
    })

    await waitFor(() => {
      expect(result.current.get('file-a')).toBe(2)
      expect(result.current.get('file-b')).toBe(1)
    })

    act(() => {
      useSessionTasksStore.getState().addCreatedTask({
        task_id: 'session-task',
        file_id: 'file-c',
        status: 'pending',
      })
    })

    await waitFor(() => {
      expect(result.current.get('file-c')).toBe(1)
    })

    act(() => {
      queryClient.setQueryData(
        queryKeys.tasks.list({
          limit: 20,
          offset: 20,
          sort_by: 'created_at',
          order: 'desc',
        }),
        buildResponse([buildTask('task-4', 'file-c')]),
      )
    })

    await waitFor(() => {
      expect(result.current.get('file-c')).toBe(2)
    })

    const getSnapshotWarnings = consoleErrorSpy.mock.calls.filter(([message]) =>
      String(message).includes('getSnapshot should be cached'),
    )
    expect(getSnapshotWarnings).toHaveLength(0)
  })
})
