import { useCallback, useMemo } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ErrorBoundary } from '@/components/common'
import { HISTORY_PAGE_SIZE } from '@/config/constants'
import type { SingleExportRequestOptions } from '@/features/export'
import {
  deleteTaskRecordAction,
  requestTaskRefresh,
  useHistoryTaskActions,
  useHistoryTasks,
  useSessionTasksStore,
} from '@/features/tasks'
import { ContentCanvas } from '@/layouts'
import {
  buildHistoryQuery,
  isSameHistorySearch,
  normalizeHistorySearch,
  type HistoryPageSize,
  type HistoryRouteSearch,
} from '@/routes/history-search'
import type {
  SortOrder,
  TaskFilterStatus,
  TaskQueryModel,
  TaskSortBy,
  TaskSummary,
} from '@/shared/types'
import { HistoryTaskRecordsView } from './HistoryTaskRecordsView'

export function HistoryPage() {
  const { t } = useTranslation()
  const navigate = useNavigate({ from: '/history' })
  const search = useSearch({ from: '/history' })
  const query = useMemo<TaskQueryModel>(() => buildHistoryQuery(search), [search])

  const updateSearch = useCallback(
    (patch: Partial<HistoryRouteSearch>, replace: boolean) => {
      void navigate({
        replace,
        search: (previous) => {
          const next = normalizeHistorySearch({ ...previous, ...patch })
          return isSameHistorySearch(previous, next) ? previous : next
        },
      })
    },
    [navigate],
  )

  const handleSearchChange = useCallback(
    (value: string) => {
      updateSearch({ q: value, page: undefined }, false)
    },
    [updateSearch],
  )

  const handleStatusChange = useCallback(
    (value: TaskFilterStatus) => {
      updateSearch(
        {
          status: value === 'all' ? undefined : value,
          page: undefined,
        },
        true,
      )
    },
    [updateSearch],
  )

  const handleSortByChange = useCallback(
    (value: TaskSortBy) => {
      updateSearch(
        {
          sort_by: value === 'created_at' ? undefined : value,
          page: undefined,
        },
        false,
      )
    },
    [updateSearch],
  )

  const handleOrderChange = useCallback(
    (value: SortOrder) => {
      updateSearch(
        {
          order: value === 'desc' ? undefined : value,
          page: undefined,
        },
        false,
      )
    },
    [updateSearch],
  )

  const handlePageChange = useCallback(
    (value: number) => {
      const nextPage = Math.max(1, Math.floor(value))
      updateSearch({ page: nextPage <= 1 ? undefined : nextPage }, false)
    },
    [updateSearch],
  )

  const handlePageSizeChange = useCallback(
    (value: HistoryPageSize) => {
      updateSearch(
        {
          page: undefined,
          page_size: value === HISTORY_PAGE_SIZE ? undefined : value,
        },
        false,
      )
    },
    [updateSearch],
  )

  const handlePageClamp = useCallback(
    (page: number) => {
      updateSearch({ page: page <= 1 ? undefined : page }, true)
    },
    [updateSearch],
  )

  const addCreatedTask = useSessionTasksStore((state) => state.addCreatedTask)
  const removeSessionTask = useSessionTasksStore((state) => state.removeSessionTask)
  const upsertSessionTask = useSessionTasksStore((state) => state.upsertSessionTask)
  const historyTasks = useHistoryTasks({
    query,
    onPageClamp: handlePageClamp,
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
    <ErrorBoundary>
      <ContentCanvas
        as="main"
        className="max-w-[1440px] flex-1 gap-0 px-0 py-0"
        data-slot="history-page"
      >
        <h1 className="sr-only">{t('history.title')}</h1>
        <p className="sr-only">{t('history.description')}</p>
        <HistoryTaskRecordsView
          tasks={historyTasks.tasks}
          query={query}
          total={historyTasks.total}
          isLoading={historyTasks.isLoading}
          errorMessage={
            historyTasks.error
              ? t(historyTasks.error.i18nKey, historyTasks.error.params ?? {})
              : null
          }
          onSearchChange={handleSearchChange}
          onStatusChange={handleStatusChange}
          onSortByChange={handleSortByChange}
          onOrderChange={handleOrderChange}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          onCreateTask={() => {
            void navigate({ to: '/' })
          }}
          onCancelTask={handleCancelHistoryTask}
          onRetryTask={handleRetryHistoryTask}
          onDeleteTaskRecord={handleDeleteHistoryTask}
          onExportTask={handleExportHistoryTask}
          onBatchCancelTasks={historyTaskActions.cancelTasks}
          onBatchRetryTasks={historyTaskActions.retryTasks}
          onBatchExportTasks={historyTaskActions.exportTasks}
        />
      </ContentCanvas>
    </ErrorBoundary>
  )
}
