import { lazy, Suspense, useCallback, useState } from 'react'
import { Copy } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import logger from '@/config/logger'
import { Button } from '@/components/ui/button'
import { DetailSheet } from '@/components/ui/DetailSheet'
import { useExportDefaults, type ExportRequestOptions } from '@/features/export'
import type { SingleExportRequestOptions } from '@/features/export'
import {
  deleteTaskRecordAction,
  requestTaskRefresh,
  useHistoryTaskActions,
  useHistoryTasks,
  useSessionTasksStore,
} from '@/features/tasks'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { HistoryTaskRecordsView } from './HistoryTaskRecordsView'
import { useHistoryTaskDetail } from './useHistoryTaskDetail'
import type { HistoryPageSize, HistoryRecordsMode, HistoryTaskQuery } from '@/routes/history-search'
import type { SortOrder, TaskFilterStatus, TaskSortBy, TaskSummary } from '@/shared/types'
import { useDetailOverlayCloseRequest } from '@/shared/lib/overlay-events'

const LazyTaskDetailContent = lazy(async () => {
  const module = await import('@/features/tasks/components/TaskDetailContent')
  return { default: module.TaskDetailContent }
})

export interface HistoryTaskModeViewProps {
  query: HistoryTaskQuery
  onSearchChange: (value: string) => void
  onStatusChange: (value: TaskFilterStatus) => void
  onSortByChange: (value: TaskSortBy) => void
  onOrderChange: (value: SortOrder) => void
  onPageChange: (value: number) => void
  onPageSizeChange: (value: HistoryPageSize) => void
  onPageClamp?: (page: number) => void
  onModeChange?: (mode: HistoryRecordsMode) => void
  onCreateTask?: () => void
}

