import { useMemo, useState } from 'react'
import { AudioLines, Trash2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable'
import { EmptyState } from '@/components/ui/EmptyState'
import { HistoryPagination } from './HistoryPagination'
import { HistoryToolbar } from './HistoryToolbar'
import type { HistoryFileQuery, HistoryPageSize, HistoryRecordsMode } from '@/routes/history-search'
import type { FileInfo } from '@/shared/types'

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
  mode?: HistoryRecordsMode
  onPageChange: (value: number) => void
  onPageSizeChange: (value: HistoryPageSize) => void
  onModeChange?: (mode: HistoryRecordsMode) => void
  onCreateTask?: () => void
  onRetry?: () => void | Promise<void>
  onOpenFileDetail?: (file: FileInfo) => void
  onRequestDeleteFile?: (file: FileInfo) => void
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

const NOOP = () => {}

export function HistoryFileRecordsView({
  rows,
  query,
  total,
  isLoading = false,
  errorMessage,
  deletingFileId = null,
  mode = 'files',
  onPageChange,
  onPageSizeChange,
  onModeChange,
  onCreateTask,
  onRetry,
  onOpenFileDetail,
  onRequestDeleteFile,
}: HistoryFileRecordsViewProps) {
  const { t } = useTranslation()
  const selectionResetToken = `${query.page}|${query.page_size}|${rows
    .map((row) => row.file.file_id)
    .join('|')}`
  const currentPageFileIds = useMemo(() => rows.map((row) => row.file.file_id), [rows])
  const currentPageFileIdSet = useMemo(() => new Set(currentPageFileIds), [currentPageFileIds])
  const [selectionState, setSelectionState] = useState<{
    resetToken: string
    ids: string[]
  }>(() => ({
    resetToken: selectionResetToken,
    ids: [],
  }))

  const rawSelectedFileIds = useMemo(() => {
    return selectionState.resetToken === selectionResetToken ? selectionState.ids : []
  }, [selectionResetToken, selectionState.ids, selectionState.resetToken])
  const selectedFileIds = useMemo(() => {
    return rawSelectedFileIds.filter((fileId) => currentPageFileIdSet.has(fileId))
  }, [currentPageFileIdSet, rawSelectedFileIds])
  const selectedFileIdSet = useMemo(() => new Set(selectedFileIds), [selectedFileIds])
  const allCurrentPageSelected =
    rows.length > 0 && rows.every((row) => selectedFileIdSet.has(row.file.file_id))
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

  function getScopedSelectedIds(previous: { resetToken: string; ids: string[] }): string[] {
    const previousIds = previous.resetToken === selectionResetToken ? previous.ids : []
    return previousIds.filter((fileId) => currentPageFileIdSet.has(fileId))
  }

  function clearSelection(): void {
    setSelectionState({
      resetToken: selectionResetToken,
      ids: [],
    })
  }

  const columns = useMemo<readonly DataTableColumn<HistoryFileRecordRow>[]>(() => {
    return [
      {
        key: 'file',
        header: t('history.files.table.columns.file'),
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
        key: 'tasks',
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
        key: 'size',
        header: t('history.files.table.columns.size'),
        className: 'min-w-[120px]',
        cell: ({ file }) => <span className="text-sm">{formatFileSize(file.size)}</span>,
      },
      {
        key: 'contentType',
        header: t('history.files.table.columns.contentType'),
        className: 'min-w-[180px]',
        cell: ({ file }) => (
          <span className="text-sm">
            {file.content_type ?? t('history.files.table.typeFallback')}
          </span>
        ),
      },
      {
        key: 'uploadedAt',
        header: t('history.files.table.columns.uploadedAt'),
        className: 'min-w-[220px]',
        cell: ({ file }) => (
          <span className="text-sm">{formatTimestamp(file.created_at, timestampFormatter)}</span>
        ),
      },
      {
        key: 'actions',
        header: t('history.files.table.columns.actions'),
        className: 'w-[96px]',
        headerClassName: 'text-right',
        cell: ({ file }) => (
          <div className="flex justify-end">
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              aria-label={t('history.files.table.actions.delete')}
              disabled={deletingFileId === file.file_id || !onRequestDeleteFile}
              onClick={(event) => {
                event.stopPropagation()
                onRequestDeleteFile?.(file)
              }}
            >
              <Trash2 />
            </Button>
          </div>
        ),
      },
    ]
  }, [deletingFileId, onOpenFileDetail, onRequestDeleteFile, t, timestampFormatter])

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

      {selectedFileIds.length > 0 ? (
        <div
          data-slot="history-file-selection-bar"
          className="bg-surface-container flex flex-col gap-3 border-b px-4 py-3 lg:flex-row lg:items-center lg:justify-between"
        >
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold tracking-[0.18em] uppercase">
              {t('history.files.selection.selectedCount', { count: selectedFileIds.length })}
            </span>
            <div className="bg-border hidden h-4 w-px lg:block" />
            <Button type="button" size="xs" variant="outline" disabled>
              <Trash2 />
              {t('history.files.batch.deleteComingSoon')}
            </Button>
          </div>

          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            aria-label={t('history.selection.clear')}
            onClick={clearSelection}
          >
            <X />
          </Button>
        </div>
      ) : null}

      <DataTable
        className="rounded-none border-0 shadow-none"
        columns={columns}
        rows={rows}
        getRowId={(row) => row.file.file_id}
        caption={t('history.files.table.caption')}
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
        scrollAreaClassName="max-h-[56vh] overflow-auto"
        stickyHeader
        selection={{
          selectedRowIds: selectedFileIds,
          selectAllLabel: t('history.files.table.selectAll'),
          getRowLabel: (row) => t('history.files.table.selectRow', { fileId: row.file.file_id }),
          onToggleRow: (rowId, checked) => {
            setSelectionState((previous) => {
              const scopedIds = getScopedSelectedIds(previous)
              if (checked) {
                return {
                  resetToken: selectionResetToken,
                  ids: scopedIds.includes(rowId) ? scopedIds : [...scopedIds, rowId],
                }
              }

              return {
                resetToken: selectionResetToken,
                ids: scopedIds.filter((value) => value !== rowId),
              }
            })
          },
          onToggleAllRows: () => {
            setSelectionState((previous) => {
              const scopedIds = getScopedSelectedIds(previous)
              if (allCurrentPageSelected) {
                return {
                  resetToken: selectionResetToken,
                  ids: scopedIds.filter((fileId) => !currentPageFileIdSet.has(fileId)),
                }
              }

              const next = new Set(scopedIds)
              for (const fileId of currentPageFileIds) {
                next.add(fileId)
              }
              return {
                resetToken: selectionResetToken,
                ids: Array.from(next),
              }
            })
          },
        }}
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
