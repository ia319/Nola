import { useTranslation } from 'react-i18next'

import { TaskListPanel } from '@/components/common'
import type { TaskSummary } from '@/shared/types'

type TaskActionHandler = (task: TaskSummary) => Promise<void>

export interface TaskHistoryPanelProps {
  tasks: TaskSummary[]
  resolveFileName?: (task: TaskSummary) => string | undefined
  onCancelTask?: TaskActionHandler
  onRetryTask?: TaskActionHandler
  onDeleteTaskRecord?: TaskActionHandler
}

/**
 * Keep history list presentation reusable across route, modal, and drawer containers.
 *
 * @param tasks History tasks for current query/page.
 * @param resolveFileName Optional file-name resolver for display labels.
 * @param onCancelTask Optional cancel action callback.
 * @param onRetryTask Optional retry action callback.
 * @param onDeleteTaskRecord Optional delete-record action callback.
 * @returns History task panel.
 */
export function TaskHistoryPanel({
  tasks,
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
      resolveFileName={resolveFileName}
      onCancelTask={onCancelTask}
      onRetryTask={onRetryTask}
      onDeleteTaskRecord={onDeleteTaskRecord}
    />
  )
}
