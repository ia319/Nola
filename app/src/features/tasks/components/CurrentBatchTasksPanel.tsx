import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ListToolbar, TaskListPanel } from '@/components/common'
import type { TaskActionHandler } from '@/components/common'
import { Button } from '@/components/ui/button'
import { useRecentTaskQuery } from '@/features/tasks/hooks/useRecentTaskQuery'
import { useTaskSelection } from '@/features/tasks/hooks/useTaskSelection'
import { useSessionTasksStore } from '@/features/tasks/store/session-tasks-store'
import type { TaskSummary } from '@/shared/types'

import { TaskBatchActionBar } from './TaskBatchActionBar'

export interface CurrentBatchTasksPanelProps {
  resolveFileName?: (task: TaskSummary) => string | undefined
  onCancelTask?: TaskActionHandler
  onRetryTask?: TaskActionHandler
  onBatchCancelTasks?: (taskIds: string[]) => Promise<unknown>
  onBatchRetryTasks?: (taskIds: string[]) => Promise<unknown>
  pageSize?: number
}

export function CurrentBatchTasksPanel({
  resolveFileName,
  onCancelTask,
  onRetryTask,
  onBatchCancelTasks,
  onBatchRetryTasks,
  pageSize,
}: CurrentBatchTasksPanelProps) {
  const { t } = useTranslation()
  const [runningBatchAction, setRunningBatchAction] = useState<'cancel' | 'retry' | null>(null)
  const runningBatchActionRef = useRef(false)

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
    newTaskCount,
    setSearch,
    setStatus,
    setSortBy,
    setOrder,
    setPage,
    goToFirstPageForNewTasks,
  } = useRecentTaskQuery(tasks, pageSize)

  const pagedTaskMap = useMemo(() => {
    return Object.fromEntries(pagedTasks.map((task) => [task.task_id, task]))
  }, [pagedTasks])

  const selectionResetToken = `${query.order}|${query.page}|${query.q}|${query.sort_by}|${query.status}`
  const { selectedTaskIds, allCurrentPageSelected, toggleTask, toggleCurrentPage, clearSelection } =
    useTaskSelection(pagedTasks, {
      resetToken: selectionResetToken,
    })

  const cancellableTaskIds = selectedTaskIds.filter((taskId) => {
    const task = pagedTaskMap[taskId]
    return task?.status === 'pending' || task?.status === 'processing'
  })

  const retryableTaskIds = selectedTaskIds.filter((taskId) => {
    const task = pagedTaskMap[taskId]
    return task?.status === 'failed' || task?.status === 'cancelled'
  })

  async function runPerTaskAction(taskIds: string[], handler?: TaskActionHandler): Promise<void> {
    if (!handler || taskIds.length === 0) {
      return
    }

    for (const taskId of taskIds) {
      const task = pagedTaskMap[taskId]
      if (!task) {
        continue
      }
      await handler(task)
    }
  }

  async function runBatchAction(action: 'cancel' | 'retry', taskIds: string[]): Promise<void> {
    if (taskIds.length === 0 || runningBatchActionRef.current) {
      return
    }

    const batchHandler = action === 'cancel' ? onBatchCancelTasks : onBatchRetryTasks
    const perTaskHandler = action === 'cancel' ? onCancelTask : onRetryTask
    if (!batchHandler && !perTaskHandler) {
      return
    }

    runningBatchActionRef.current = true
    setRunningBatchAction(action)
    try {
      if (batchHandler) {
        await batchHandler(taskIds)
      } else {
        await runPerTaskAction(taskIds, perTaskHandler)
      }
      clearSelection()
    } catch {
      return
    } finally {
      runningBatchActionRef.current = false
      setRunningBatchAction(null)
    }
  }

  const hasBatchCancelHandler = Boolean(onBatchCancelTasks || onCancelTask)
  const hasBatchRetryHandler = Boolean(onBatchRetryTasks || onRetryTask)

  return (
    <TaskListPanel
      title={t('tasks.currentBatch.title')}
      description={t('tasks.currentBatch.description')}
      emptyText={t('tasks.currentBatch.empty')}
      tasks={pagedTasks}
      resolveFileName={resolveFileName}
      onCancelTask={onCancelTask}
      onRetryTask={onRetryTask}
      selection={{
        selectedTaskIds,
        onToggleTask: toggleTask,
      }}
      toolbar={
        <div className="space-y-2">
          {newTaskCount > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed p-2">
              <p className="text-muted-foreground text-xs">
                {t('tasks.currentBatch.newTasksNotice', { count: newTaskCount })}
              </p>
              <Button type="button" size="sm" variant="outline" onClick={goToFirstPageForNewTasks}>
                {t('tasks.currentBatch.backToFirstPage')}
              </Button>
            </div>
          ) : null}
          <TaskBatchActionBar
            scope="currentBatch"
            allCurrentPageSelected={allCurrentPageSelected}
            selectedCount={selectedTaskIds.length}
            hasCurrentPageTasks={pagedTasks.length > 0}
            runningBatchAction={runningBatchAction}
            cancellableCount={cancellableTaskIds.length}
            retryableCount={retryableTaskIds.length}
            onToggleCurrentPage={toggleCurrentPage}
            onBatchCancel={
              hasBatchCancelHandler
                ? () => {
                    void runBatchAction('cancel', cancellableTaskIds)
                  }
                : undefined
            }
            onBatchRetry={
              hasBatchRetryHandler
                ? () => {
                    void runBatchAction('retry', retryableTaskIds)
                  }
                : undefined
            }
          />
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
        </div>
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
