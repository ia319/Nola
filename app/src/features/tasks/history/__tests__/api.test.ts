import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  batchCancelHistoryTasks,
  batchRetryHistoryTasks,
  listHistoryTasks,
} from '@/features/tasks/history/api'
import { batchCancelTasks, batchRetryTasks, listTasks } from '@/features/tasks/api'
import type { BatchTaskActionResponse, TaskListResponse } from '@/shared/types'

vi.mock('@/features/tasks/api', () => ({
  listTasks: vi.fn(),
  batchCancelTasks: vi.fn(),
  batchRetryTasks: vi.fn(),
}))

const listTasksMock = vi.mocked(listTasks)
const batchCancelTasksMock = vi.mocked(batchCancelTasks)
const batchRetryTasksMock = vi.mocked(batchRetryTasks)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('history api wrappers', () => {
  it('forwards list params and signal to tasks list api', async () => {
    const signal = new AbortController().signal
    const result: TaskListResponse = { tasks: [], total: 0, limit: 10, offset: 5 }
    listTasksMock.mockResolvedValue(result)

    const response = await listHistoryTasks({ status: 'completed', limit: 10, offset: 5 }, signal)

    expect(listTasksMock).toHaveBeenCalledWith(
      { status: 'completed', limit: 10, offset: 5 },
      signal,
    )
    expect(response).toBe(result)
  })

  it('forwards batch cancel and batch retry to tasks api', async () => {
    const cancelResult: BatchTaskActionResponse = {
      action: 'cancel',
      summary: { requested: 2, succeeded: 2, failed: 0 },
      results: [],
    }
    const retryResult: BatchTaskActionResponse = {
      action: 'retry',
      summary: { requested: 1, succeeded: 1, failed: 0 },
      results: [],
    }
    batchCancelTasksMock.mockResolvedValue(cancelResult)
    batchRetryTasksMock.mockResolvedValue(retryResult)

    const cancelResponse = await batchCancelHistoryTasks(['task-1', 'task-2'])
    const retryResponse = await batchRetryHistoryTasks(['task-3'])

    expect(batchCancelTasksMock).toHaveBeenCalledWith(['task-1', 'task-2'])
    expect(batchRetryTasksMock).toHaveBeenCalledWith(['task-3'])
    expect(cancelResponse).toBe(cancelResult)
    expect(retryResponse).toBe(retryResult)
  })
})
