import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { CreateTaskPayload } from '@/shared/types'

import { cancelTaskAndRefresh, retryTaskAndRefresh } from '../actions'
import { cancelTask, createTask } from '../api'
import { requestTaskRefresh } from '../lib/task-refresh'

vi.mock('../api', () => ({
  cancelTask: vi.fn(),
  createTask: vi.fn(),
}))

vi.mock('../lib/task-refresh', () => ({
  requestTaskRefresh: vi.fn(),
}))

const cancelTaskMock = vi.mocked(cancelTask)
const createTaskMock = vi.mocked(createTask)
const requestTaskRefreshMock = vi.mocked(requestTaskRefresh)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('task actions', () => {
  it('requests immediate sync after cancel succeeds', async () => {
    cancelTaskMock.mockResolvedValue({
      task_id: 'task-1',
      status: 'cancelled',
      message: 'Task cancelled successfully',
      task: {
        task_id: 'task-1',
        file_id: 'file-1',
        filename: 'demo.wav',
        status: 'cancelled',
        progress: 100,
        created_at: '2026-03-20T10:00:00.000Z',
        completed_at: '2026-03-20T10:01:00.000Z',
      },
    })

    const response = await cancelTaskAndRefresh('task-1')

    expect(cancelTaskMock).toHaveBeenCalledWith('task-1')
    expect(requestTaskRefreshMock).toHaveBeenCalledTimes(1)
    expect(response.task_id).toBe('task-1')
  })

  it('requests sync even when cancel fails', async () => {
    cancelTaskMock.mockRejectedValue(new Error('cancel failed'))

    await expect(cancelTaskAndRefresh('task-1')).rejects.toThrow('cancel failed')
    expect(requestTaskRefreshMock).toHaveBeenCalledTimes(1)
  })

  it('requests immediate sync after retry succeeds', async () => {
    const payload: CreateTaskPayload = { file_id: 'file-1' }
    createTaskMock.mockResolvedValue({
      task_id: 'task-2',
      file_id: 'file-1',
      filename: 'demo.wav',
      status: 'pending',
      options: null,
    })

    const response = await retryTaskAndRefresh(payload)

    expect(createTaskMock).toHaveBeenCalledWith(payload)
    expect(requestTaskRefreshMock).toHaveBeenCalledTimes(1)
    expect(response.task_id).toBe('task-2')
  })

  it('does not request sync when retry fails', async () => {
    const payload: CreateTaskPayload = { file_id: 'file-1' }
    createTaskMock.mockRejectedValue(new Error('retry failed'))

    await expect(retryTaskAndRefresh(payload)).rejects.toThrow('retry failed')
    expect(requestTaskRefreshMock).not.toHaveBeenCalled()
  })
})
