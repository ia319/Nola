import { useCallback, useMemo, useState } from 'react'
import { ListTodo } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button, DataTable, EmptyState, ProgressBar, StatusBadge } from '@/components/ui'
import type { DataTableColumn } from '@/components/ui'
import { ACTIVE_TASK_STATUSES } from '@/features/tasks/lib/task-status-groups'
import type { TaskSummary } from '@/shared/types'

export interface TaskWorkbenchActivityMonitorProps {
  tasks: TaskSummary[]
  onCancelTask?: (task: TaskSummary) => Promise<void>
}

function resolveFileLabel(task: TaskSummary): string {
  return task.filename?.trim() || task.file_id
}

function clampProgress(progress: number): number {
  if (!Number.isFinite(progress)) return 0
  if (progress <= 0) return 0
  if (progress >= 100) return 100
  return progress
}

export function TaskWorkbenchActivityMonitor({
  tasks,
  onCancelTask,
}: TaskWorkbenchActivityMonitorProps) {
  const { t } = useTranslation()
  const [runningTaskIds, setRunningTaskIds] = useState<string[]>([])
  const runningTaskIdSet = useMemo(() => new Set(runningTaskIds), [runningTaskIds])
  const hasActiveTasks = tasks.some((task) => ACTIVE_TASK_STATUSES.has(task.status))
  const canCancelTasks = Boolean(onCancelTask)

  const handleCancel = useCallback(
    async (task: TaskSummary): Promise<void> => {
      if (!onCancelTask) return
      if (!ACTIVE_TASK_STATUSES.has(task.status)) return
      if (runningTaskIdSet.has(task.task_id)) return

      setRunningTaskIds((previous) => [...previous, task.task_id])
      try {
        await onCancelTask(task)
      } finally {
        setRunningTaskIds((previous) => previous.filter((taskId) => taskId !== task.task_id))
      }
    },
    [onCancelTask, runningTaskIdSet],
  )

  const columns = useMemo<readonly DataTableColumn<TaskSummary>[]>(() => {
    return [
      {
        key: 'filename',
        header: t('tasks.workbench.sections.activity.columns.filename'),
        cell: (task) => (
          <div className="min-w-0">
            <p className="text-foreground truncate text-sm font-medium">{resolveFileLabel(task)}</p>
          </div>
        ),
      },
      {
        key: 'status',
        header: t('tasks.workbench.sections.activity.columns.status'),
        className: 'w-44',
        cell: (task) => <StatusBadge status={task.status} />,
      },
      {
        key: 'progress',
        header: t('tasks.workbench.sections.activity.columns.progress'),
        headerClassName: 'text-right',
        className: 'w-72',
        cell: (task) => {
          const progress = clampProgress(task.progress)

          return (
            <div className="flex min-w-[12rem] items-center justify-end gap-3">
              <div className="min-w-0 flex-1">
                <ProgressBar
                  percent={progress}
                  showValue={false}
                  className="space-y-0"
                  progressClassName="h-1.5"
                />
              </div>
              <span className="text-foreground min-w-11 text-right text-xs font-medium tabular-nums">
                {Math.round(progress)}%
              </span>
            </div>
          )
        },
      },
      {
        key: 'action',
        header: t('tasks.workbench.sections.activity.columns.action'),
        headerClassName: 'text-right',
        className: 'w-28 text-right',
        cell: (task) => {
          const cancelable = canCancelTasks && ACTIVE_TASK_STATUSES.has(task.status)
          const cancelBusy = runningTaskIdSet.has(task.task_id)

          if (!cancelable) {
            return <span className="text-muted-foreground text-xs">-</span>
          }

          return (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={cancelBusy}
              aria-busy={cancelBusy}
              onClick={() => {
                void handleCancel(task)
              }}
            >
              {cancelBusy ? t('tasks.actions.cancelling') : t('tasks.actions.cancel')}
            </Button>
          )
        },
      },
    ]
  }, [canCancelTasks, handleCancel, runningTaskIdSet, t])

  return (
    <section data-slot="task-workbench-activity-monitor" className="space-y-4">
      <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b pb-2">
        <h2 className="text-foreground text-base font-semibold tracking-tight uppercase">
          {t('tasks.workbench.sections.activity.title')}
        </h2>
        <div className="flex items-center gap-1.5">
          <span
            className={[
              'inline-flex size-2 rounded-full',
              hasActiveTasks ? 'bg-foreground animate-pulse' : 'bg-muted-foreground/35',
            ].join(' ')}
          />
          <span className="text-muted-foreground text-[11px] font-semibold tracking-[0.18em] uppercase">
            {hasActiveTasks
              ? t('tasks.workbench.sections.activity.state.active')
              : t('tasks.workbench.sections.activity.state.idle')}
          </span>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={tasks}
        getRowId={(task) => task.task_id}
        caption={t('tasks.workbench.sections.activity.caption')}
        emptyState={
          <EmptyState
            icon={<ListTodo className="size-7" />}
            title={t('tasks.workbench.sections.activity.empty')}
            description={t('tasks.workbench.sections.activity.waiting')}
            className="min-h-48 border-0 bg-transparent px-0 py-10"
          />
        }
      />
    </section>
  )
}
