import { AudioLines } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable'
import { EmptyState } from '@/components/ui/EmptyState'
import { HistoryPagination } from './HistoryPagination'
import { HistoryToolbar } from './HistoryToolbar'
import type { HistoryFileQuery, HistoryPageSize, HistoryRecordsMode } from '@/routes/history-search'
import type { FileInfo } from '@/shared/types'

export interface HistoryFileRecordsViewProps {
  files: FileInfo[]
  query: HistoryFileQuery
  total: number
  isLoading?: boolean
  errorMessage?: string | null
  mode?: HistoryRecordsMode
  onPageChange: (value: number) => void
  onPageSizeChange: (value: HistoryPageSize) => void
  onModeChange?: (mode: HistoryRecordsMode) => void
  onCreateTask?: () => void
}

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
  if (Number.isNaN(timestamp)) return value

  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(timestamp))
}

const NOOP = () => {}

export function HistoryFileRecordsView({
  files,
  query,
  total,
  isLoading = false,
  errorMessage,
  mode = 'files',
  onPageChange,
  onPageSizeChange,
  onModeChange,
  onCreateTask,
}: HistoryFileRecordsViewProps) {
  const { t } = useTranslation()

  const columns: readonly DataTableColumn<FileInfo>[] = [
    {
      key: 'file',
      header: t('history.files.table.columns.file'),
      className: 'min-w-[280px]',
      cell: (file) => (
        <div className="min-w-0 space-y-1">
          <p className="truncate text-sm font-semibold">{file.filename}</p>
          <p className="text-muted-foreground font-mono text-[11px] tracking-tight">
            {file.file_id}
          </p>
        </div>
      ),
    },
    {
      key: 'size',
      header: t('history.files.table.columns.size'),
      className: 'min-w-[120px]',
      cell: (file) => <span className="text-sm">{formatFileSize(file.size)}</span>,
    },
    {
      key: 'contentType',
      header: t('history.files.table.columns.contentType'),
      className: 'min-w-[180px]',
      cell: (file) => (
        <span className="text-sm">
          {file.content_type ?? t('history.files.table.typeFallback')}
        </span>
      ),
    },
    {
      key: 'uploadedAt',
      header: t('history.files.table.columns.uploadedAt'),
      className: 'min-w-[220px]',
      cell: (file) => <span className="text-sm">{formatTimestamp(file.created_at)}</span>,
    },
  ]

  return (
    <section
      data-slot="history-file-records-view"
      className="bg-card flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border shadow-sm"
    >
      <HistoryToolbar
        mode={mode}
        searchValue=""
        statusValue="all"
        sortByValue="created_at"
        orderValue="desc"
        isLoading={isLoading}
        canExportSelection={false}
        showExportSelection={false}
        onSearchChange={NOOP}
        onSearchSubmit={NOOP}
        onStatusChange={NOOP}
        onSortByChange={NOOP}
        onOrderChange={NOOP}
        onModeChange={onModeChange}
      />

      {errorMessage ? (
        <div className="border-b px-4 py-3">
          <p className="text-destructive text-sm">{errorMessage}</p>
        </div>
      ) : null}

      <DataTable
        className="rounded-none border-0 shadow-none"
        columns={columns}
        rows={files}
        getRowId={(file) => file.file_id}
        caption={t('history.files.table.caption')}
        scrollAreaClassName="max-h-[56vh] overflow-auto"
        stickyHeader
        emptyState={
          <EmptyState
            icon={<AudioLines className="size-6" />}
            title={t('history.files.empty.title')}
            description={t('history.files.empty.description')}
            action={
              onCreateTask ? (
                <Button type="button" onClick={onCreateTask}>
                  {t('history.files.empty.action')}
                </Button>
              ) : null
            }
          />
        }
      />

      <HistoryPagination
        page={query.page}
        pageSize={query.page_size}
        total={total}
        isLoading={isLoading}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    </section>
  )
}
