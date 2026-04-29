import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  batchDeleteHistoryTaskRecords,
  batchCancelHistoryTasks,
  batchRetryHistoryTasks,
  listHistoryTasks,
} from '@/features/tasks/history/api'
import {
  batchCancelTasks,
  batchDeleteTaskRecords,
  batchRetryTasks,
  listTasks,
} from '@/features/tasks/api'
import type { BatchTaskActionResponse, TaskListResponse } from '@/shared/types'

vi.mock('@/features/tasks/api', () => ({
  listTasks: vi.fn(),
  batchCancelTasks: vi.fn(),
  batchDeleteTaskRecords: vi.fn(),
  batchRetryTasks: vi.fn(),
}))

const listTasksMock = vi.mocked(listTasks)
const batchCancelTasksMock = vi.mocked(batchCancelTasks)
const batchDeleteTaskRecordsMock = vi.mocked(batchDeleteTaskRecords)
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

  it('forwards batch cancel, retry, and delete records to tasks api', async () => {
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
    const deleteResult: BatchTaskActionResponse = {
      action: 'delete_record',
      summary: { requested: 1, succeeded: 1, failed: 0 },
      results: [],
    }
    batchCancelTasksMock.mockResolvedValue(cancelResult)
    batchRetryTasksMock.mockResolvedValue(retryResult)
    batchDeleteTaskRecordsMock.mockResolvedValue(deleteResult)

    const cancelResponse = await batchCancelHistoryTasks(['task-1', 'task-2'])
    const retryResponse = await batchRetryHistoryTasks(['task-3'])
    const deleteResponse = await batchDeleteHistoryTaskRecords(['task-4'])

    expect(batchCancelTasksMock).toHaveBeenCalledWith(['task-1', 'task-2'])
    expect(batchRetryTasksMock).toHaveBeenCalledWith(['task-3'])
    expect(batchDeleteTaskRecordsMock).toHaveBeenCalledWith(['task-4'])
    expect(cancelResponse).toBe(cancelResult)
    expect(retryResponse).toBe(retryResult)
    expect(deleteResponse).toBe(deleteResult)
  })
})
