import { useEffect, useRef, useState } from 'react'
import { CloudUpload, Plus, Upload } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  useInteractiveTableSelection,
  useLocalInteractiveTableQuery,
  type InteractiveSortState,
  type LocalInteractiveTableSortComparator,
} from '@/components/common/interactive-table'
import { EmptyState } from '@/components/ui'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import logger from '@/config/logger'
import {
  FileUploader,
  selectCancellableUploads,
  selectRemovableUploads,
  selectRetryableUploads,
  selectStartableUploads,
  UploadList,
  UPLOAD_STATUS_SORT_ORDER,
  type UploadItem,
  type UploadQueueSortBy,
} from '@/features/upload'
import { formatFileSize } from '@/shared/lib/format'

type UploadBatchActionType = 'cancel' | 'remove' | 'retry' | 'start'
type UploadQueueSortComparators = Partial<
  Record<UploadQueueSortBy, LocalInteractiveTableSortComparator<UploadItem>>
>

export interface TaskWorkbenchUploadQueueProps {
  uploads: UploadItem[]
  maxFileSize: number
  isUploading: boolean
  disabled?: boolean
  hasPending: boolean
  onFilesSelected: (files: File[]) => void
  onCancelUpload: (id: string) => void
  onCancelUploads: (ids: readonly string[]) => void
  onRetryUpload: (id: string) => Promise<void>
  onRetryUploads: (ids: readonly string[]) => Promise<void>
  onRemoveUpload: (id: string) => Promise<void>
  onRemoveUploads: (ids: readonly string[]) => Promise<void>
  onStartUploads: (ids: readonly string[]) => Promise<void>
  onReset: () => Promise<void>
  onSelectedUploadsChange?: (uploads: readonly UploadItem[]) => void
}

function resolveProgressSortValue(upload: UploadItem): number {
  if (upload.status === 'success') {
    return 100
  }
  if (!Number.isFinite(upload.progress)) {
    return 0
  }
  return upload.progress
}

const UPLOAD_QUEUE_SORT_COMPARATORS: UploadQueueSortComparators = {
  filename: (left, right) => left.file.name.localeCompare(right.file.name),
  status: (left, right) =>
    UPLOAD_STATUS_SORT_ORDER[left.status] - UPLOAD_STATUS_SORT_ORDER[right.status],
  size: (left, right) => left.file.size - right.file.size,
  progress: (left, right) => resolveProgressSortValue(left) - resolveProgressSortValue(right),
}

