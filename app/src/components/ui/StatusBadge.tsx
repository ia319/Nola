import type { HTMLAttributes, ReactNode } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  CircleSlash,
  Clock3,
  Download,
  LoaderCircle,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { ModelStatus, TaskStatus } from '@/shared/types'
import { cn } from '@/lib/utils'

type TaskBadgeStatus = TaskStatus
type ModelBadgeStatus = ModelStatus

export type StatusBadgeStatus = TaskBadgeStatus | ModelBadgeStatus

export type StatusBadgeProps = HTMLAttributes<HTMLSpanElement> & {
  status: StatusBadgeStatus
  label?: ReactNode
  showIcon?: boolean
}

const TASK_STATUS_STYLES: Record<TaskBadgeStatus, string> = {
  pending: 'border-warning/15 bg-warning-container text-on-warning-container',
  processing: 'border-border bg-secondary text-secondary-foreground',
  completed: 'border-success/15 bg-success-container text-on-success-container',
  failed: 'border-destructive/15 bg-destructive-container text-on-destructive-container',
  cancelled: 'border-outline-variant bg-surface-container text-on-surface-variant',
}

const MODEL_STATUS_STYLES: Record<ModelBadgeStatus, string> = {
  not_downloaded: 'border-outline-variant bg-surface-container text-on-surface-variant',
  downloading: 'border-border bg-secondary text-secondary-foreground',
  downloaded: 'border-success/15 bg-success-container text-on-success-container',
}

const STATUS_STYLES: Record<StatusBadgeStatus, string> = {
  ...TASK_STATUS_STYLES,
  ...MODEL_STATUS_STYLES,
}

const TASK_STATUS_ICONS: Record<TaskBadgeStatus, typeof Clock3> = {
  pending: Clock3,
  processing: LoaderCircle,
  completed: CheckCircle2,
  failed: AlertCircle,
  cancelled: CircleSlash,
}

const MODEL_STATUS_ICONS: Record<ModelBadgeStatus, typeof Clock3> = {
  not_downloaded: Download,
  downloading: LoaderCircle,
  downloaded: CheckCircle2,
}

const STATUS_ICONS: Record<StatusBadgeStatus, typeof Clock3> = {
  ...TASK_STATUS_ICONS,
  ...MODEL_STATUS_ICONS,
}

function isTaskStatus(status: StatusBadgeStatus): status is TaskBadgeStatus {
  return Object.hasOwn(TASK_STATUS_STYLES, status)
}

function humanizeStatus(status: StatusBadgeStatus): string {
  return status
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function StatusBadge({
  status,
  label,
  showIcon = true,
  className,
  ...props
}: StatusBadgeProps) {
  const { t } = useTranslation()
  const resolvedKind = isTaskStatus(status) ? 'task' : 'model'
  const Icon = STATUS_ICONS[status]
  const resolvedLabel =
    label ??
    t(resolvedKind === 'task' ? `tasks.status.${status}` : `models.status.${status}`, {
      defaultValue: humanizeStatus(status),
    })

  return (
    <span
      data-slot="status-badge"
      data-kind={resolvedKind}
      data-status={status}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap',
        STATUS_STYLES[status],
        className,
      )}
      {...props}
    >
      {showIcon ? (
        <Icon
          className={cn(
            'size-3.5 shrink-0',
            (status === 'processing' || status === 'downloading') &&
              'motion-safe:animate-spin motion-reduce:animate-none',
          )}
        />
      ) : null}
      <span>{resolvedLabel}</span>
    </span>
  )
}
