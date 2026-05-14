import { lazy, Suspense, useMemo, useRef, useState } from 'react'
import { Download, Radio, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import logger from '@/config/logger'
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
import { StatusBadge } from '@/components/ui/StatusBadge'
import type { LiveHistorySortBy, LiveSessionFilterStatus } from '@/shared/lib/live-query-options'
import type { BatchLiveSessionActionResponse, LiveSessionSummary, TaskStatus } from '@/shared/types'
import { HistoryPagination } from './HistoryPagination'
import { HistoryToolbar } from './HistoryToolbar'
import {
  type BatchExportLiveHandler,
  type ExportLiveSessionHandler,
  useHistoryLiveExportDialog,
} from './hooks/useHistoryLiveExportDialog'
import { useHistorySearchDraft } from './hooks/useHistorySearchDraft'
import type { HistoryLiveQuery, HistoryPageSize } from '@/routes/history-search'

type BatchDeleteLiveHandler = (
  sessionIds: string[],
) => Promise<void | BatchLiveSessionActionResponse>
type RowAction = 'delete'
type BatchLiveAction = 'delete'

export interface HistoryLiveRecordsViewProps {
  sessions: LiveSessionSummary[]
  query: HistoryLiveQuery
  total: number
  isLoading?: boolean
  errorMessage?: string | null
  onSearchChange: (value: string) => void
  onStatusChange: (value: LiveSessionFilterStatus) => void
  onSortChange: (value: InteractiveSortState<LiveHistorySortBy>) => void
  onPageChange: (value: number) => void
  onPageSizeChange: (value: HistoryPageSize) => void
  onRetry?: () => void | Promise<void>
  onOpenLiveDetail?: (session: LiveSessionSummary) => void
  onDeleteLiveSession?: (session: LiveSessionSummary) => Promise<void>
  onExportLiveSession?: ExportLiveSessionHandler
  onBatchDeleteLiveSessions?: BatchDeleteLiveHandler
  onBatchExportLiveSessions?: BatchExportLiveHandler
}

const LazyExportDialog = lazy(async () => {
  const module = await import('@/features/export')
  return { default: module.ExportDialog }
})

function formatTimestamp(value: string | null | undefined, formatter: Intl.DateTimeFormat): string {
  if (!value) return '—'

  const timestamp = Date.parse(value)
  if (Number.isNaN(timestamp)) return value

  return formatter.format(new Date(timestamp))
}

function isExportableLiveSession(session: LiveSessionSummary): boolean {
  return session.status === 'finished'
}

function isDeletableLiveSession(session: LiveSessionSummary): boolean {
  return session.status === 'failed' || session.status === 'finished'
}

function mapLiveStatusToBadgeStatus(status: LiveSessionSummary['status']): TaskStatus {
  if (status === 'active') return 'processing'
  if (status === 'finished') return 'completed'
  return 'failed'
}

function buildRowActionKey(sessionId: string, action: RowAction): string {
  return `${sessionId}:${action}`
}

export function HistoryLiveRecordsView({
  sessions,
  query,
  total,
  isLoading = false,
  errorMessage,
  onSearchChange,
  onStatusChange,
  onSortChange,
  onPageChange,
  onPageSizeChange,
  onRetry,
  onOpenLiveDetail,
  onDeleteLiveSession,
  onExportLiveSession,
  onBatchDeleteLiveSessions,
  onBatchExportLiveSessions,
}: HistoryLiveRecordsViewProps) {
  const { t } = useTranslation()
  const rowActionsRef = useRef<Set<string>>(new Set())
  const runningBatchActionRef = useRef(false)
  const [searchDraft, setSearchDraft] = useHistorySearchDraft(query.q)
  const [runningRowActions, setRunningRowActions] = useState<Set<string>>(() => new Set())
  const [runningBatchAction, setRunningBatchAction] = useState<BatchLiveAction | null>(null)
  const selectionResetToken = `${query.order}|${query.page}|${query.page_size}|${query.q}|${query.sort_by}|${query.status}`
  const tableSelection = useInteractiveTableSelection({
    rows: sessions,
    getRowId: (session) => session.session_id,
    resetToken: selectionResetToken,
  })
  const { onClearSelection: clearSelection } = tableSelection
  const liveExportDialog = useHistoryLiveExportDialog({
    clearSelection,
    onBatchExportLiveSessions,
    onExportLiveSession,
  })
  const timestampFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        month: 'short',
        second: '2-digit',
        year: 'numeric',
      }),
    [],
  )
  const sort = useMemo<InteractiveSortState<LiveHistorySortBy>>(
    () => ({
      direction: query.order,
      key: query.sort_by,
    }),
    [query.order, query.sort_by],
  )

  async function runBatchAction(
    action: BatchLiveAction,
    sessionIds: string[],
    handler?: BatchDeleteLiveHandler,
  ): Promise<void> {
    if (!handler || sessionIds.length === 0 || runningBatchActionRef.current) {
      return
    }

    runningBatchActionRef.current = true
    setRunningBatchAction(action)
    try {
      await handler(sessionIds)
      clearSelection()
    } catch {
      return
    } finally {
      runningBatchActionRef.current = false
      setRunningBatchAction(null)
    }
  }

  function markRowActionRunning(actionKey: string): boolean {
    if (rowActionsRef.current.has(actionKey)) {
      return false
    }

    rowActionsRef.current.add(actionKey)
    setRunningRowActions((previous) => {
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
      const next = new Set(previous)
      next.delete(actionKey)
      return next
    })
  }

  async function runRowAction(
    session: LiveSessionSummary,
    action: RowAction,
    handler?: (session: LiveSessionSummary) => Promise<void>,
  ): Promise<void> {
    if (!handler) {
      return
    }

    const actionKey = buildRowActionKey(session.session_id, action)
    if (!markRowActionRunning(actionKey)) {
      return
    }

    try {
      await handler(session)
    } catch (error: unknown) {
      logger.error('history.liveRowActionFailed', {
        action,
        error,
        sessionId: session.session_id,
      })
    } finally {
      clearRowActionRunning(actionKey)
    }
  }

  const columns: readonly InteractiveTableColumn<LiveSessionSummary, LiveHistorySortBy>[] = [
    {
      cell: (session) => (
        <span className="font-mono text-sm font-semibold tracking-tight">{session.session_id}</span>
      ),
      className: 'min-w-[220px]',
      header: t('history.live.table.columns.sessionId'),
      id: 'sessionId',
    },
    {
      cell: (session) => (
        <span className="block truncate text-sm font-medium">
          {session.title?.trim() || t('history.live.table.titleFallback')}
        </span>
      ),
      className: 'min-w-[240px]',
      header: t('history.live.table.columns.title'),
      id: 'title',
      sortKey: 'title',
    },
    {
      cell: (session) => (
        <StatusBadge
          status={mapLiveStatusToBadgeStatus(session.status)}
          label={t(`history.live.status.${session.status}`)}
        />
      ),
      className: 'min-w-[140px]',
      header: t('history.live.table.columns.status'),
      id: 'status',
      sortKey: 'status',
    },
    {
      cell: (session) => (
        <span className="text-sm">{formatTimestamp(session.started_at, timestampFormatter)}</span>
      ),
      className: 'min-w-[220px]',
      defaultSortDirection: 'desc',
      header: t('history.live.table.columns.started'),
      id: 'started',
      sortKey: 'started_at',
    },
    {
      cell: (session) => (
        <span className="text-sm">{formatTimestamp(session.ended_at, timestampFormatter)}</span>
      ),
      className: 'min-w-[220px]',
      defaultSortDirection: 'desc',
      header: t('history.live.table.columns.ended'),
      id: 'ended',
      sortKey: 'ended_at',
    },
    {
      cell: (session) => {
        const canExport = isExportableLiveSession(session)
        const canDelete = isDeletableLiveSession(session)
        const deleteBusy = runningRowActions.has(buildRowActionKey(session.session_id, 'delete'))
        const rowActions: readonly InteractiveTableRowAction[] = [
          {
            ariaLabel: t('history.live.table.actions.export'),
            hidden: !canExport || !onExportLiveSession,
            icon: <Download />,
            id: 'export',
            label: t('history.live.table.actions.export'),
            run: () => liveExportDialog.openSingleExportDialog(session),
          },
          {
            ariaLabel: t('history.live.table.actions.deleteRecord'),
            disabled: deleteBusy,
            hidden: !canDelete || !onDeleteLiveSession,
            icon: <Trash2 />,
            id: 'delete',
            label: t('history.live.table.actions.deleteRecord'),
            run: () => runRowAction(session, 'delete', onDeleteLiveSession),
            variant: 'destructive',
          },
        ]

        return (
          <div className="flex justify-end">
            <InteractiveTableRowActionsMenu
              actions={rowActions}
              triggerLabel={t('history.live.table.actions.more', {
                sessionId: session.session_id,
              })}
            />
          </div>
        )
      },
      className: 'w-[112px]',
      header: t('history.live.table.columns.actions'),
      headerClassName: 'text-right',
      id: 'actions',
    },
  ]

  const batchActions: readonly InteractiveBatchAction<LiveSessionSummary>[] = [
    {
      disabled: runningBatchAction !== null || !onBatchExportLiveSessions,
      getEligibleRows: (selectedRows) => selectedRows.filter(isExportableLiveSession),
      icon: <Download />,
      id: 'export',
      label: t('history.live.batch.export'),
      run: (selectedRows) => {
        void liveExportDialog.openBatchExportDialog(
          selectedRows.map((session) => session.session_id),
        )
      },
    },
    {
      disabled: runningBatchAction !== null || !onBatchDeleteLiveSessions,
      getEligibleRows: (selectedRows) => selectedRows.filter(isDeletableLiveSession),
      icon: <Trash2 />,
      id: 'delete',
      isRunning: runningBatchAction === 'delete',
      label: t('history.live.batch.delete'),
      run: (selectedRows) =>
        runBatchAction(
          'delete',
          selectedRows.map((session) => session.session_id),
          onBatchDeleteLiveSessions,
        ),
      variant: 'destructive',
    },
  ]

  return (
    <>
      {liveExportDialog.lastSavedPath ? (
        <div className="border-b px-4 py-3">
          <div className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2">
            <span className="text-sm">
              {t('tasks.exportDialog.savedPathLabel', { path: liveExportDialog.lastSavedPath })}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                void liveExportDialog.copySavedPath()
              }}
            >
              {t('tasks.exportDialog.actions.copyPath')}
            </Button>
          </div>
        </div>
      ) : null}

      <InteractiveTable
        data-slot="history-live-records-view"
        columns={columns}
        rows={sessions}
        getRowId={(session) => session.session_id}
        caption={t('history.live.table.caption')}
        sort={sort}
        onSortChange={onSortChange}
        filters={
          <HistoryToolbar
            mode="live"
            searchValue={searchDraft}
            liveStatusValue={query.status}
            isLoading={isLoading}
            showRecordsModeToggle={false}
            onSearchChange={setSearchDraft}
            onSearchSubmit={onSearchChange}
            onLiveStatusChange={onStatusChange}
          />
        }
        selection={{
          ...tableSelection.selection,
          clearSelectionLabel: t('history.selection.clear'),
          getRowLabel: (session) =>
            t('history.live.table.selectRow', { sessionId: session.session_id }),
          selectAllLabel: t('history.live.table.selectAll'),
          selectedRowsLabel: (count) => t('history.live.selection.selectedCount', { count }),
        }}
        batchActions={batchActions}
        isLoading={isLoading}
        errorState={
          errorMessage
            ? {
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
                description: errorMessage,
                title: t('error.generic'),
              }
            : null
        }
        onRowClick={onOpenLiveDetail}
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
            icon={<Radio className="size-6" />}
            title={t('history.live.empty.title')}
            description={t('history.live.empty.description')}
          />
        }
      />

      {liveExportDialog.exportDialog.open ? (
        <Suspense fallback={null}>
          <LazyExportDialog
            open={liveExportDialog.exportDialog.open}
            mode={liveExportDialog.exportDialog.mode}
            taskCount={
              liveExportDialog.exportDialog.mode === 'single'
                ? 1
                : liveExportDialog.exportDialog.sessionIds.length
            }
            defaultFilename={liveExportDialog.singleDefaultFilename}
            value={liveExportDialog.exportValue}
            isLoadingDefaults={liveExportDialog.exportDefaults.isLoading}
            isSubmitting={liveExportDialog.isSubmittingExport}
            isUpdatingDefaults={liveExportDialog.isUpdatingDefaults}
            onChange={liveExportDialog.setExportValue}
            onConfirm={() => {
              void liveExportDialog.confirmExport()
            }}
            onCancel={liveExportDialog.closeExportDialog}
            onResetDefaults={() => {
              void liveExportDialog.resetExportDefaults()
            }}
          />
        </Suspense>
      ) : null}
    </>
  )
}
