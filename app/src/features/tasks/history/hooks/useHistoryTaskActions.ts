import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import logger from '@/config/logger'
import {
  batchExport,
  buildSingleExportFilename,
  downloadExport,
  saveExport,
} from '@/features/export'
import type { ExportRequestOptions, SingleExportRequestOptions } from '@/features/export'
import { batchCancelHistoryTasks, batchRetryHistoryTasks } from '@/features/tasks/history/api'
import { downloadBlob } from '@/shared/lib/utils'
import type { BatchTaskActionResponse, TaskStatus, TaskSummary } from '@/shared/types'

interface RetryCreatedTask {
  taskId: string
  fileId: string
  filename: string | null
}

interface CancelledTask {
  taskId: string
  fileId: string
  filename: string | null
  status: TaskStatus
}

export interface UseHistoryTaskActionsOptions {
  refresh: () => Promise<void>
  onRetryCreatedTask?: (task: RetryCreatedTask) => void
  onCancelledTask?: (task: CancelledTask) => void
  onActionSettled?: () => void
}

export interface UseHistoryTaskActionsResult {
  cancelTasks: (taskIds: string[]) => Promise<BatchTaskActionResponse>
  retryTasks: (taskIds: string[]) => Promise<BatchTaskActionResponse>
  exportTask: (
    task: Pick<TaskSummary, 'task_id' | 'filename'>,
    options: SingleExportRequestOptions,
  ) => Promise<{ mode: 'download' } | { mode: 'save'; savedPath: string }>
  exportTasks: (
    taskIds: string[],
    options: ExportRequestOptions & { zip_name?: string | null },
  ) => Promise<void>
}

type HistoryTaskAction = 'cancel' | 'retry'

function normalizeTaskIds(taskIds: string[]): string[] {
  return Array.from(new Set(taskIds.map((value) => value.trim()).filter((value) => value !== '')))
}

function notifyBatchActionSummary(
  action: HistoryTaskAction,
  summary: BatchTaskActionResponse['summary'],
  t: (key: string, options?: Record<string, unknown>) => string,
): void {
  if (summary.succeeded > 0 && summary.failed === 0) {
    toast.success(t(`tasks.toast.batch.${action}.success`, { count: summary.succeeded }))
    return
  }
  if (summary.succeeded > 0 && summary.failed > 0) {
    toast.warning(
      t(`tasks.toast.batch.${action}.partial`, {
        succeeded: summary.succeeded,
        failed: summary.failed,
      }),
    )
    return
  }
  if (summary.failed > 0) {
    toast.error(t(`tasks.toast.batch.${action}.failed`, { count: summary.failed }))
  }
}

export function useHistoryTaskActions({
  refresh,
  onRetryCreatedTask,
  onCancelledTask,
  onActionSettled,
}: UseHistoryTaskActionsOptions): UseHistoryTaskActionsResult {
  const { t } = useTranslation()

  const runAction = useCallback(
    async (
      action: HistoryTaskAction,
      taskIds: string[],
      request: (normalizedTaskIds: string[]) => Promise<BatchTaskActionResponse>,
    ): Promise<BatchTaskActionResponse> => {
      const normalizedTaskIds = normalizeTaskIds(taskIds)
      if (normalizedTaskIds.length === 0) {
        return {
          action,
          summary: { requested: 0, succeeded: 0, failed: 0 },
          results: [],
        }
      }

      try {
        const response = await request(normalizedTaskIds)
        if (action === 'retry' && onRetryCreatedTask) {
          for (const result of response.results) {
            if (
              result.ok &&
              result.new_task_id &&
              result.file_id &&
              typeof result.filename !== 'undefined'
            ) {
              onRetryCreatedTask({
                taskId: result.new_task_id,
                fileId: result.file_id,
                filename: result.filename,
              })
            }
          }
        }

        if (action === 'cancel' && onCancelledTask) {
          for (const result of response.results) {
            if (
              result.ok &&
              result.status &&
              result.file_id &&
              typeof result.filename !== 'undefined'
            ) {
              onCancelledTask({
                taskId: result.task_id,
                fileId: result.file_id,
                filename: result.filename,
                status: result.status,
              })
            }
          }
        }

        notifyBatchActionSummary(action, response.summary, t)
        return response
      } catch (error: unknown) {
        toast.error(t('tasks.toast.actionFailed'))
        throw error
      } finally {
        try {
          await refresh()
        } catch (error: unknown) {
          logger.error('history.refreshAfterActionFailed', { action, error })
        } finally {
          try {
            onActionSettled?.()
          } catch (error: unknown) {
            logger.error('history.onActionSettledFailed', { action, error })
          }
        }
      }
    },
    [onActionSettled, onCancelledTask, onRetryCreatedTask, refresh, t],
  )

  const cancelTasks = useCallback(
    async (taskIds: string[]): Promise<BatchTaskActionResponse> => {
      return runAction('cancel', taskIds, batchCancelHistoryTasks)
    },
    [runAction],
  )

  const retryTasks = useCallback(
    async (taskIds: string[]): Promise<BatchTaskActionResponse> => {
      return runAction('retry', taskIds, batchRetryHistoryTasks)
    },
    [runAction],
  )

  const exportTask = useCallback(
    async (
      task: Pick<TaskSummary, 'task_id' | 'filename'>,
      options: SingleExportRequestOptions,
    ): Promise<{ mode: 'download' } | { mode: 'save'; savedPath: string }> => {
      const target = options.target ?? 'download'
      const requestOptions: ExportRequestOptions = {
        format: options.format,
        include_timestamps: options.include_timestamps,
      }
      const customFilename = options.filename?.trim()
      try {
        if (target === 'save') {
          const response = await saveExport(task.task_id, {
            ...requestOptions,
            filename: customFilename || undefined,
          })
          toast.success(t('tasks.toast.export.saved', { path: response.saved_path }))
          return {
            mode: 'save',
            savedPath: response.saved_path,
          }
        }

        const { blob, filename: serverFilename } = await downloadExport(task.task_id, {
          ...requestOptions,
          filename: customFilename || undefined,
        })
        const fallbackFilename = buildSingleExportFilename({
          format: options.format,
          taskId: task.task_id,
          taskFilename: task.filename,
          customFilename,
        })
        downloadBlob(blob, serverFilename || fallbackFilename)
        toast.success(t('tasks.toast.export.one'))
        return { mode: 'download' }
      } catch (error: unknown) {
        toast.error(t('tasks.toast.actionFailed'))
        throw error
      }
    },
    [t],
  )

  const exportTasks = useCallback(
    async (
      taskIds: string[],
      options: ExportRequestOptions & { zip_name?: string | null },
    ): Promise<void> => {
      const normalizedTaskIds = normalizeTaskIds(taskIds)
      if (normalizedTaskIds.length === 0) {
        return
      }

      const normalizedZipName = options.zip_name?.trim()

      try {
        const { blob, filename } = await batchExport({
          task_ids: normalizedTaskIds,
          format: options.format,
          include_timestamps: options.include_timestamps,
          zip_name: normalizedZipName ? normalizedZipName : undefined,
        })
        downloadBlob(blob, filename || 'export.zip')
        toast.success(t('tasks.toast.batch.export.success', { count: normalizedTaskIds.length }))
      } catch (error: unknown) {
        toast.error(t('tasks.toast.actionFailed'))
        throw error
      }
    },
    [t],
  )

  return {
    cancelTasks,
    retryTasks,
    exportTask,
    exportTasks,
  }
}
