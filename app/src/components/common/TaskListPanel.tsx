import { type ReactNode, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import logger from '@/config/logger'
import type { TaskSummary } from '@/shared/types'
import type { TaskActionHandler } from './types'

export interface TaskListPanelProps {
  title: string
  description?: string
  emptyText: string
  tasks: TaskSummary[]
  resolveFileName?: (task: TaskSummary) => string | undefined
  onCancelTask?: TaskActionHandler
  onRetryTask?: TaskActionHandler
  onDeleteTaskRecord?: TaskActionHandler
  toolbar?: ReactNode
  pagination?: {
    page: number
    pageSize: number
    total: number
    isLoading?: boolean
    onPageChange: (nextPage: number) => void
  }
}

function formatDatetime(value: string | null): string {
  if (!value) return '-'
  const timestamp = Date.parse(value)
  if (Number.isNaN(timestamp)) return value
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(timestamp))
}

function resolveStatusLabel(status: TaskSummary['status'], t: (key: string) => string): string {
  switch (status) {
    case 'pending':
      return t('tasks.status.pending')
    case 'processing':
      return t('tasks.status.processing')
    case 'completed':
      return t('tasks.status.completed')
    case 'failed':
      return t('tasks.status.failed')
    case 'cancelled':
      return t('tasks.status.cancelled')
    default:
      return status
  }
}

function clampProgress(progress: number): number {
  if (!Number.isFinite(progress)) return 0
  if (progress < 0) return 0
  if (progress > 100) return 100
  return progress
}

type TaskActionType = 'cancel' | 'retry' | 'delete'

function buildActionKey(taskId: string, action: TaskActionType): string {
  return `${taskId}:${action}`
}

/**
 * Keep task list rendering centralized so recent/history panels only handle data mapping.
 *
 * @param title Panel heading.
 * @param description Optional panel description.
 * @param emptyText Empty-state message when no tasks exist.
 * @param tasks Task rows to render.
 * @param resolveFileName Optional file-name resolver; fallback keeps file_id visible.
 * @param onCancelTask Optional cancel action callback.
 * @param onRetryTask Optional retry action callback.
 * @param onDeleteTaskRecord Optional delete-record action callback.
 * @param toolbar Optional query toolbar rendered above list rows.
 * @param pagination Optional page controls rendered below list rows.
 * @returns Task list panel with row actions.
 */
