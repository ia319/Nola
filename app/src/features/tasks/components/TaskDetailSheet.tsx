import { lazy, Suspense, type ReactNode } from 'react'
import { Copy } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { DetailSheet } from '@/components/ui/DetailSheet'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { cn } from '@/lib/utils'
import type { AppError, TaskDetail, TaskSummary } from '@/shared/types'

const LazyTaskDetailContent = lazy(async () => {
  const module = await import('./TaskDetailContent')
  return { default: module.TaskDetailContent }
})

export type TaskDetailSheetTask = TaskDetail | TaskSummary
export type TaskDetailSheetActionPlacement = 'primary' | 'danger'
export type TaskDetailSheetActionVariant =
  | 'default'
  | 'destructive'
  | 'ghost'
  | 'outline'
  | 'secondary'

export interface TaskDetailSheetAction<ActionId extends string = string> {
  id: ActionId
  label: ReactNode
  enabled: boolean
  run: (task: TaskDetailSheetTask) => void | Promise<void>
  placement?: TaskDetailSheetActionPlacement
  variant?: TaskDetailSheetActionVariant
  className?: string
}

export interface TaskDetailSheetProps<ActionId extends string = string> {
  open: boolean
  summaryTask: TaskSummary | null
  detailTask: TaskDetail | null
  error: AppError | null
  actions: readonly TaskDetailSheetAction<ActionId>[]
  runningAction: ActionId | null
  onOpenChange: (open: boolean) => void
  onRunAction: (
    action: TaskDetailSheetAction<ActionId>,
    task: TaskDetailSheetTask,
  ) => void | Promise<void>
}

/**
 * Render the shared task detail surface used by History and Workbench.
 */
export function TaskDetailSheet<ActionId extends string = string>({
  open,
  summaryTask,
  detailTask,
  error,
  actions,
  runningAction,
  onOpenChange,
  onRunAction,
}: TaskDetailSheetProps<ActionId>) {
  const { t } = useTranslation()
  const actionTask = detailTask ?? summaryTask
  const primaryActions = actions.filter((action) => action.placement !== 'danger')
  const dangerActions = actions.filter((action) => action.placement === 'danger')

  async function handleCopyTaskId(taskId: string): Promise<void> {
    if (!navigator.clipboard?.writeText) {
      return
    }

    try {
      await navigator.clipboard.writeText(taskId)
      toast.success(t('history.taskDetail.toast.taskIdCopied'))
    } catch {
      toast.error(t('tasks.toast.actionFailed'))
    }
  }

  function renderActionButton(action: TaskDetailSheetAction<ActionId>) {
    const disabled = !action.enabled || runningAction !== null
    const variant =
      action.variant ?? (action.placement === 'danger' ? 'ghost' : ('outline' as const))

    return (
      <Button
        key={action.id}
        type="button"
        variant={variant}
        className={cn(
          action.placement === 'danger' && 'text-destructive hover:text-destructive',
          action.className,
        )}
        disabled={disabled}
        onClick={() => {
          if (!actionTask || disabled) {
            return
          }
          void onRunAction(action, actionTask)
        }}
      >
        {action.label}
      </Button>
    )
  }

  return (
    <DetailSheet
      open={open}
      onOpenChange={onOpenChange}
      mode="dialog"
      size="wide"
      eyebrow={t('history.taskDetail.eyebrow')}
      title={
        detailTask?.filename?.trim() ||
        summaryTask?.filename?.trim() ||
        t('history.table.filenameFallback')
      }
      description={
        actionTask ? (
          <span className="font-mono text-xs tracking-tight">
            {t('tasks.fields.taskId')}: {actionTask.task_id}
          </span>
        ) : undefined
      }
      headerAdornment={
        actionTask ? (
          <div className="flex items-center gap-2">
            <StatusBadge status={actionTask.status} />
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              aria-label={t('history.taskDetail.copyTaskId')}
              onClick={() => {
                void handleCopyTaskId(actionTask.task_id)
              }}
            >
              <Copy />
            </Button>
          </div>
        ) : undefined
      }
      closeLabel={t('history.taskDetail.close')}
      bodyClassName="px-0 py-0"
      footer={
        actionTask ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {primaryActions.map(renderActionButton)}
            </div>
            {dangerActions.map(renderActionButton)}
          </div>
        ) : undefined
      }
    >
      {error ? (
        <div className="px-6 py-8">
          <p className="text-destructive text-sm">{t(error.i18nKey, error.params ?? {})}</p>
        </div>
      ) : detailTask ? (
        <Suspense
          fallback={
            <div className="px-6 py-8">
              <p className="text-muted-foreground text-sm">{t('history.taskDetail.loading')}</p>
            </div>
          }
        >
          <LazyTaskDetailContent task={detailTask} />
        </Suspense>
      ) : (
        <div className="px-6 py-8">
          <p className="text-muted-foreground text-sm">{t('history.taskDetail.loading')}</p>
        </div>
      )}
    </DetailSheet>
  )
}
