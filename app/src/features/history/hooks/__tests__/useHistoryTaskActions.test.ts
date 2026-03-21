// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { batchCancelHistoryTasks, batchRetryHistoryTasks } from '@/features/history/api'
import { useHistoryTaskActions } from '@/features/history/hooks/useHistoryTaskActions'
import { toast } from 'sonner'

vi.mock('@/features/history/api', () => ({
  batchCancelHistoryTasks: vi.fn(),
  batchRetryHistoryTasks: vi.fn(),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  },
}))

const batchCancelMock = vi.mocked(batchCancelHistoryTasks)
const batchRetryMock = vi.mocked(batchRetryHistoryTasks)

afterEach(() => {
  vi.clearAllMocks()
})

describe('useHistoryTaskActions', () => {
  it('runs batch cancel with summary toast and refresh', async () => {
    batchCancelMock.mockResolvedValue({
      action: 'cancel',
      summary: { requested: 1, succeeded: 1, failed: 0 },
      results: [
        {
          task_id: 'task-1',
          ok: true,
          message: 'Task cancelled successfully',
          status: 'cancelled',
          file_id: 'file-1',
          filename: 'alpha.mp3',
        },
      ],
    })

    const refresh = vi.fn().mockResolvedValue(undefined)
    const onCancelledTask = vi.fn()
    const onActionSettled = vi.fn()

    const { result } = renderHook(() =>
      useHistoryTaskActions({
        refresh,
        onCancelledTask,
        onActionSettled,
      }),
    )

    await act(async () => {
      await result.current.cancelTasks(['task-1', 'task-1'])
    })

    expect(batchCancelMock).toHaveBeenCalledTimes(1)
    expect(batchCancelMock).toHaveBeenCalledWith(['task-1'])
    expect(onCancelledTask).toHaveBeenCalledWith({
      taskId: 'task-1',
      fileId: 'file-1',
      filename: 'alpha.mp3',
      status: 'cancelled',
    })
    expect(toast.success).toHaveBeenCalledWith('tasks.toast.batch.cancel.success')
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(onActionSettled).toHaveBeenCalledTimes(1)
  })

  it('runs batch retry and handles partial outcome', async () => {
    batchRetryMock.mockResolvedValue({
      action: 'retry',
      summary: { requested: 2, succeeded: 1, failed: 1 },
      results: [
        {
          task_id: 'task-a',
          ok: true,
          message: 'Retry task created successfully',
          status: 'failed',
          new_task_id: 'new-task-a',
          file_id: 'file-a',
          filename: 'a.mp3',
        },
        {
          task_id: 'task-b',
          ok: false,
          message: 'Cannot retry task with status: pending',
          error_code: 'invalid_status',
          status: 'pending',
          file_id: 'file-b',
          filename: 'b.mp3',
        },
      ],
    })

    const refresh = vi.fn().mockResolvedValue(undefined)
    const onRetryCreatedTask = vi.fn()

    const { result } = renderHook(() =>
      useHistoryTaskActions({
        refresh,
        onRetryCreatedTask,
      }),
    )

    await act(async () => {
      await result.current.retryTasks(['task-a', 'task-b'])
    })

    expect(batchRetryMock).toHaveBeenCalledWith(['task-a', 'task-b'])
    expect(onRetryCreatedTask).toHaveBeenCalledWith({
      taskId: 'new-task-a',
      fileId: 'file-a',
      filename: 'a.mp3',
    })
    expect(toast.warning).toHaveBeenCalledWith('tasks.toast.batch.retry.partial')
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('shows error toast and still refreshes when action request fails', async () => {
    batchRetryMock.mockRejectedValue(new Error('network'))

    const refresh = vi.fn().mockResolvedValue(undefined)
    const onActionSettled = vi.fn()

    const { result } = renderHook(() =>
      useHistoryTaskActions({
        refresh,
        onActionSettled,
      }),
    )

    await act(async () => {
      await expect(result.current.retryTasks(['task-1'])).rejects.toThrow('network')
    })

    expect(toast.error).toHaveBeenCalledWith('tasks.toast.actionFailed')
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(onActionSettled).toHaveBeenCalledTimes(1)
  })
})
