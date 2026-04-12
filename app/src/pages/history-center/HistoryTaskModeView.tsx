import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import type { SingleExportRequestOptions } from '@/features/export'
import {
  deleteTaskRecordAction,
  requestTaskRefresh,
  useHistoryTaskActions,
  useHistoryTasks,
  useSessionTasksStore,
} from '@/features/tasks'
import { HistoryTaskRecordsView } from './HistoryTaskRecordsView'
import type { HistoryPageSize, HistoryRecordsMode } from '@/routes/history-search'
import type {
  SortOrder,
  TaskFilterStatus,
  TaskQueryModel,
  TaskSortBy,
  TaskSummary,
} from '@/shared/types'

export interface HistoryTaskModeViewProps {
  query: TaskQueryModel
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
  const addCreatedTask = useSessionTasksStore((state) => state.addCreatedTask)
  const removeSessionTask = useSessionTasksStore((state) => state.removeSessionTask)
  const upsertSessionTask = useSessionTasksStore((state) => state.upsertSessionTask)
  const historyTasks = useHistoryTasks({
    query,
    onPageClamp,
  })
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

  async function handleDeleteHistoryTask(task: TaskSummary) {
    try {
      await deleteTaskRecordAction(task.task_id)
      removeSessionTask(task.task_id)
      toast.success(t('tasks.toast.recordDeleted', { taskId: task.task_id }))
    } catch {
      toast.error(t('tasks.toast.actionFailed'))
    } finally {
      await historyTasks.refresh()
    }
  }

  return (
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
      onCancelTask={handleCancelHistoryTask}
      onRetryTask={handleRetryHistoryTask}
      onDeleteTaskRecord={handleDeleteHistoryTask}
      onExportTask={handleExportHistoryTask}
      onBatchCancelTasks={historyTaskActions.cancelTasks}
      onBatchRetryTasks={historyTaskActions.retryTasks}
      onBatchExportTasks={historyTaskActions.exportTasks}
    />
  )
}
