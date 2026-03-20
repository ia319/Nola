import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { ListToolbar, TaskListPanel } from '@/components/common'
import type { TaskActionHandler } from '@/components/common'
import { useSessionTasksStore } from '@/features/transcription/store/session-tasks-store'
import { useRecentTaskQuery } from '@/features/transcription/hooks/useRecentTaskQuery'
import type { TaskSummary } from '@/shared/types'

export interface CurrentBatchTasksPanelProps {
  resolveFileName?: (task: TaskSummary) => string | undefined
  onCancelTask?: TaskActionHandler
  onRetryTask?: TaskActionHandler
  pageSize?: number
}

/**
 * Keep recent task presentation decoupled from page layout.
 *
 * @param resolveFileName Optional file-name resolver for display labels.
 * @param onCancelTask Optional cancel action callback.
 * @param onRetryTask Optional retry action callback.
 * @param pageSize Optional page size for local recent-task pagination.
 * @returns Session-scoped recent task panel.
 */
export function CurrentBatchTasksPanel({
  resolveFileName,
  onCancelTask,
  onRetryTask,
  pageSize,
}: CurrentBatchTasksPanelProps) {
  const { t } = useTranslation()
  // NOTE: Keep selectors independent to avoid object-identity churn from composed selectors;
  // consolidate only after profiling shows re-render pressure in this panel.
  const order = useSessionTasksStore((state) => state.order)
  const byId = useSessionTasksStore((state) => state.byId)

  const tasks = useMemo(() => {
    return order.map((taskId) => byId[taskId]).filter((task): task is TaskSummary => Boolean(task))
  }, [byId, order])

  const {
    query,
    tasks: pagedTasks,
    total,
    setSearch,
    setStatus,
    setSortBy,
    setOrder,
    setPage,
  } = useRecentTaskQuery(tasks, pageSize)

  return (
    <TaskListPanel
      title={t('tasks.currentBatch.title')}
      description={t('tasks.currentBatch.description')}
      emptyText={t('tasks.currentBatch.empty')}
      tasks={pagedTasks}
      resolveFileName={resolveFileName}
      onCancelTask={onCancelTask}
      onRetryTask={onRetryTask}
      toolbar={
        <ListToolbar
          searchValue={query.q}
          statusValue={query.status}
          sortByValue={query.sort_by}
          orderValue={query.order}
          onSearchChange={setSearch}
          onStatusChange={setStatus}
          onSortByChange={setSortBy}
          onOrderChange={setOrder}
        />
      }
      pagination={{
        page: query.page,
        pageSize: query.page_size,
        total,
        onPageChange: setPage,
      }}
    />
  )
}
