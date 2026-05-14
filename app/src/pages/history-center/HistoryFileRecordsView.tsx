import { useMemo } from 'react'
import { AudioLines, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  InteractiveTable,
  InteractiveTableRowActionsMenu,
  type InteractiveBatchAction,
  type InteractiveSortState,
  type InteractiveTableColumn,
  type InteractiveTableRowAction,
  useInteractiveTableSelection,
} from '@/components/common'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/EmptyState'
import { HistoryPagination } from './HistoryPagination'
import { HistoryToolbar } from './HistoryToolbar'
import { useHistorySearchDraft } from './hooks/useHistorySearchDraft'
import type { HistoryFileQuery, HistoryPageSize, HistoryRecordsMode } from '@/routes/history-search'
import type { FileContentTypeFilterValue } from '@/shared/lib/file-query-options'
import type { FileInfo, FileSortBy } from '@/shared/types'

export interface HistoryFileRecordRow {
  file: FileInfo
  knownTaskCount: number | null
}

export interface HistoryFileRecordsViewProps {
  rows: HistoryFileRecordRow[]
  query: HistoryFileQuery
  total: number
  isLoading?: boolean
  errorMessage?: string | null
  deletingFileId?: string | null
  isDeletingFiles?: boolean
  mode?: HistoryRecordsMode
  onSearchChange: (value: string) => void
  onContentTypeChange: (value: FileContentTypeFilterValue) => void
  onSortChange: (value: InteractiveSortState<FileSortBy>) => void
  onPageChange: (value: number) => void
  onPageSizeChange: (value: HistoryPageSize) => void
  onModeChange?: (mode: HistoryRecordsMode) => void
  onCreateTask?: () => void
  onRetry?: () => void | Promise<void>
  onOpenFileDetail?: (file: FileInfo) => void
  onRequestDeleteFile?: (file: FileInfo) => void
  onRequestDeleteFiles?: (files: readonly FileInfo[]) => void
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

function formatTimestamp(value: string, formatter: Intl.DateTimeFormat): string {
  const timestamp = Date.parse(value)
  if (Number.isNaN(timestamp)) return value

  return formatter.format(new Date(timestamp))
}

export function HistoryFileRecordsView({
  rows,
  query,
  total,
  isLoading = false,
  errorMessage,
  deletingFileId = null,
  isDeletingFiles = false,
  mode = 'files',
  onSearchChange,
  onContentTypeChange,
  onSortChange,
  onPageChange,
  onPageSizeChange,
  onModeChange,
  onCreateTask,
  onRetry,
  onOpenFileDetail,
  onRequestDeleteFile,
  onRequestDeleteFiles,
}: HistoryFileRecordsViewProps) {
  const { t } = useTranslation()
  const [searchDraft, setSearchDraft] = useHistorySearchDraft(query.q)
  const selectionResetToken = `${mode}|${query.content_type}|${query.order}|${query.page}|${query.page_size}|${query.q}|${query.sort_by}`
  const tableSelection = useInteractiveTableSelection({
    rows,
    getRowId: (row) => row.file.file_id,
    resetToken: selectionResetToken,
  })
  const timestampFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    [],
  )

  const sort = useMemo<InteractiveSortState<FileSortBy>>(
    () => ({
      key: query.sort_by,
      direction: query.order,
    }),
    [query.order, query.sort_by],
  )

