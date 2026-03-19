import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { TaskListPanel } from '@/components/common'
import { useSessionTasksStore } from '@/features/transcription/store/session-tasks-store'
import type { TaskSummary } from '@/shared/types'

type TaskActionHandler = (task: TaskSummary) => Promise<void>

export interface CurrentBatchTasksPanelProps {
  resolveFileName?: (task: TaskSummary) => string | undefined
  onCancelTask?: TaskActionHandler
  onRetryTask?: TaskActionHandler
}

/**
 * Keep recent task presentation decoupled from page layout.
 *
 * @param resolveFileName Optional file-name resolver for display labels.
 * @param onCancelTask Optional cancel action callback.
 * @param onRetryTask Optional retry action callback.
 * @returns Session-scoped recent task panel.
 */
export function CurrentBatchTasksPanel({
  resolveFileName,
  onCancelTask,
  onRetryTask,
}: CurrentBatchTasksPanelProps) {
  const { t } = useTranslation()
  const order = useSessionTasksStore((state) => state.order)
  const byId = useSessionTasksStore((state) => state.byId)

  const tasks = useMemo(() => {
    return order.map((taskId) => byId[taskId]).filter((task): task is TaskSummary => Boolean(task))
  }, [byId, order])

  return (
    <TaskListPanel
      title={t('tasks.currentBatch.title')}
      description={t('tasks.currentBatch.description')}
      emptyText={t('tasks.currentBatch.empty')}
      tasks={tasks}
      resolveFileName={resolveFileName}
      onCancelTask={onCancelTask}
      onRetryTask={onRetryTask}
    />
  )
}
