import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import logger from '@/config/logger'
import type { InteractiveSortState } from '@/components/common'
import { useExportDefaults, type ExportRequestOptions } from '@/features/export'
import type { SingleExportRequestOptions } from '@/features/export'
import {
  deleteTaskRecordAction,
  requestTaskRefresh,
  TaskDetailSheet,
  type TaskDetailSheetAction,
  useHistoryTaskActions,
  useHistoryTasks,
  useSessionTasksStore,
  useTaskDetailSheet,
} from '@/features/tasks'
import { HistoryTaskRecordsView } from './HistoryTaskRecordsView'
import { useHistoryTaskDetail } from './useHistoryTaskDetail'
import type { HistoryPageSize, HistoryRecordsMode, HistoryTaskQuery } from '@/routes/history-search'
import { useDetailOverlayCloseRequest } from '@/shared/lib/overlay-events'
import {
  isActiveTaskStatus,
  isDeletableTaskRecordStatus,
  isExportableTaskStatus,
  isRetryableTaskStatus,
} from '@/shared/lib/task-status'
import type { TaskFilterStatus, TaskSortBy, TaskSummary } from '@/shared/types'

type HistoryTaskDetailAction = 'cancel' | 'delete' | 'export' | 'retry'

export interface HistoryTaskModeViewProps {
  query: HistoryTaskQuery
  onSearchChange: (value: string) => void
  onStatusChange: (value: TaskFilterStatus) => void
  onSortChange: (value: InteractiveSortState<TaskSortBy>) => void
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
  onSortChange,
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
  const taskDetailSheet = useTaskDetailSheet<HistoryTaskDetailAction>({
    onActionError: (action, error) => {
      logger.error('history.detailActionFailed', { action, error })
    },
  })

  useDetailOverlayCloseRequest(taskDetailSheet.closeTaskDetail)

  const historyTasks = useHistoryTasks({
    query,
    onPageClamp,
  })
  const taskDetail = useHistoryTaskDetail(taskDetailSheet.selectedTask?.task_id ?? null)
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
    onDeletedTaskRecord: (taskId) => {
      removeSessionTask(taskId)
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

  const detailActionTask = taskDetail.task ?? taskDetailSheet.selectedTask
  const canExportDetail = detailActionTask ? isExportableTaskStatus(detailActionTask.status) : false
  const canRetryDetail = detailActionTask ? isRetryableTaskStatus(detailActionTask.status) : false
  const canCancelDetail = detailActionTask ? isActiveTaskStatus(detailActionTask.status) : false
  const canDeleteDetail = detailActionTask
    ? isDeletableTaskRecordStatus(detailActionTask.status)
    : false
  const detailActions: readonly TaskDetailSheetAction<HistoryTaskDetailAction>[] = [
    {
      id: 'export',
      label: t('tasks.actions.export'),
      enabled: Boolean(canExportDetail),
      variant: 'default',
      run: async (task) => {
        const defaults = await resolveExportDefaults()
        if (!defaults) {
          return
        }

        await historyTaskActions.exportTask(task, {
          format: defaults.format,
          include_timestamps: defaults.include_timestamps,
          target: 'download',
        })
      },
    },
    {
      id: 'retry',
      label: t('tasks.actions.retry'),
      enabled: Boolean(canRetryDetail),
      run: async (task) => {
        await handleRetryHistoryTask(task)
        await taskDetail.refresh()
      },
    },
    {
      id: 'cancel',
      label: t('tasks.actions.cancel'),
      enabled: Boolean(canCancelDetail),
      run: async (task) => {
        await handleCancelHistoryTask(task)
        await taskDetail.refresh()
      },
    },
    {
      id: 'delete',
      label: t('tasks.actions.deleteRecord'),
      enabled: Boolean(canDeleteDetail),
      placement: 'danger',
      run: async (task) => {
        const deleted = await deleteHistoryTaskRecord(task)
        if (deleted) {
          taskDetailSheet.closeTaskDetail()
        }
      },
    },
  ]

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
        onSortChange={onSortChange}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        onModeChange={onModeChange}
        onCreateTask={onCreateTask}
        onRetry={historyTasks.refresh}
        onOpenTaskDetail={taskDetailSheet.openTaskDetail}
        onCancelTask={handleCancelHistoryTask}
        onRetryTask={handleRetryHistoryTask}
        onDeleteTaskRecord={handleDeleteHistoryTask}
        onExportTask={handleExportHistoryTask}
        onBatchCancelTasks={historyTaskActions.cancelTasks}
        onBatchRetryTasks={historyTaskActions.retryTasks}
        onBatchExportTasks={historyTaskActions.exportTasks}
        onBatchDeleteTaskRecords={historyTaskActions.deleteTaskRecords}
      />

      <TaskDetailSheet
        open={taskDetailSheet.open}
        summaryTask={taskDetailSheet.selectedTask}
        detailTask={taskDetail.task}
        error={taskDetail.error}
        actions={detailActions}
        runningAction={taskDetailSheet.runningAction}
        onOpenChange={taskDetailSheet.onOpenChange}
        onRunAction={(action, task) => {
          void taskDetailSheet.runDetailAction(action.id, () => action.run(task))
        }}
      />
    </>
  )
}
