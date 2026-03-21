// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { listHistoryTasks } from '@/features/history/api'
import type { TaskListResponse, TaskSummary } from '@/shared/types'

import { useHistoryTasks } from '../useHistoryTasks'

vi.mock('@/features/history/api', () => ({
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

describe('useHistoryTasks', () => {
  it('maps local query state to backend list params', async () => {
    listTasksMock.mockResolvedValue(buildResponse([buildTask('task-1', 'pending')], 25))

    const { result } = renderHook(() => useHistoryTasks(20))

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
      result.current.setSearch('alpha')
      result.current.setStatus('failed')
      result.current.setPage(2)
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

  it('clamps out-of-range pages in one refresh cycle without extra refetch', async () => {
    listTasksMock
      .mockResolvedValueOnce(buildResponse([buildTask('task-1', 'pending')], 60))
      .mockResolvedValueOnce(buildResponse([], 25))
      .mockResolvedValueOnce(buildResponse([buildTask('task-2', 'failed')], 25))

    const { result } = renderHook(() => useHistoryTasks(20))

    await waitFor(() => {
      expect(listTasksMock).toHaveBeenCalledTimes(1)
    })

    await act(async () => {
      result.current.setPage(3)
    })

    await waitFor(() => {
      expect(listTasksMock).toHaveBeenCalledTimes(3)
    })

    expect(listTasksMock).toHaveBeenNthCalledWith(
      2,
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
      3,
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
    expect(result.current.query.page).toBe(2)
    expect(result.current.tasks.map((task) => task.task_id)).toEqual(['task-2'])
    expect(result.current.isLoading).toBe(false)

    await act(async () => {
      await Promise.resolve()
    })
    expect(listTasksMock).toHaveBeenCalledTimes(3)
  })

  it('exposes AppError shape when list request fails', async () => {
    listTasksMock.mockRejectedValue(new Error('boom'))

    const { result } = renderHook(() => useHistoryTasks(20))

    await waitFor(() => {
      expect(result.current.error).not.toBeNull()
    })

    expect(result.current.error?.code).toBe('API_SERVER_UNKNOWN')
    expect(result.current.tasks).toEqual([])
    expect(result.current.total).toBe(0)
  })
})
