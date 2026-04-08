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

import { cn } from '@/lib/utils'

type TaskBadgeStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
type ModelBadgeStatus = 'not_downloaded' | 'downloading' | 'downloaded'

export type StatusBadgeStatus = TaskBadgeStatus | ModelBadgeStatus
export type StatusBadgeKind = 'task' | 'model'

export type StatusBadgeProps = HTMLAttributes<HTMLSpanElement> & {
  status: StatusBadgeStatus
  kind?: StatusBadgeKind
  label?: ReactNode
  showIcon?: boolean
}

const TASK_STATUSES: readonly TaskBadgeStatus[] = [
  'pending',
  'processing',
  'completed',
  'failed',
  'cancelled',
]

const STATUS_STYLES: Record<StatusBadgeStatus, string> = {
  pending: 'border-warning/15 bg-warning-container text-on-warning-container',
  processing: 'border-border bg-secondary text-secondary-foreground',
  completed: 'border-success/15 bg-success-container text-on-success-container',
  failed: 'border-destructive/15 bg-destructive-container text-on-destructive-container',
  cancelled: 'border-outline-variant bg-surface-container text-on-surface-variant',
  not_downloaded: 'border-outline-variant bg-surface-container text-on-surface-variant',
  downloading: 'border-border bg-secondary text-secondary-foreground',
  downloaded: 'border-success/15 bg-success-container text-on-success-container',
}

const STATUS_ICONS: Record<StatusBadgeStatus, typeof Clock3> = {
  pending: Clock3,
  processing: LoaderCircle,
  completed: CheckCircle2,
  failed: AlertCircle,
  cancelled: CircleSlash,
  not_downloaded: Download,
  downloading: LoaderCircle,
  downloaded: CheckCircle2,
}

function isTaskStatus(status: StatusBadgeStatus): status is TaskBadgeStatus {
  return TASK_STATUSES.includes(status as TaskBadgeStatus)
}

function humanizeStatus(status: StatusBadgeStatus): string {
  return status
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function StatusBadge({
  status,
  kind,
  label,
  showIcon = true,
  className,
  ...props
}: StatusBadgeProps) {
  const { t } = useTranslation()
  const resolvedKind = kind ?? (isTaskStatus(status) ? 'task' : 'model')
  const Icon = STATUS_ICONS[status]
  const resolvedLabel =
    label ??
    (resolvedKind === 'task' ? t(`tasks.status.${status}`) : t(`models.status.${status}`)) ??
    humanizeStatus(status)

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
            (status === 'processing' || status === 'downloading') && 'animate-spin',
          )}
        />
      ) : null}
      <span>{resolvedLabel}</span>
    </span>
  )
}