export function HistoryTaskModeView({
  query,
  onSearchChange,
  onStatusChange,
  onSortByChange,
  onOrderChange,
  onPageChange,
  onPageSizeChange,
  onPageClamp,
  onModeChange,
  onCreateTask,
}: HistoryTaskModeViewProps) {
  const { t } = useTranslation()
  const exportDefaults = useExportDefaults()
  const addCreatedTask = useSessionTasksStore((state) => state.addCreatedTask)
  const removeSessionTask = useSessionTasksStore((state) => state.removeSessionTask)
  const upsertSessionTask = useSessionTasksStore((state) => state.upsertSessionTask)
  const [selectedDetailTask, setSelectedDetailTask] = useState<TaskSummary | null>(null)
  const [runningDetailAction, setRunningDetailAction] = useState<
    'cancel' | 'delete' | 'export' | 'retry' | null
  >(null)
  const closeTaskDetail = useCallback(() => {
    setSelectedDetailTask(null)
  }, [])

  useDetailOverlayCloseRequest(closeTaskDetail)

  const historyTasks = useHistoryTasks({
    query,
    onPageClamp,
  })
  const taskDetail = useHistoryTaskDetail(selectedDetailTask?.task_id ?? null)
  const historyTaskActions = useHistoryTaskActions({
    refresh: historyTasks.refresh,
    onRetryCreatedTask: (task) => {
      addCreatedTask({
        task_id: task.taskId,
        file_id: task.fileId,
        filename: task.filename,
        status: 'pending',
      })
    },
    onCancelledTask: (task) => {
      if (!useSessionTasksStore.getState().byId[task.taskId]) {
        return
      }

      upsertSessionTask({
        task_id: task.taskId,
        file_id: task.fileId,
        filename: task.filename,
        status: task.status,
      })
    },
    onActionSettled: requestTaskRefresh,
  })

  async function handleCancelHistoryTask(task: TaskSummary) {
    await historyTaskActions.cancelTasks([task.task_id])
  }

  async function handleRetryHistoryTask(task: TaskSummary) {
    await historyTaskActions.retryTasks([task.task_id])
  }

  async function handleExportHistoryTask(task: TaskSummary, options: SingleExportRequestOptions) {
    return historyTaskActions.exportTask(task, options)
  }

  async function deleteHistoryTaskRecord(task: TaskSummary): Promise<boolean> {
    try {
      await deleteTaskRecordAction(task.task_id)
      removeSessionTask(task.task_id)
      toast.success(t('tasks.toast.recordDeleted', { taskId: task.task_id }))
      return true
    } catch (error: unknown) {
      logger.error('history.deleteTaskRecordFailed', { error, taskId: task.task_id })
      toast.error(t('tasks.toast.actionFailed'))
      return false
    } finally {
      try {
        await historyTasks.refresh()
      } catch (error: unknown) {
        logger.error('history.refreshAfterDeleteFailed', { error, taskId: task.task_id })
      }
    }
  }

  async function handleDeleteHistoryTask(task: TaskSummary) {
    await deleteHistoryTaskRecord(task)
  }

  async function handleCopyTaskId(taskId: string): Promise<void> {
    if (!navigator.clipboard?.writeText) {
      return
    }

    try {
      await navigator.clipboard.writeText(taskId)
      toast.success(t('history.taskDetail.toast.taskIdCopied'))
    } catch {
      toast.error(t('tasks.toast.actionFailed'))
    }
  }

  async function resolveExportDefaults(): Promise<ExportRequestOptions | null> {
    if (!exportDefaults.isLoading) {
      return exportDefaults.defaults
    }

    try {
      return await exportDefaults.refresh()
    } catch {
      toast.error(t('tasks.toast.actionFailed'))
      return null
    }
  }

  async function runDetailAction(
    action: 'cancel' | 'delete' | 'export' | 'retry',
    handler: () => Promise<void>,
  ): Promise<void> {
    if (runningDetailAction !== null) {
      return
    }

    setRunningDetailAction(action)
    try {
      await handler()
    } catch (error: unknown) {
      logger.error('history.detailActionFailed', { action, error })
    } finally {
      setRunningDetailAction(null)
    }
  }

  const detailActionTask = taskDetail.task ?? selectedDetailTask
  const canExportDetail = detailActionTask?.status === 'completed'
  const canRetryDetail =
    detailActionTask?.status === 'failed' || detailActionTask?.status === 'cancelled'
  const canCancelDetail =
    detailActionTask?.status === 'pending' || detailActionTask?.status === 'processing'
  const canDeleteDetail =
    detailActionTask?.status === 'completed' ||
    detailActionTask?.status === 'failed' ||
    detailActionTask?.status === 'cancelled'

  return (
    <>
      <HistoryTaskRecordsView
        tasks={historyTasks.tasks}
        query={query}
        total={historyTasks.total}
        isLoading={historyTasks.isLoading}
        errorMessage={
          historyTasks.error ? t(historyTasks.error.i18nKey, historyTasks.error.params ?? {}) : null
        }
        onSearchChange={onSearchChange}
        onStatusChange={onStatusChange}
        onSortByChange={onSortByChange}
        onOrderChange={onOrderChange}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        onModeChange={onModeChange}
        onCreateTask={onCreateTask}
        onRetry={historyTasks.refresh}
        onOpenTaskDetail={setSelectedDetailTask}
        onCancelTask={handleCancelHistoryTask}
        onRetryTask={handleRetryHistoryTask}
        onDeleteTaskRecord={handleDeleteHistoryTask}
        onExportTask={handleExportHistoryTask}
        onBatchCancelTasks={historyTaskActions.cancelTasks}
        onBatchRetryTasks={historyTaskActions.retryTasks}
        onBatchExportTasks={historyTaskActions.exportTasks}
      />

      <DetailSheet
        open={selectedDetailTask !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedDetailTask(null)
          }
        }}
        mode="dialog"
        size="wide"
        eyebrow={t('history.taskDetail.eyebrow')}
        title={
          taskDetail.task?.filename?.trim() ||
          selectedDetailTask?.filename?.trim() ||
          t('history.table.filenameFallback')
        }
        description={
          detailActionTask ? (
            <span className="font-mono text-xs tracking-tight">
              {t('tasks.fields.taskId')}: {detailActionTask.task_id}
            </span>
          ) : undefined
        }
        headerAdornment={
          detailActionTask ? (
            <div className="flex items-center gap-2">
              <StatusBadge status={detailActionTask.status} />
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                aria-label={t('history.taskDetail.copyTaskId')}
                onClick={() => {
                  void handleCopyTaskId(detailActionTask.task_id)
                }}
              >
                <Copy />
              </Button>
            </div>
          ) : undefined
        }
        closeLabel={t('history.taskDetail.close')}
        bodyClassName="px-0 py-0"
        footer={
          detailActionTask ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="default"
                  disabled={!canExportDetail || runningDetailAction !== null}
                  onClick={() => {
                    void runDetailAction('export', async () => {
                      const defaults = await resolveExportDefaults()
                      if (!defaults) {
                        return
                      }

                      await historyTaskActions.exportTask(detailActionTask, {
                        format: defaults.format,
                        include_timestamps: defaults.include_timestamps,
                        target: 'download',
                      })
                    })
                  }}
                >
                  {t('tasks.actions.export')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!canRetryDetail || runningDetailAction !== null}
                  onClick={() => {
                    void runDetailAction('retry', async () => {
                      await handleRetryHistoryTask(detailActionTask)
                      await taskDetail.refresh()
                    })
                  }}
                >
                  {t('tasks.actions.retry')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!canCancelDetail || runningDetailAction !== null}
                  onClick={() => {
                    void runDetailAction('cancel', async () => {
                      await handleCancelHistoryTask(detailActionTask)
                      await taskDetail.refresh()
                    })
                  }}
                >
                  {t('tasks.actions.cancel')}
                </Button>
              </div>
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                disabled={!canDeleteDetail || runningDetailAction !== null}
                onClick={() => {
                  void runDetailAction('delete', async () => {
                    const deleted = await deleteHistoryTaskRecord(detailActionTask)
                    if (deleted) {
                      setSelectedDetailTask(null)
                    }
                  })
                }}
              >
                {t('tasks.actions.deleteRecord')}
              </Button>
            </div>
          ) : undefined
        }
      >
        {taskDetail.error ? (
          <div className="px-6 py-8">
            <p className="text-destructive text-sm">
              {t(taskDetail.error.i18nKey, taskDetail.error.params ?? {})}
            </p>
          </div>
        ) : taskDetail.task ? (
          <Suspense
            fallback={
              <div className="px-6 py-8">
                <p className="text-muted-foreground text-sm">{t('history.taskDetail.loading')}</p>
              </div>
            }
          >
            <LazyTaskDetailContent task={taskDetail.task} />
          </Suspense>
        ) : (
          <div className="px-6 py-8">
            <p className="text-muted-foreground text-sm">{t('history.taskDetail.loading')}</p>
          </div>
        )}
      </DetailSheet>
    </>
  )
}
