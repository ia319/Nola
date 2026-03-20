import { useTranslation } from 'react-i18next'

import { ListToolbar, TaskListPanel } from '@/components/common'
import type { TaskFilterStatus, TaskQueryModel, TaskSortBy, TaskSummary } from '@/shared/types'

type TaskActionHandler = (task: TaskSummary) => Promise<void>

export interface TaskHistoryPanelProps {
  tasks: TaskSummary[]
  query: TaskQueryModel
  total: number
  isLoading?: boolean
  errorMessage?: string | null
  onSearchChange: (value: string) => void
  onStatusChange: (value: TaskFilterStatus) => void
  onSortByChange: (value: TaskSortBy) => void
  onOrderChange: (value: TaskQueryModel['order']) => void
  onPageChange: (value: number) => void
  resolveFileName?: (task: TaskSummary) => string | undefined
  onCancelTask?: TaskActionHandler
  onRetryTask?: TaskActionHandler
  onDeleteTaskRecord?: TaskActionHandler
}

/**
 * Keep history list presentation reusable across route, modal, and drawer containers.
 *
 * @param tasks History tasks for current query/page.
 * @param query Current query model for search/filter/sort/pagination controls.
 * @param total Total matched task count from backend pagination.
 * @param isLoading Whether current history query is in-flight.
 * @param errorMessage Optional query error message rendered above the list.
 * @param onSearchChange Query search-text handler.
 * @param onStatusChange Query status-filter handler.
 * @param onSortByChange Query sort-field handler.
 * @param onOrderChange Query order handler.
 * @param onPageChange Query page-change handler.
 * @param resolveFileName Optional file-name resolver for display labels.
 * @param onCancelTask Optional cancel action callback.
 * @param onRetryTask Optional retry action callback.
 * @param onDeleteTaskRecord Optional delete-record action callback.
 * @returns History task panel.
 */
export function TaskHistoryPanel({
  tasks,
  query,
  total,
  isLoading = false,
  errorMessage,
  onSearchChange,
  onStatusChange,
  onSortByChange,
  onOrderChange,
  onPageChange,
  resolveFileName,
  onCancelTask,
  onRetryTask,
  onDeleteTaskRecord,
}: TaskHistoryPanelProps) {
  const { t } = useTranslation()

  return (
    <TaskListPanel
      title={t('tasks.history.title')}
      description={t('tasks.history.description')}
      emptyText={t('tasks.history.empty')}
      tasks={tasks}
      toolbar={
        <div className="space-y-2">
          <ListToolbar
            searchValue={query.q}
            statusValue={query.status}
            sortByValue={query.sort_by}
            orderValue={query.order}
            onSearchChange={onSearchChange}
            onStatusChange={onStatusChange}
            onSortByChange={onSortByChange}
            onOrderChange={onOrderChange}
          />
          {errorMessage ? <p className="text-destructive text-xs">{errorMessage}</p> : null}
        </div>
      }
      pagination={{
        page: query.page,
        pageSize: query.page_size,
        total,
        isLoading,
        onPageChange,
      }}
      resolveFileName={resolveFileName}
      onCancelTask={onCancelTask}
      onRetryTask={onRetryTask}
      onDeleteTaskRecord={onDeleteTaskRecord}
    />
  )
}
