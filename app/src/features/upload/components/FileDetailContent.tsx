import { useMemo, useRef, useState } from 'react'
import { AudioLines, Download, RotateCcw, SquareSlash } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { StatusBadge } from '@/components/ui/StatusBadge'
import type { FileInfo, TaskSummary } from '@/shared/types'

export type FileTaskAvailability = 'known' | 'unknown'

export interface FileDetailContentProps {
  file: FileInfo
  taskAvailability: FileTaskAvailability
  associatedTasks: readonly TaskSummary[]
  onExportTask?: (task: TaskSummary) => Promise<void>
  onRetryTask?: (task: TaskSummary) => Promise<void>
  onCancelTask?: (task: TaskSummary) => Promise<void>
}

type RowAction = 'cancel' | 'export' | 'retry'

function formatFileSize(sizeInBytes: number): string {
  if (!Number.isFinite(sizeInBytes) || sizeInBytes <= 0) {
    return '0 B'
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'] as const
  let value = sizeInBytes
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`
}

function formatTimestamp(value: string): string {
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

function buildRowActionKey(taskId: string, action: RowAction): string {
  return `${taskId}:${action}`
}

export function FileDetailContent({
  file,
  taskAvailability,
  associatedTasks,
  onExportTask,
  onRetryTask,
  onCancelTask,
}: FileDetailContentProps) {
  const { t } = useTranslation()
  const rowActionsRef = useRef<Set<string>>(new Set())
  const [runningRowActions, setRunningRowActions] = useState<Set<string>>(() => new Set())

  const metadataItems = useMemo(
    () => [
      {
        label: t('tasks.fields.fileId'),
        value: file.file_id,
        valueClassName: 'font-mono text-xs tracking-tight',
      },
      {
        label: t('history.files.table.columns.size'),
        value: formatFileSize(file.size),
      },
      {
        label: t('history.files.table.columns.contentType'),
        value: file.content_type ?? t('history.files.table.typeFallback'),
      },
      {
        label: t('history.files.table.columns.uploadedAt'),
        value: formatTimestamp(file.created_at),
      },
    ],
    [file.content_type, file.created_at, file.file_id, file.size, t],
  )

  function markRowActionRunning(actionKey: string): boolean {
    if (rowActionsRef.current.has(actionKey)) {
      return false
    }

    rowActionsRef.current.add(actionKey)
    setRunningRowActions((previous) => {
      if (previous.has(actionKey)) {
        return previous
      }

      const next = new Set(previous)
      next.add(actionKey)
      return next
    })
    return true
  }

  function clearRowActionRunning(actionKey: string): void {
    if (!rowActionsRef.current.has(actionKey)) {
      return
    }

    rowActionsRef.current.delete(actionKey)
    setRunningRowActions((previous) => {
      if (!previous.has(actionKey)) {
        return previous
      }

      const next = new Set(previous)
      next.delete(actionKey)
      return next
    })
  }

  async function runRowAction(
    task: TaskSummary,
    action: RowAction,
    handler?: (task: TaskSummary) => Promise<void>,
  ): Promise<void> {
    if (!handler) {
      return
    }

    const actionKey = buildRowActionKey(task.task_id, action)
    if (!markRowActionRunning(actionKey)) {
      return
    }

    try {
      await handler(task)
    } finally {
      clearRowActionRunning(actionKey)
    }
  }

  return (
    <div data-slot="file-detail-content" className="space-y-6">
      <section className="space-y-3">
        <div className="space-y-1">
          <h3 className="text-[11px] font-semibold tracking-[0.22em] uppercase">
            {t('history.files.detail.sections.metadata')}
          </h3>
          <p className="text-muted-foreground text-sm">{file.filename}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {metadataItems.map((item) => (
            <div key={item.label} className="bg-surface-container-low rounded-xl border px-4 py-3">
              <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.18em] uppercase">
                {item.label}
              </p>
              <p className={item.valueClassName ?? 'text-sm font-medium'}>{item.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="space-y-1">
          <h3 className="text-[11px] font-semibold tracking-[0.22em] uppercase">
            {t('history.files.detail.sections.waveform')}
          </h3>
          <p className="text-muted-foreground text-sm">
            {t('history.files.detail.waveformDescription')}
          </p>
        </div>

        <div className="bg-surface-container-low flex min-h-32 items-center justify-center rounded-xl border px-4 py-5">
          <div className="space-y-3 text-center">
            <div className="text-primary bg-background mx-auto flex size-12 items-center justify-center rounded-full border">
              <AudioLines className="size-5" />
            </div>
            <p className="text-muted-foreground text-sm">
              {t('history.files.detail.waveformPlaceholder')}
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="space-y-1">
          <h3 className="text-[11px] font-semibold tracking-[0.22em] uppercase">
            {t('history.files.detail.sections.associatedTasks')}
          </h3>
          <p className="text-muted-foreground text-sm">
            {t('history.files.detail.associatedTasksDescription')}
          </p>
        </div>

        {taskAvailability === 'unknown' ? (
          <EmptyState
            title={t('history.files.detail.associatedTasksUnavailable.title')}
            description={t('history.files.detail.associatedTasksUnavailable.description')}
          />
        ) : associatedTasks.length === 0 ? (
          <EmptyState
            title={t('history.files.detail.associatedTasksEmpty.title')}
            description={t('history.files.detail.associatedTasksEmpty.description')}
          />
        ) : (
          <div className="space-y-3">
            {associatedTasks.map((task) => {
              const exportBusy = runningRowActions.has(buildRowActionKey(task.task_id, 'export'))
              const retryBusy = runningRowActions.has(buildRowActionKey(task.task_id, 'retry'))
              const cancelBusy = runningRowActions.has(buildRowActionKey(task.task_id, 'cancel'))
              const canExport = task.status === 'completed' && typeof onExportTask !== 'undefined'
              const canRetry =
                (task.status === 'failed' || task.status === 'cancelled') &&
                typeof onRetryTask !== 'undefined'
              const canCancel =
                (task.status === 'pending' || task.status === 'processing') &&
                typeof onCancelTask !== 'undefined'

              return (
                <article
                  key={task.task_id}
                  className="bg-surface-container-low space-y-3 rounded-xl border px-4 py-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="truncate font-mono text-sm font-semibold tracking-tight">
                        {task.task_id}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {t('history.files.detail.taskCreatedAt', {
                          value: formatTimestamp(task.created_at),
                        })}
                      </p>
                    </div>
                    <StatusBadge status={task.status} />
                  </div>

                  <ProgressBar percent={task.progress} showValue />

                  <div className="flex flex-wrap justify-end gap-2">
                    {canExport ? (
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        disabled={exportBusy}
                        onClick={() => {
                          void runRowAction(task, 'export', onExportTask)
                        }}
                      >
                        <Download />
                        {t('tasks.actions.export')}
                      </Button>
                    ) : null}

                    {canRetry ? (
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        disabled={retryBusy}
                        onClick={() => {
                          void runRowAction(task, 'retry', onRetryTask)
                        }}
                      >
                        <RotateCcw />
                        {t('tasks.actions.retry')}
                      </Button>
                    ) : null}

                    {canCancel ? (
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        disabled={cancelBusy}
                        onClick={() => {
                          void runRowAction(task, 'cancel', onCancelTask)
                        }}
                      >
                        <SquareSlash />
                        {t('tasks.actions.cancel')}
                      </Button>
                    ) : null}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
