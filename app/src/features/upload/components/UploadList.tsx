import { useEffect, useMemo, useRef } from 'react'
import type { UploadItem } from '@/features/upload/types'
import { useTranslation } from 'react-i18next'

import {
  InteractiveTableSortableHeader,
  type InteractiveSortState,
  type InteractiveTableSelection,
} from '@/components/common/interactive-table'
import logger from '@/config/logger'
import type { UploadQueueSortBy } from '@/features/upload/types'
import { cn } from '@/lib/utils'
import { UploadProgress, UPLOAD_PROGRESS_GRID_COLUMNS } from './UploadProgress'

export interface UploadListProps {
  uploads: readonly UploadItem[]
  onCancel: (id: string) => void
  onRetry: (id: string) => Promise<void>
  onRemove: (id: string) => Promise<void>
  sort?: InteractiveSortState<UploadQueueSortBy> | null
  onSortChange?: (sort: InteractiveSortState<UploadQueueSortBy>) => void
  selection?: InteractiveTableSelection<UploadItem>
}

function UploadListCheckbox({
  label,
  checked,
  indeterminate = false,
  onChange,
}: {
  label: string
  checked: boolean
  indeterminate?: boolean
  onChange: (checked: boolean) => void
}) {
  const checkboxRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!checkboxRef.current) return
    checkboxRef.current.indeterminate = indeterminate
  }, [indeterminate])

  return (
    <input
      ref={checkboxRef}
      type="checkbox"
      className="border-border h-4 w-4 rounded"
      aria-label={label}
      checked={checked}
      onChange={(event) => {
        onChange(event.target.checked)
      }}
    />
  )
}

function SortableUploadHeader({
  label,
  sortKey,
  sort,
  onSortChange,
  className,
}: {
  label: string
  sortKey: UploadQueueSortBy
  sort?: InteractiveSortState<UploadQueueSortBy> | null
  onSortChange?: (sort: InteractiveSortState<UploadQueueSortBy>) => void
  className?: string
}) {
  if (!onSortChange) {
    return <span className={className}>{label}</span>
  }

  return (
    <InteractiveTableSortableHeader
      label={label}
      sortKey={sortKey}
      sort={sort}
      onSortChange={onSortChange}
      className={className}
    />
  )
}

/**
 * Render a list of UploadProgress items. Returns null when the list is empty.
 */
export function UploadList({
  uploads,
  onCancel,
  onRetry,
  onRemove,
  sort,
  onSortChange,
  selection,
}: UploadListProps) {
  const { t } = useTranslation()
  const selectedRowIdSet = useMemo(
    () => new Set(selection?.selectedRowIds ?? []),
    [selection?.selectedRowIds],
  )
  const selectedRows = useMemo(
    () => uploads.filter((item) => selectedRowIdSet.has(item.id)),
    [selectedRowIdSet, uploads],
  )
  const allRowsSelected = uploads.length > 0 && selectedRows.length === uploads.length
  const partiallySelected = selectedRows.length > 0 && selectedRows.length < uploads.length

  if (uploads.length === 0) return null

  return (
    <div data-slot="upload-list" className="flex flex-col">
      <div
        className={cn(
          'text-muted-foreground grid gap-4 border-b px-5 py-3 text-[11px] font-semibold tracking-[0.24em] uppercase',
          UPLOAD_PROGRESS_GRID_COLUMNS,
        )}
      >
        <div>
          {selection ? (
            <UploadListCheckbox
              label={selection.selectAllLabel ?? t('tasks.uploadQueue.selection.selectAll')}
              checked={allRowsSelected}
              indeterminate={partiallySelected}
              onChange={(checked) => {
                selection.onToggleCurrentPage(checked, uploads)
              }}
            />
          ) : null}
        </div>
        <SortableUploadHeader
          label={t('tasks.uploadQueue.table.fileName')}
          sortKey="filename"
          sort={sort}
          onSortChange={onSortChange}
        />
        <SortableUploadHeader
          label={t('tasks.uploadQueue.table.status')}
          sortKey="status"
          sort={sort}
          onSortChange={onSortChange}
        />
        <SortableUploadHeader
          label={t('tasks.uploadQueue.table.size')}
          sortKey="size"
          sort={sort}
          onSortChange={onSortChange}
        />
        <SortableUploadHeader
          label={t('tasks.uploadQueue.table.progress')}
          sortKey="progress"
          sort={sort}
          onSortChange={onSortChange}
        />
        <span className="text-right">{t('tasks.uploadQueue.table.action')}</span>
      </div>

      {uploads.map((item) => (
        <UploadProgress
          key={item.id}
          fileName={item.file.name}
          fileSize={item.file.size}
          progress={item.progress}
          status={item.status}
          errorKey={item.error?.i18nKey}
          errorParams={item.error?.params}
          selected={selectedRowIdSet.has(item.id)}
          leading={
            selection ? (
              <UploadListCheckbox
                label={selection.getRowLabel?.(item) ?? t('tasks.uploadQueue.selection.selectRow')}
                checked={selectedRowIdSet.has(item.id)}
                onChange={(checked) => {
                  selection.onToggleRow(item, checked)
                }}
              />
            ) : null
          }
          onRowClick={
            selection
              ? () => {
                  selection.onToggleRow(item, !selectedRowIdSet.has(item.id))
                }
              : undefined
          }
          onCancel={() => onCancel(item.id)}
          onRetry={() => {
            onRetry(item.id).catch((e) => logger.warn('retryUpload unexpected', e))
          }}
          onRemove={() => {
            onRemove(item.id).catch((e) => logger.warn('removeFile unexpected', e))
          }}
        />
      ))}
    </div>
  )
}
