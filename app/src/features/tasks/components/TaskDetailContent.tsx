import { AlertCircle, FileText } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { EmptyState } from '@/components/ui/EmptyState'
import { ProgressBar } from '@/components/ui/ProgressBar'
import type { Segment, TaskDetail } from '@/shared/types'

export interface TaskDetailContentProps {
  task: TaskDetail
}

function formatTimestamp(value: string | null): string {
  if (!value) {
    return '—'
  }

  const timestamp = Date.parse(value)
  if (Number.isNaN(timestamp)) {
    return value
  }

  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(timestamp))
}

function formatDurationSeconds(value: number | null): string {
  if (!Number.isFinite(value) || value === null || value < 0) {
    return '—'
  }

  const totalSeconds = Number(value)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${seconds
      .toFixed(2)
      .padStart(5, '0')}`
  }

  return `${String(minutes).padStart(2, '0')}:${seconds.toFixed(2).padStart(5, '0')}`
}

function formatSegmentTimestamp(secondsValue: number): string {
  const safeValue = Number.isFinite(secondsValue) ? Math.max(0, secondsValue) : 0
  const hours = Math.floor(safeValue / 3600)
  const minutes = Math.floor((safeValue % 3600) / 60)
  const seconds = Math.floor(safeValue % 60)

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function buildSegmentRange(segment: Segment): string {
  return `[${formatSegmentTimestamp(segment.start)} - ${formatSegmentTimestamp(segment.end)}]`
}

export function TaskDetailContent({ task }: TaskDetailContentProps) {
  const { t } = useTranslation()
  const segments = task.segments ?? []

  return (
    <div
      data-slot="task-detail-content"
      className="grid min-h-0 gap-0 lg:grid-cols-[minmax(0,1.9fr)_minmax(320px,1fr)]"
    >
      <section className="min-h-0 border-b lg:border-r lg:border-b-0">
        <div className="border-b px-6 py-4">
          <h3 className="text-[11px] font-semibold tracking-[0.22em] uppercase">
            {t('history.taskDetail.sections.transcriptionResult')}
          </h3>
        </div>

        <div className="max-h-[60vh] space-y-5 overflow-y-auto px-6 py-6">
          {segments.length > 0 ? (
            segments.map((segment, index) => (
              <article
                key={`${segment.start}-${segment.end}-${index}`}
                className="grid gap-3 sm:grid-cols-[110px_minmax(0,1fr)]"
              >
                <div className="text-muted-foreground font-mono text-xs font-medium tracking-tight">
                  {buildSegmentRange(segment)}
                </div>
                <p className="text-sm leading-7 whitespace-pre-wrap">{segment.text}</p>
              </article>
            ))
          ) : (
            <EmptyState
              icon={<FileText className="size-6" />}
              title={t('history.taskDetail.segments.empty.title')}
              description={t('history.taskDetail.segments.empty.description')}
            />
          )}
        </div>
      </section>

      <aside className="bg-surface-container-low/40 min-h-0 space-y-6 px-6 py-6">
        <section className="space-y-4">
          <h3 className="text-[11px] font-semibold tracking-[0.22em] uppercase">
            {t('history.taskDetail.sections.taskMetadata')}
          </h3>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground text-[11px] font-semibold tracking-[0.18em] uppercase">
                {t('tasks.fields.progress')}
              </span>
              <span className="text-sm font-semibold">{Math.round(task.progress)}%</span>
            </div>
            <ProgressBar percent={task.progress} showValue={false} />
          </div>

          <dl className="space-y-4">
            <div className="space-y-1">
              <dt className="text-muted-foreground text-[11px] font-semibold tracking-[0.18em] uppercase">
                {t('tasks.fields.createdAt')}
              </dt>
              <dd className="text-sm font-medium">{formatTimestamp(task.created_at)}</dd>
            </div>

            <div className="space-y-1">
              <dt className="text-muted-foreground text-[11px] font-semibold tracking-[0.18em] uppercase">
                {t('tasks.fields.completedAt')}
              </dt>
              <dd className="text-sm font-medium">{formatTimestamp(task.completed_at)}</dd>
            </div>

            <div className="space-y-1">
              <dt className="text-muted-foreground text-[11px] font-semibold tracking-[0.18em] uppercase">
                {t('history.taskDetail.fields.duration')}
              </dt>
              <dd className="text-sm font-medium">{formatDurationSeconds(task.duration)}</dd>
            </div>

            <div className="space-y-1">
              <dt className="text-muted-foreground text-[11px] font-semibold tracking-[0.18em] uppercase">
                {t('history.taskDetail.fields.model')}
              </dt>
              <dd className="font-mono text-sm font-medium tracking-tight">
                {task.model_id?.trim() || t('history.table.modelFallback')}
              </dd>
            </div>

            {task.error ? (
              <div className="space-y-1">
                <dt className="text-muted-foreground text-[11px] font-semibold tracking-[0.18em] uppercase">
                  {t('history.taskDetail.fields.error')}
                </dt>
                <dd className="text-destructive text-sm font-medium">{task.error}</dd>
              </div>
            ) : null}
          </dl>
        </section>

        <section className="space-y-4 border-t pt-6">
          <h3 className="text-[11px] font-semibold tracking-[0.22em] uppercase">
            {t('history.taskDetail.sections.technicalProperties')}
          </h3>

          <EmptyState
            icon={<AlertCircle className="size-6" />}
            title={t('history.taskDetail.technicalUnavailable.title')}
            description={t('history.taskDetail.technicalUnavailable.description')}
          />
        </section>
      </aside>
    </div>
  )
}