export function TaskListPanel({
  title,
  description,
  emptyText,
  tasks,
  resolveFileName,
  onCancelTask,
  onRetryTask,
  onDeleteTaskRecord,
  toolbar,
  pagination,
}: TaskListPanelProps) {
  const { t } = useTranslation()
  const runningActionsRef = useRef<Set<string>>(new Set())
  const [runningActions, setRunningActions] = useState<Set<string>>(() => new Set())

  function markActionRunning(actionKey: string): boolean {
    if (runningActionsRef.current.has(actionKey)) {
      return false
    }

    runningActionsRef.current.add(actionKey)
    setRunningActions((previous) => {
      if (previous.has(actionKey)) {
        return previous
      }
      const next = new Set(previous)
      next.add(actionKey)
      return next
    })
    return true
  }

  function clearActionRunning(actionKey: string): void {
    if (!runningActionsRef.current.has(actionKey)) {
      return
    }

    runningActionsRef.current.delete(actionKey)
    setRunningActions((previous) => {
      if (!previous.has(actionKey)) {
        return previous
      }
      const next = new Set(previous)
      next.delete(actionKey)
      return next
    })
  }

  async function runTaskAction(
    task: TaskSummary,
    action: TaskActionType,
    handler?: TaskActionHandler,
  ) {
    if (!handler) return
    const actionKey = buildActionKey(task.task_id, action)
    if (!markActionRunning(actionKey)) {
      return
    }

    try {
      await handler(task)
    } catch (error: unknown) {
      logger.error('task.actionHandlerFailed', {
        taskId: task.task_id,
        action,
        error,
      })
    } finally {
      clearActionRunning(actionKey)
    }
  }

  const paginationModel = useMemo(() => {
    if (!pagination) return null

    const { page, pageSize, total } = pagination
    const normalizedPageSize = Math.max(pageSize, 1)
    const totalPages = Math.max(1, Math.ceil(Math.max(total, 0) / normalizedPageSize))
    const currentPage = Math.min(Math.max(page, 1), totalPages)
    const start = total === 0 ? 0 : (currentPage - 1) * normalizedPageSize + 1
    const end = total === 0 ? 0 : Math.min(total, currentPage * normalizedPageSize)

    return {
      currentPage,
      totalPages,
      start,
      end,
      total,
    }
  }, [pagination])

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-3">
        {toolbar}

        {tasks.length === 0 ? (
          <p className="text-muted-foreground text-sm">{emptyText}</p>
        ) : (
          tasks.map((task) => {
            const fileLabel = task.filename ?? resolveFileName?.(task) ?? task.file_id
            const pendingOrProcessing = task.status === 'pending' || task.status === 'processing'
            const retryable = task.status === 'failed' || task.status === 'cancelled'
            const deletable =
              task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled'
            const progress = clampProgress(task.progress)

            const cancelBusy = runningActions.has(buildActionKey(task.task_id, 'cancel'))
            const retryBusy = runningActions.has(buildActionKey(task.task_id, 'retry'))
            const deleteBusy = runningActions.has(buildActionKey(task.task_id, 'delete'))

            return (
              <div key={task.task_id} className="space-y-2 rounded-lg border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1 text-sm">
                    <p className="font-medium">
                      {t('tasks.fields.taskId')}: {task.task_id}
                    </p>
                    <p className="text-muted-foreground">
                      {t('tasks.fields.file')}: {fileLabel}
                    </p>
                    <p className="text-muted-foreground">
                      {t('tasks.fields.status')}: {resolveStatusLabel(task.status, t)}
                    </p>
                    <p className="text-muted-foreground">
                      {t('tasks.fields.createdAt')}: {formatDatetime(task.created_at)}
                    </p>
                    <p className="text-muted-foreground">
                      {t('tasks.fields.completedAt')}: {formatDatetime(task.completed_at)}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {pendingOrProcessing && onCancelTask ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        aria-busy={cancelBusy}
                        disabled={cancelBusy}
                        onClick={() => {
                          void runTaskAction(task, 'cancel', onCancelTask)
                        }}
                      >
                        {cancelBusy ? t('tasks.actions.cancelling') : t('tasks.actions.cancel')}
                      </Button>
                    ) : null}

                    {retryable && onRetryTask ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        aria-busy={retryBusy}
                        disabled={retryBusy}
                        onClick={() => {
                          void runTaskAction(task, 'retry', onRetryTask)
                        }}
                      >
                        {retryBusy ? t('tasks.actions.retrying') : t('tasks.actions.retry')}
                      </Button>
                    ) : null}

                    {deletable && onDeleteTaskRecord ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        aria-busy={deleteBusy}
                        disabled={deleteBusy}
                        onClick={() => {
                          void runTaskAction(task, 'delete', onDeleteTaskRecord)
                        }}
                      >
                        {deleteBusy ? t('tasks.actions.deleting') : t('tasks.actions.deleteRecord')}
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-1">
                  <Progress value={progress} />
                  <p className="text-muted-foreground text-xs">
                    {t('tasks.fields.progress')}: {Math.round(progress)}%
                  </p>
                </div>
              </div>
            )
          })
        )}

        {pagination && paginationModel ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2">
            <p className="text-muted-foreground text-xs">
              {t('tasks.pagination.summary', {
                start: paginationModel.start,
                end: paginationModel.end,
                total: paginationModel.total,
              })}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pagination.isLoading || paginationModel.currentPage <= 1}
                onClick={() => {
                  pagination.onPageChange(paginationModel.currentPage - 1)
                }}
              >
                {t('tasks.pagination.previous')}
              </Button>
              <span className="text-muted-foreground text-xs">
                {t('tasks.pagination.page', {
                  current: paginationModel.currentPage,
                  total: paginationModel.totalPages,
                })}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={
                  pagination.isLoading || paginationModel.currentPage >= paginationModel.totalPages
                }
                onClick={() => {
                  pagination.onPageChange(paginationModel.currentPage + 1)
                }}
              >
                {t('tasks.pagination.next')}
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