export function TaskWorkbenchUploadQueue({
  uploads,
  maxFileSize,
  isUploading,
  disabled = false,
  hasPending,
  onFilesSelected,
  onCancelUpload,
  onCancelUploads,
  onRetryUpload,
  onRetryUploads,
  onRemoveUpload,
  onRemoveUploads,
  onStartUploads,
  onReset,
  onSelectedUploadsChange,
}: TaskWorkbenchUploadQueueProps) {
  const { t } = useTranslation()
  const [sort, setSort] = useState<InteractiveSortState<UploadQueueSortBy> | null>(null)
  const [runningBatchAction, setRunningBatchAction] = useState<UploadBatchActionType | null>(null)
  const runningBatchActionRef = useRef(false)
  const hasUploads = uploads.length > 0
  const controlsDisabled = disabled || isUploading
  const uploadQuery = useLocalInteractiveTableQuery<UploadItem, UploadQueueSortBy>({
    rows: uploads,
    sort,
    sortComparators: UPLOAD_QUEUE_SORT_COMPARATORS,
  })
  const selectionResetToken = uploads.map((upload) => upload.id).join('|')
  const tableSelection = useInteractiveTableSelection({
    rows: uploadQuery.sortedRows,
    getRowId: (upload) => upload.id,
    resetToken: selectionResetToken,
  })
  const selectedRows = tableSelection.selectedRows
  const startableRows = selectStartableUploads(selectedRows)
  const cancellableRows = selectCancellableUploads(selectedRows)
  const retryableRows = selectRetryableUploads(selectedRows)
  const removableRows = selectRemovableUploads(selectedRows)

  useEffect(() => {
    onSelectedUploadsChange?.(selectedRows)
  }, [onSelectedUploadsChange, selectedRows])

  async function runBatchAction(
    action: UploadBatchActionType,
    rows: readonly UploadItem[],
    handler: (ids: readonly string[]) => void | Promise<void>,
  ): Promise<void> {
    if (rows.length === 0 || runningBatchActionRef.current) return

    runningBatchActionRef.current = true
    setRunningBatchAction(action)
    try {
      await handler(rows.map((row) => row.id))
    } catch (error) {
      logger.warn(`upload.${action}Batch unexpected`, error)
    } finally {
      runningBatchActionRef.current = false
      setRunningBatchAction(null)
    }
  }

  return (
    <section data-slot="task-workbench-upload-queue" className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-foreground text-base font-semibold tracking-tight">
          {t('tasks.workbench.sections.uploadQueue.title')}
        </h2>
        <p className="text-muted-foreground text-xs">
          {t('tasks.workbench.sections.uploadQueue.maxFileSize', {
            maxSize: formatFileSize(maxFileSize),
          })}
        </p>
      </div>

      {hasUploads ? (
        <Card className="flex min-h-[28rem] flex-1 flex-col gap-0 overflow-hidden py-0">
          <CardContent className="flex flex-1 flex-col px-0 py-0">
            <div className="min-h-0 flex-1 overflow-auto">
              <UploadList
                uploads={uploadQuery.sortedRows}
                sort={sort}
                onSortChange={setSort}
                selection={{
                  ...tableSelection.selection,
                  getRowLabel: (upload) =>
                    t('tasks.uploadQueue.selection.selectRow', { name: upload.file.name }),
                  selectAllLabel: t('tasks.uploadQueue.selection.selectAll'),
                }}
                onCancel={onCancelUpload}
                onRetry={onRetryUpload}
                onRemove={onRemoveUpload}
              />
            </div>

            <div className="bg-surface-container-lowest flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
              <FileUploader
                onFilesSelected={onFilesSelected}
                disabled={controlsDisabled}
                ariaLabel={t('tasks.uploadQueue.actions.addMoreFiles')}
                className="text-muted-foreground hover:text-foreground min-h-0 items-start justify-start gap-0 border-0 bg-transparent p-0 shadow-none hover:bg-transparent"
              >
                <span className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.22em] uppercase">
                  <Upload className="size-3.5" />
                  {t('tasks.uploadQueue.actions.addMoreFiles')}
                </span>
              </FileUploader>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    void runBatchAction('cancel', cancellableRows, onCancelUploads)
                  }}
                  disabled={disabled || runningBatchAction !== null || cancellableRows.length === 0}
                >
                  {t('tasks.uploadQueue.batchActions.cancel', { count: cancellableRows.length })}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void runBatchAction('retry', retryableRows, onRetryUploads)}
                  disabled={
                    controlsDisabled || runningBatchAction !== null || retryableRows.length === 0
                  }
                >
                  {t('tasks.uploadQueue.batchActions.retry', { count: retryableRows.length })}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void runBatchAction('remove', removableRows, onRemoveUploads)}
                  disabled={disabled || runningBatchAction !== null || removableRows.length === 0}
                  className="text-destructive hover:text-destructive"
                >
                  {t('tasks.uploadQueue.batchActions.remove', { count: removableRows.length })}
                </Button>
                {hasPending ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      void runBatchAction('start', startableRows, onStartUploads)
                    }}
                    disabled={
                      controlsDisabled || runningBatchAction !== null || startableRows.length === 0
                    }
                  >
                    {isUploading
                      ? t('upload.progress.uploading')
                      : t('tasks.uploadQueue.batchActions.uploadSelected', {
                          count: startableRows.length,
                        })}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void onReset()}
                  disabled={controlsDisabled}
                >
                  {t('upload.reset')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <FileUploader
          onFilesSelected={onFilesSelected}
          disabled={controlsDisabled}
          ariaLabel={t('tasks.uploadQueue.empty.action')}
          className="border-outline-variant/70 min-h-[28rem] justify-center rounded-xl border-dashed px-8 py-10"
        >
          <EmptyState
            icon={<CloudUpload className="size-7" />}
            title={t('tasks.uploadQueue.empty.title')}
            description={t('tasks.uploadQueue.empty.description')}
            action={
              <Button type="button" variant="outline" size="sm" disabled={controlsDisabled}>
                <Plus className="size-4" />
                {t('tasks.uploadQueue.empty.action')}
              </Button>
            }
            className="max-w-none border-0 bg-transparent px-0 py-0"
          />
        </FileUploader>
      )}
    </section>
  )
}
