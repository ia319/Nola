// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { listTasks } from '@/features/tasks/api'
import { requestTaskRefresh } from '@/features/tasks/lib/task-refresh'
import { useSessionTasksStore } from '@/features/tasks/store/session-tasks-store'
import { useTaskBoardStore } from '@/features/tasks/store/task-board-store'
import type { TaskListResponse, TaskSummary } from '@/shared/types'

import { useTaskPolling } from '../useTaskPolling'

vi.mock('@/features/tasks/api', () => ({
  listTasks: vi.fn(),
}))

const listTasksMock = vi.mocked(listTasks)

function buildTask(
  taskId: string,
  status: TaskSummary['status'],
  overrides: Partial<TaskSummary> = {},
): TaskSummary {
  return {
    task_id: taskId,
    file_id: `file-${taskId}`,
    status,
    progress: status === 'completed' ? 100 : 0,
    created_at: '2026-03-18T09:00:00.000Z',
    completed_at: status === 'completed' ? '2026-03-18T09:10:00.000Z' : null,
    ...overrides,
  }
}

function buildTaskList(tasks: TaskSummary[]): TaskListResponse {
  return {
    tasks,
    total: tasks.length,
    limit: tasks.length,
    offset: 0,
  }
}

function seedActiveSessionTask(taskId: string): void {
  useSessionTasksStore.getState().addCreatedTask({
    task_id: taskId,
    file_id: `file-${taskId}`,
    status: 'pending',
  })
}

function createDeferred<T>(): {
  promise: Promise<T>
  resolve: (value: T | PromiseLike<T>) => void
} {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

async function flushAsyncWork(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

afterEach(() => {
  useSessionTasksStore.getState().clearSession()
  useTaskBoardStore.getState().clearTaskBoard()
  vi.useRealTimers()
  vi.clearAllMocks()
  Reflect.deleteProperty(document, 'hidden')
})

describe('useTaskPolling', () => {
  it('runs immediate sync when active tasks exist and writes board state', async () => {
    seedActiveSessionTask('task-1')
    listTasksMock.mockResolvedValue(buildTaskList([buildTask('task-1', 'processing')]))

    renderHook(() => useTaskPolling())
    await flushAsyncWork()

    expect(listTasksMock).toHaveBeenCalledTimes(1)
    expect(useTaskBoardStore.getState().tasks.map((task) => task.task_id)).toEqual(['task-1'])
    expect(useTaskBoardStore.getState().isPolling).toBe(true)
  })

  it('keeps single-flight polling while one request is still in progress', async () => {
    vi.useFakeTimers()
    seedActiveSessionTask('task-1')

    const firstPoll = createDeferred<TaskListResponse>()

    listTasksMock
      .mockImplementationOnce(() => firstPoll.promise)
      .mockResolvedValue(buildTaskList([buildTask('task-1', 'processing')]))

    renderHook(() => useTaskPolling())
    await flushAsyncWork()

    expect(listTasksMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
    })
    expect(listTasksMock).toHaveBeenCalledTimes(1)

    firstPoll.resolve(buildTaskList([buildTask('task-1', 'processing')]))
    await flushAsyncWork()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000)
    })
    expect(listTasksMock).toHaveBeenCalledTimes(2)
  })

  it('stops polling when active tasks become terminal', async () => {
    vi.useFakeTimers()
    seedActiveSessionTask('task-1')
    listTasksMock.mockResolvedValue(buildTaskList([buildTask('task-1', 'completed')]))

    renderHook(() => useTaskPolling())
    await flushAsyncWork()

    expect(listTasksMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000)
    })

    expect(listTasksMock).toHaveBeenCalledTimes(1)
    expect(useTaskBoardStore.getState().isPolling).toBe(false)
    expect(useSessionTasksStore.getState().byId['task-1']?.status).toBe('completed')
  })

  it('applies 2s->4s->8s backoff and resets after one successful poll', async () => {
    vi.useFakeTimers()
    seedActiveSessionTask('task-1')
    listTasksMock
      .mockRejectedValueOnce(new Error('1'))
      .mockRejectedValueOnce(new Error('2'))
      .mockRejectedValueOnce(new Error('3'))
      .mockResolvedValue(buildTaskList([buildTask('task-1', 'processing')]))

    renderHook(() => useTaskPolling())
    await flushAsyncWork()

    expect(listTasksMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_999)
    })
    expect(listTasksMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(listTasksMock).toHaveBeenCalledTimes(2)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_999)
    })
    expect(listTasksMock).toHaveBeenCalledTimes(2)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(listTasksMock).toHaveBeenCalledTimes(3)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(7_999)
    })
    expect(listTasksMock).toHaveBeenCalledTimes(3)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(listTasksMock).toHaveBeenCalledTimes(4)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_999)
    })
    expect(listTasksMock).toHaveBeenCalledTimes(4)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(listTasksMock).toHaveBeenCalledTimes(5)
  })

  it('uses 6s interval when document is hidden', async () => {
    vi.useFakeTimers()
    seedActiveSessionTask('task-1')
    let hidden = true
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => hidden,
    })

    listTasksMock.mockResolvedValue(buildTaskList([buildTask('task-1', 'processing')]))

    renderHook(() => useTaskPolling())
    await flushAsyncWork()

    expect(listTasksMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_999)
    })
    expect(listTasksMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(listTasksMock).toHaveBeenCalledTimes(2)

    hidden = false
    document.dispatchEvent(new Event('visibilitychange'))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_999)
    })
    expect(listTasksMock).toHaveBeenCalledTimes(2)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(listTasksMock).toHaveBeenCalledTimes(3)
  })

  it('supports manual refresh for action-triggered immediate sync', async () => {
    listTasksMock.mockResolvedValue(buildTaskList([]))

    const { result } = renderHook(() => useTaskPolling())
    expect(listTasksMock).not.toHaveBeenCalled()

    await act(async () => {
      await result.current.refreshNow()
    })

    expect(listTasksMock).toHaveBeenCalledTimes(1)
  })

  it('supports external refresh events for action-triggered immediate sync', async () => {
    listTasksMock.mockResolvedValue(buildTaskList([]))

    renderHook(() => useTaskPolling())
    expect(listTasksMock).not.toHaveBeenCalled()

    act(() => {
      requestTaskRefresh()
    })
    await flushAsyncWork()

    expect(listTasksMock).toHaveBeenCalledTimes(1)
  })
})
