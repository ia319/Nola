// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { batchExport, downloadExport, saveExport } from '@/features/export'
import { batchCancelHistoryTasks, batchRetryHistoryTasks } from '@/features/history/api'
import { useHistoryTaskActions } from '@/features/history/hooks/useHistoryTaskActions'
import { downloadBlob } from '@/shared/lib/utils'
import { toast } from 'sonner'

vi.mock('@/features/history/api', () => ({
  batchCancelHistoryTasks: vi.fn(),
  batchRetryHistoryTasks: vi.fn(),
}))

vi.mock('@/features/export', async () => {
  const actual = await vi.importActual('@/features/export')
  return {
    ...actual,
    batchExport: vi.fn(),
    downloadExport: vi.fn(),
    saveExport: vi.fn(),
  }
})

vi.mock('@/shared/lib/utils', () => ({
  downloadBlob: vi.fn(),
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
const batchExportMock = vi.mocked(batchExport)
const downloadExportMock = vi.mocked(downloadExport)
const saveExportMock = vi.mocked(saveExport)
const downloadBlobMock = vi.mocked(downloadBlob)

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

  it('keeps action result when refresh fails and still notifies settled', async () => {
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

    const refresh = vi.fn().mockRejectedValue(new Error('refresh-failed'))
    const onActionSettled = vi.fn()

    const { result } = renderHook(() =>
      useHistoryTaskActions({
        refresh,
        onActionSettled,
      }),
    )

    await act(async () => {
      const response = await result.current.cancelTasks(['task-1'])
      expect(response.summary).toEqual({ requested: 1, succeeded: 1, failed: 0 })
    })

    expect(refresh).toHaveBeenCalledTimes(1)
    expect(onActionSettled).toHaveBeenCalledTimes(1)
    expect(toast.success).toHaveBeenCalledWith('tasks.toast.batch.cancel.success')
  })

  it('uses server filename when exporting a single task', async () => {
    const blob = new Blob(['srt-content'], { type: 'application/x-subrip' })
    downloadExportMock.mockResolvedValue({
      blob,
      filename: 'server-name.srt',
    })

    const onActionSettled = vi.fn()

    const { result } = renderHook(() =>
      useHistoryTaskActions({
        refresh: vi.fn().mockResolvedValue(undefined),
        onActionSettled,
      }),
    )

    await act(async () => {
      await result.current.exportTask(
        {
          task_id: 'task-1',
          filename: 'demo.mp3',
        },
        {
          format: 'srt',
          include_timestamps: true,
        },
      )
    })

    expect(downloadExportMock).toHaveBeenCalledWith('task-1', {
      format: 'srt',
      include_timestamps: true,
    })
    expect(downloadBlobMock).toHaveBeenCalledTimes(1)
    expect(downloadBlobMock.mock.calls[0]?.[1]).toBe('server-name.srt')
    expect(toast.success).toHaveBeenCalledWith('tasks.toast.export.one')
    expect(onActionSettled).not.toHaveBeenCalled()
  })

  it('falls back to local filename when single-export response has no filename', async () => {
    const blob = new Blob(['srt-content'], { type: 'application/x-subrip' })
    downloadExportMock.mockResolvedValue({
      blob,
      filename: null,
    })

    const { result } = renderHook(() =>
      useHistoryTaskActions({
        refresh: vi.fn().mockResolvedValue(undefined),
      }),
    )

    await act(async () => {
      await result.current.exportTask(
        {
          task_id: 'task-custom',
          filename: 'source.mp3',
        },
        {
          format: 'srt',
          include_timestamps: true,
          filename: 'meeting-notes',
        },
      )
    })

    expect(downloadExportMock).toHaveBeenCalledWith('task-custom', {
      format: 'srt',
      include_timestamps: true,
      filename: 'meeting-notes',
    })
    expect(downloadBlobMock.mock.calls[0]?.[1]).toBe('meeting-notes.srt')
  })

  it('exports selected tasks via batch-export API and downloads zip', async () => {
    const blob = new Blob(['zip-content'], { type: 'application/zip' })
    batchExportMock.mockResolvedValue({
      blob,
      filename: 'export_20260322_091455.zip',
    })

    const onActionSettled = vi.fn()

    const { result } = renderHook(() =>
      useHistoryTaskActions({
        refresh: vi.fn().mockResolvedValue(undefined),
        onActionSettled,
      }),
    )

    await act(async () => {
      await result.current.exportTasks(['task-a', 'task-b', 'task-a'], {
        format: 'srt',
        include_timestamps: true,
        zip_name: '  tasks-archive  ',
      })
    })

    expect(batchExportMock).toHaveBeenCalledWith({
      task_ids: ['task-a', 'task-b'],
      format: 'srt',
      include_timestamps: true,
      zip_name: 'tasks-archive',
    })
    expect(downloadBlobMock).toHaveBeenCalledTimes(1)
    expect(downloadBlobMock.mock.calls[0]?.[1]).toBe('export_20260322_091455.zip')
    expect(toast.success).toHaveBeenCalledWith('tasks.toast.batch.export.success')
    expect(onActionSettled).not.toHaveBeenCalled()
  })

  it('falls back to generic zip filename when response header has no filename', async () => {
    const blob = new Blob(['zip-content'], { type: 'application/zip' })
    batchExportMock.mockResolvedValue({
      blob,
      filename: null,
    })

    const { result } = renderHook(() =>
      useHistoryTaskActions({
        refresh: vi.fn().mockResolvedValue(undefined),
      }),
    )

    await act(async () => {
      await result.current.exportTasks(['task-a'], {
        format: 'srt',
        include_timestamps: true,
      })
    })

    expect(downloadBlobMock.mock.calls[0]?.[1]).toBe('export.zip')
  })

  it('exports a single task to server and surfaces saved path', async () => {
    saveExportMock.mockResolvedValue({
      saved_path: 'exports/demo.srt',
    })

    const { result } = renderHook(() =>
      useHistoryTaskActions({
        refresh: vi.fn().mockResolvedValue(undefined),
      }),
    )

    await act(async () => {
      await result.current.exportTask(
        {
          task_id: 'task-2',
          filename: 'demo.mp3',
        },
        {
          format: 'srt',
          include_timestamps: true,
          target: 'save',
        },
      )
    })

    expect(saveExportMock).toHaveBeenCalledWith('task-2', {
      format: 'srt',
      include_timestamps: true,
    })
    expect(downloadBlobMock).not.toHaveBeenCalled()
    expect(toast.success).toHaveBeenCalledWith('tasks.toast.export.saved')
  })
})
