import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { batchCancelHistoryTasks, batchRetryHistoryTasks } from '@/features/history/api'
import type { BatchTaskActionResponse, TaskStatus } from '@/shared/types'

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

/**
 * Keep history batch-action side effects consistent: API call, toast summary, and refresh.
 */
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
        await refresh()
        onActionSettled?.()
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

  return {
    cancelTasks,
    retryTasks,
  }
}
