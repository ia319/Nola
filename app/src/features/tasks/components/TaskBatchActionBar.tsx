import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

export interface TaskBatchActionBarProps {
  scope: 'history' | 'currentBatch'
  allCurrentPageSelected: boolean
  selectedCount: number
  hasCurrentPageTasks: boolean
  runningBatchAction: 'cancel' | 'retry' | null
  cancellableCount: number
  retryableCount: number
  exportableCount?: number
  onToggleCurrentPage: () => void
  onBatchCancel?: () => void
  onBatchRetry?: () => void
  onBatchExport?: () => void
}

export function TaskBatchActionBar({
  scope,
  allCurrentPageSelected,
  selectedCount,
  hasCurrentPageTasks,
  runningBatchAction,
  cancellableCount,
  retryableCount,
  exportableCount = 0,
  onToggleCurrentPage,
  onBatchCancel,
  onBatchRetry,
  onBatchExport,
}: TaskBatchActionBarProps) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed p-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onToggleCurrentPage}
          disabled={runningBatchAction !== null || !hasCurrentPageTasks}
        >
          {allCurrentPageSelected
            ? t(`tasks.${scope}.selection.clearCurrentPage`)
            : t(`tasks.${scope}.selection.selectCurrentPage`)}
        </Button>
        <span className="text-muted-foreground text-xs">
          {t(`tasks.${scope}.selection.selectedCount`, { count: selectedCount })}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={runningBatchAction !== null || cancellableCount === 0 || !onBatchCancel}
          onClick={onBatchCancel}
        >
          {runningBatchAction === 'cancel'
            ? t('tasks.actions.cancelling')
            : t(`tasks.${scope}.batchActions.cancel`, { count: cancellableCount })}
        </Button>

        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={runningBatchAction !== null || retryableCount === 0 || !onBatchRetry}
          onClick={onBatchRetry}
        >
          {runningBatchAction === 'retry'
            ? t('tasks.actions.retrying')
            : t(`tasks.${scope}.batchActions.retry`, { count: retryableCount })}
        </Button>

        {onBatchExport ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={runningBatchAction !== null || exportableCount === 0}
            onClick={onBatchExport}
          >
            {t(`tasks.${scope}.batchActions.export`, { count: exportableCount })}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
