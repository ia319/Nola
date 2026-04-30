// @vitest-environment jsdom

import { createElement, type PropsWithChildren } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it } from 'vitest'

import { useSessionTasksStore } from '@/features/tasks'
import { queryKeys } from '@/shared/lib/query-keys'
import type { TaskListResponse, TaskSummary } from '@/shared/types'
import { useHistoryFileAssociatedTasks } from '../useHistoryFileAssociatedTasks'

function buildTask(
  taskId: string,
  fileId: string,
  overrides: Partial<TaskSummary> = {},
): TaskSummary {
  return {
    task_id: taskId,
    file_id: fileId,
    filename: `${taskId}.wav`,
    status: 'completed',
    progress: 100,
    created_at: '2026-04-13T09:00:00.000Z',
    completed_at: '2026-04-13T09:05:00.000Z',
    ...overrides,
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
  useSessionTasksStore.getState().clearSession()
})

describe('useHistoryFileAssociatedTasks', () => {
  it('collects file tasks from cached task lists and session tasks by file_id', async () => {
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
          buildTask('task-a', 'file-1', { created_at: '2026-04-13T09:00:00.000Z' }),
          buildTask('task-b', 'file-1', { created_at: '2026-04-13T10:00:00.000Z' }),
          buildTask('task-c', 'file-2'),
        ]),
      )
    })

    const { result } = renderHook(() => useHistoryFileAssociatedTasks('file-1'), {
      wrapper: createWrapper(queryClient),
    })

    await waitFor(() => {
      expect(result.current.map((task) => task.task_id)).toEqual(['task-b', 'task-a'])
    })

    act(() => {
      useSessionTasksStore.getState().addCreatedTask({
        task_id: 'task-session',
        file_id: 'file-1',
        filename: 'session.wav',
        status: 'pending',
        progress: 15,
        created_at: '2026-04-13T11:00:00.000Z',
      })
    })

    await waitFor(() => {
      expect(result.current.map((task) => task.task_id)).toEqual([
        'task-session',
        'task-b',
        'task-a',
      ])
    })
  })
})