  const columns = useMemo<
    readonly InteractiveTableColumn<HistoryFileRecordRow, FileSortBy>[]
  >(() => {
    return [
      {
        id: 'file',
        header: t('history.files.table.columns.file'),
        sortKey: 'filename',
        className: 'min-w-[280px]',
        cell: ({ file }) => (
          <div className="min-w-0 space-y-1">
            <p className="truncate text-sm font-semibold">{file.filename}</p>
            <p className="text-muted-foreground font-mono text-[11px] tracking-tight">
              {file.file_id}
            </p>
          </div>
        ),
      },
      {
        id: 'tasks',
        header: t('history.files.table.columns.tasks'),
        className: 'min-w-[140px]',
        cell: ({ file, knownTaskCount }) => {
          const label =
            knownTaskCount === null
              ? t('history.files.table.tasksUnavailable')
              : t('history.files.table.tasksCount', { count: knownTaskCount })

          if (!onOpenFileDetail) {
            return <span className="text-sm font-medium">{label}</span>
          }

          return (
            <Button
              type="button"
              size="xs"
              variant="ghost"
              className="h-auto px-0 py-0 text-sm font-medium"
              aria-label={t('history.files.table.actions.openDetail', {
                filename: file.filename,
              })}
              onClick={(event) => {
                event.stopPropagation()
                onOpenFileDetail(file)
              }}
            >
              {label}
            </Button>
          )
        },
      },
      {
        id: 'size',
        header: t('history.files.table.columns.size'),
        sortKey: 'size',
        defaultSortDirection: 'desc',
        className: 'min-w-[120px]',
        cell: ({ file }) => <span className="text-sm">{formatFileSize(file.size)}</span>,
      },
      {
        id: 'contentType',
        header: t('history.files.table.columns.contentType'),
        sortKey: 'content_type',
        className: 'min-w-[180px]',
        cell: ({ file }) => (
          <span className="text-sm">
            {file.content_type ?? t('history.files.table.typeFallback')}
          </span>
        ),
      },
      {
        id: 'uploadedAt',
        header: t('history.files.table.columns.uploadedAt'),
        sortKey: 'created_at',
        defaultSortDirection: 'desc',
        className: 'min-w-[220px]',
        cell: ({ file }) => (
          <span className="text-sm">{formatTimestamp(file.created_at, timestampFormatter)}</span>
        ),
      },
      {
        id: 'actions',
        header: t('history.files.table.columns.actions'),
        className: 'w-[96px]',
        headerClassName: 'text-right',
        cell: ({ file }) => {
          const rowActions: readonly InteractiveTableRowAction[] = [
            {
              id: 'delete',
              label: t('history.files.table.actions.delete'),
              ariaLabel: t('history.files.table.actions.delete'),
              icon: <Trash2 />,
              hidden: !onRequestDeleteFile,
              disabled: deletingFileId === file.file_id || isDeletingFiles,
              variant: 'destructive',
              run: () => onRequestDeleteFile?.(file),
            },
          ]

          return (
            <div className="flex justify-end">
              <InteractiveTableRowActionsMenu
                actions={rowActions}
                triggerLabel={t('history.files.table.actions.more', { filename: file.filename })}
              />
            </div>
          )
        },
      },
    ]
  }, [
    deletingFileId,
    isDeletingFiles,
    onOpenFileDetail,
    onRequestDeleteFile,
    t,
    timestampFormatter,
  ])

  const batchActions: readonly InteractiveBatchAction<HistoryFileRecordRow>[] = [
    {
      id: 'delete',
      label: t('history.files.batch.delete'),
      icon: <Trash2 />,
      run: (selectedRows) => {
        onRequestDeleteFiles?.(selectedRows.map((row) => row.file))
      },
      disabled: isDeletingFiles || !onRequestDeleteFiles,
      isRunning: isDeletingFiles,
      variant: 'destructive',
    },
  ]

  return (
    <InteractiveTable
      data-slot="history-file-records-view"
      columns={columns}
      rows={rows}
      getRowId={(row) => row.file.file_id}
      caption={t('history.files.table.caption')}
      sort={sort}
      onSortChange={onSortChange}
      filters={
        <HistoryToolbar
          mode={mode}
          searchValue={searchDraft}
          contentTypeValue={query.content_type}
          isLoading={isLoading}
          onSearchChange={setSearchDraft}
          onSearchSubmit={onSearchChange}
          onContentTypeChange={onContentTypeChange}
          onModeChange={onModeChange}
        />
      }
      selection={{
        ...tableSelection.selection,
        selectAllLabel: t('history.files.table.selectAll'),
        getRowLabel: (row) => t('history.files.table.selectRow', { fileId: row.file.file_id }),
        selectedRowsLabel: (count) => t('history.files.selection.selectedCount', { count }),
        clearSelectionLabel: t('history.selection.clear'),
      }}
      batchActions={batchActions}
      isLoading={isLoading}
      errorState={
        errorMessage
          ? {
              title: t('error.generic'),
              description: errorMessage,
              action: onRetry ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    void onRetry()
                  }}
                >
                  {t('error.boundary.retry')}
                </Button>
              ) : null,
            }
          : null
      }
      onRowClick={
        onOpenFileDetail
          ? (row) => {
              onOpenFileDetail(row.file)
            }
          : undefined
      }
      scrollAreaClassName="overflow-auto"
      stickyHeader
      fillAvailableHeight
      pagination={
        <HistoryPagination
          page={query.page}
          pageSize={query.page_size}
          total={total}
          isLoading={isLoading}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      }
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
  )
}
