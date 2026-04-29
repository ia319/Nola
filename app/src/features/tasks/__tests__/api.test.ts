import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { CreateTaskPayload } from '@/shared/types'
import {
  batchCancelTasks,
  batchDeleteTaskRecords,
  batchRetryTasks,
  cancelTask,
  createTask,
  deleteTaskRecord,
  getTask,
  listTasks,
} from '../api'

const apiClientMocks = vi.hoisted(() => ({
  post: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
}))

vi.mock('@/shared/lib/api-client', () => ({
  default: {
    post: apiClientMocks.post,
    get: apiClientMocks.get,
    delete: apiClientMocks.delete,
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('tasks api', () => {
  it('creates task and strips undefined fields from payload', async () => {
    apiClientMocks.post.mockResolvedValue({
      data: {
        task_id: 'task-1',
      },
    })

    const payload = {
      file_id: 'file-1',
    } as CreateTaskPayload & Record<string, unknown>
    payload.language = undefined

    const response = await createTask(payload)

    expect(apiClientMocks.post).toHaveBeenCalledWith('/api/transcription-tasks/', {
      file_id: 'file-1',
    })
    expect(response).toEqual({
      task_id: 'task-1',
    })
  })

  it('rejects empty file_id before request', async () => {
    await expect(createTask({ file_id: '' })).rejects.toThrow(
      'createTask requires a non-empty file_id',
    )
    expect(apiClientMocks.post).not.toHaveBeenCalled()
  })

  it('uses list/detail/cancel/delete endpoints', async () => {
    const signal = new AbortController().signal
    apiClientMocks.get.mockResolvedValueOnce({ data: { items: [], total: 0 } })
    apiClientMocks.get.mockResolvedValueOnce({ data: { task_id: 'task-1' } })
    apiClientMocks.delete.mockResolvedValueOnce({ data: { task_id: 'task-1' } })
    apiClientMocks.delete.mockResolvedValueOnce({ data: { task_id: 'task-1' } })

    await listTasks(
      {
        status: 'processing',
        q: 'task-1',
        sort_by: 'duration',
        order: 'asc',
        limit: 20,
        offset: 0,
      },
      signal,
    )
    await getTask('task-1', signal)
    await cancelTask('task-1')
    await deleteTaskRecord('task-1')

    expect(apiClientMocks.get).toHaveBeenNthCalledWith(1, '/api/transcription-tasks/', {
      params: {
        status: 'processing',
        q: 'task-1',
        sort_by: 'duration',
        order: 'asc',
        limit: 20,
        offset: 0,
      },
      signal,
    })
    expect(apiClientMocks.get).toHaveBeenNthCalledWith(2, '/api/transcription-tasks/task-1', {
      signal,
    })
    expect(apiClientMocks.delete).toHaveBeenNthCalledWith(1, '/api/transcription-tasks/task-1')
    expect(apiClientMocks.delete).toHaveBeenNthCalledWith(
      2,
      '/api/transcription-tasks/task-1/record',
    )
  })

  it('calls batch action endpoints with task_ids body', async () => {
    apiClientMocks.post.mockResolvedValue({ data: { results: [] } })

    await batchCancelTasks(['task-1', 'task-2'])
    await batchRetryTasks(['task-3'])
    await batchDeleteTaskRecords(['task-4', 'task-5'])

    expect(apiClientMocks.post).toHaveBeenNthCalledWith(
      1,
      '/api/transcription-tasks/batch/cancel',
      {
        task_ids: ['task-1', 'task-2'],
      },
    )
    expect(apiClientMocks.post).toHaveBeenNthCalledWith(2, '/api/transcription-tasks/batch/retry', {
      task_ids: ['task-3'],
    })
    expect(apiClientMocks.post).toHaveBeenNthCalledWith(
      3,
      '/api/transcription-tasks/batch/delete-records',
      {
        task_ids: ['task-4', 'task-5'],
      },
    )
  })
})
