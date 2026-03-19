import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import type { TaskSummary } from '@/shared/types'

type TaskActionHandler = (task: TaskSummary) => Promise<void>

export interface TaskListPanelProps {
  title: string
  description?: string
  emptyText: string
  tasks: TaskSummary[]
  resolveFileName?: (task: TaskSummary) => string | undefined
  onCancelTask?: TaskActionHandler
  onRetryTask?: TaskActionHandler
  onDeleteTaskRecord?: TaskActionHandler
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
}: TaskListPanelProps) {
  const { t } = useTranslation()
  const [runningAction, setRunningAction] = useState<{
    taskId: string
    action: 'cancel' | 'retry' | 'delete'
  } | null>(null)

  async function runTaskAction(
    task: TaskSummary,
    action: 'cancel' | 'retry' | 'delete',
    handler?: TaskActionHandler,
  ) {
    if (!handler) return
    setRunningAction({ taskId: task.task_id, action })
    try {
      await handler(task)
    } finally {
      setRunningAction((previous) => {
        if (!previous || previous.taskId !== task.task_id || previous.action !== action) {
          return previous
        }
        return null
      })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-3">
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

            const cancelBusy =
              runningAction?.taskId === task.task_id && runningAction.action === 'cancel'
            const retryBusy =
              runningAction?.taskId === task.task_id && runningAction.action === 'retry'
            const deleteBusy =
              runningAction?.taskId === task.task_id && runningAction.action === 'delete'

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
                        size="sm"
                        variant="outline"
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
                        size="sm"
                        variant="outline"
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
                        size="sm"
                        variant="outline"
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
      </CardContent>
    </Card>
  )
}
