import { useMemo, useRef, useState } from 'react'
import { CheckCircle2, Download, Search, Trash2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  InteractiveTable,
  InteractiveTableFilterBar,
  InteractiveTableRowActionsMenu,
  useInteractiveTableSelection,
  type InteractiveBatchAction,
  type InteractiveSortState,
  type InteractiveTableColumn,
  type InteractiveTableRowAction,
} from '@/components/common'
import {
  Button,
  EmptyState,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatusBadge,
} from '@/components/ui'
import type { DownloadState } from '@/features/models/hooks/useModelDownload'
import {
  formatMegabytes,
  getModelActionState,
  type ModelActionState,
  resolveModelDescription,
} from '@/features/models/lib/model-helpers'
import {
  DEFAULT_MODEL_LIST_STATUS,
  MODEL_LIST_STATUS_OPTIONS,
  type ModelListQuery,
  type ModelListSortBy,
  type ModelListStatusFilter,
} from '@/features/models/lib/model-query-options'

import type { ModelResponse } from '../types'
import { DownloadProgress } from './DownloadProgress'

export interface ModelListProps {
  models: ModelResponse[]
  downloads: Map<string, DownloadState>
  query: ModelListQuery
  errorMessage?: string | null
  isLoading?: boolean
  onSearchChange: (search: string) => void
  onStatusFilterChange: (status: ModelListStatusFilter) => void
  onSortChange: (sort: InteractiveSortState<ModelListSortBy>) => void
  onDownload: (modelId: string) => void | Promise<void>
  onCancel: (modelId: string) => void | Promise<void>
  onDelete: (modelId: string) => void | Promise<void>
  onSelect: (modelId: string) => void | Promise<void>
  onOpenDetail: (modelId: string) => void
  onRetry?: () => void | Promise<void>
}

type ModelTableRow = {
  model: ModelResponse
  downloadState?: DownloadState
  actionState: ModelActionState
}

type ModelBatchActionType = 'download' | 'cancel' | 'delete'

function canDeleteModelRow(row: ModelTableRow): boolean {
  return row.actionState.canDelete && !row.model.is_configured
}

export function ModelList({
  models,
  downloads,
  query,
  errorMessage,
  isLoading = false,
  onSearchChange,
  onStatusFilterChange,
  onSortChange,
  onDownload,
  onCancel,
  onDelete,
  onSelect,
  onOpenDetail,
  onRetry,
}: ModelListProps) {
  const { t } = useTranslation()
  const [runningBatchAction, setRunningBatchAction] = useState<ModelBatchActionType | null>(null)
  const runningBatchActionRef = useRef(false)

  const rows = useMemo<ModelTableRow[]>(() => {
    return models.map((model) => {
      const downloadState = downloads.get(model.model_id)
      return {
        model,
        downloadState,
        actionState: getModelActionState(model, downloadState),
      }
    })
  }, [downloads, models])

  const tableSelection = useInteractiveTableSelection({
    rows,
    getRowId: (row) => row.model.model_id,
    resetToken: `${query.q}|${query.status}|${query.sort_by ?? ''}|${query.order}`,
  })

  const sort = useMemo<InteractiveSortState<ModelListSortBy> | null>(() => {
    if (!query.sort_by) {
      return null
    }

    return {
      key: query.sort_by,
      direction: query.order,
    }
  }, [query.order, query.sort_by])

  async function runBatchAction(
    action: ModelBatchActionType,
    targetRows: readonly ModelTableRow[],
    handler: (modelId: string) => void | Promise<void>,
  ): Promise<void> {
    if (targetRows.length === 0 || runningBatchActionRef.current) {
      return
    }

    runningBatchActionRef.current = true
    setRunningBatchAction(action)
    try {
      for (const row of targetRows) {
        await handler(row.model.model_id)
      }
      tableSelection.onClearSelection()
    } finally {
      runningBatchActionRef.current = false
      setRunningBatchAction(null)
    }
  }

  const batchActions: readonly InteractiveBatchAction<ModelTableRow>[] = [
    {
      id: 'download',
      label: t('models.batchActions.download'),
      icon: <Download />,
      getEligibleRows: (selectedRows) => selectedRows.filter((row) => row.actionState.canDownload),
      run: (selectedRows) => runBatchAction('download', selectedRows, onDownload),
      disabled: runningBatchAction !== null,
      isRunning: runningBatchAction === 'download',
    },
    {
      id: 'cancel',
      label: t('models.batchActions.cancel'),
      icon: <X />,
      getEligibleRows: (selectedRows) =>
        selectedRows.filter((row) => row.actionState.isDownloading),
      run: (selectedRows) => runBatchAction('cancel', selectedRows, onCancel),
      disabled: runningBatchAction !== null,
      isRunning: runningBatchAction === 'cancel',
    },
    {
      id: 'delete',
      label: t('models.batchActions.delete'),
      icon: <Trash2 />,
      getEligibleRows: (selectedRows) => selectedRows.filter(canDeleteModelRow),
      run: (selectedRows) => runBatchAction('delete', selectedRows, onDelete),
      disabled: runningBatchAction !== null,
      isRunning: runningBatchAction === 'delete',
      variant: 'destructive',
    },
  ]

  function buildRowActions(row: ModelTableRow): readonly InteractiveTableRowAction[] {
    const { model, actionState } = row

    return [
      {
        id: 'download',
        label: t('models.actions.download'),
        ariaLabel: t('models.actions.download'),
        icon: <Download />,
        hidden: !actionState.canDownload,
        disabled: runningBatchAction !== null,
        run: () => onDownload(model.model_id),
      },
      {
        id: 'cancel',
        label: t('models.actions.cancel'),
        ariaLabel: t('models.actions.cancel'),
        icon: <X />,
        hidden: !actionState.isDownloading,
        disabled: runningBatchAction !== null,
        run: () => onCancel(model.model_id),
      },
      {
        id: 'select',
        label: t('models.actions.select'),
        ariaLabel: t('models.actions.select'),
        icon: <CheckCircle2 />,
        hidden: !actionState.isDownloaded || model.is_configured,
        disabled: runningBatchAction !== null,
        run: () => onSelect(model.model_id),
      },
      {
        id: 'delete',
        label: t('models.actions.delete'),
        ariaLabel: t('models.actions.delete'),
        icon: <Trash2 />,
        hidden: !actionState.canDelete,
        disabled: model.is_configured || runningBatchAction !== null,
        variant: 'destructive',
        run: () => onDelete(model.model_id),
      },
    ]
  }

  const columns: readonly InteractiveTableColumn<ModelTableRow, ModelListSortBy>[] = [
    {
      id: 'name',
      header: t('models.table.columns.name'),
      sortKey: 'name',
      className: 'min-w-[220px]',
      cell: ({ model }) => (
        <div className="min-w-0 space-y-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="text-foreground truncate font-semibold">{model.name}</span>
            {model.is_configured ? (
              <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-[11px] font-semibold">
                {t('models.configured')}
              </span>
            ) : null}
            {model.is_last_loaded ? (
              <span className="bg-success-container text-on-success-container rounded-full px-2 py-0.5 text-[11px] font-semibold">
                {t('models.lastLoaded')}
              </span>
            ) : null}
          </div>
          <p className="text-muted-foreground line-clamp-2 text-sm leading-6">
            {resolveModelDescription(t, model)}
          </p>
          {model.download_progress ? (
            <p className="text-muted-foreground text-xs">
              {t('models.table.downloadSnapshot', {
                progress: model.download_progress.percent.toFixed(1),
              })}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      id: 'languages',
      header: t('models.table.columns.languages'),
      sortKey: 'languages',
      className: 'min-w-[140px]',
      cell: ({ model }) => (
        <span className="text-sm">{model.languages.trim() || t('models.fields.unavailable')}</span>
      ),
    },
    {
      id: 'size',
      header: t('models.table.columns.size'),
      sortKey: 'size',
      className: 'min-w-[180px]',
      cell: ({ model }) => (
        <div className="space-y-1">
          <p className="font-medium">{formatMegabytes(model.size_bytes)}</p>
          {model.disk_usage != null ? (
            <p className="text-muted-foreground text-xs">
              {t('models.table.diskUsage', {
                value: formatMegabytes(model.disk_usage),
              })}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      id: 'status',
      header: t('models.table.columns.status'),
      sortKey: 'status',
      className: 'min-w-[200px]',
      cell: ({ downloadState, actionState }) => (
        <div className="space-y-2">
          <StatusBadge status={actionState.status} />
          {downloadState ? <DownloadProgress state={downloadState} /> : null}
        </div>
      ),
    },
    {
      id: 'profile',
      header: t('models.table.columns.profile'),
      sortKey: 'profile',
      defaultSortDirection: 'desc',
      className: 'w-[140px]',
      cell: ({ model }) => (
        <span className="text-sm font-medium">
          {t('models.table.profileValue', {
            accuracy: model.accuracy_rank,
            speed: model.speed_rank,
          })}
        </span>
      ),
    },
    {
      id: 'actions',
      header: t('models.table.columns.actions'),
      className: 'w-[190px]',
      headerClassName: 'text-right',
      cell: (row) => (
        <div data-row-click-ignore className="flex items-center justify-end gap-1">
          {row.model.is_configured && row.actionState.canDelete ? (
            <span className="text-muted-foreground inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium">
              {t('models.configured')}
            </span>
          ) : null}
          <InteractiveTableRowActionsMenu
            actions={buildRowActions(row)}
            triggerLabel={t('models.table.rowActions', { name: row.model.name })}
          />
        </div>
      ),
    },
  ]

  return (
    <InteractiveTable
      columns={columns}
      rows={rows}
      getRowId={(row) => row.model.model_id}
      caption={t('models.table.caption')}
      sort={sort}
      onSortChange={onSortChange}
      filters={
        <InteractiveTableFilterBar
          leading={
            <>
              <label className="relative block w-full max-w-md min-w-[220px] flex-1">
                <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                  value={query.q}
                  aria-label={t('models.filters.searchPlaceholder')}
                  placeholder={t('models.filters.searchPlaceholder')}
                  className="bg-background pr-9 pl-9"
                  onChange={(event) => {
                    onSearchChange(event.target.value)
                  }}
                />
                {query.q ? (
                  <button
                    type="button"
                    aria-label={t('models.filters.clearSearch')}
                    className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/40 absolute top-1/2 right-2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
                    onClick={() => {
                      onSearchChange('')
                    }}
                  >
                    <X aria-hidden="true" className="size-4" />
                  </button>
                ) : null}
              </label>

              <Select
                value={query.status}
                onValueChange={(value) => {
                  onStatusFilterChange(value as ModelListStatusFilter)
                }}
              >
                <SelectTrigger className="w-[180px]" aria-label={t('models.filters.status')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODEL_LIST_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option === DEFAULT_MODEL_LIST_STATUS
                        ? t('models.filters.statusAll')
                        : t(`models.status.${option}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          }
        />
      }
      selection={{
        ...tableSelection.selection,
        getRowLabel: (row) => t('models.selection.selectRow', { name: row.model.name }),
        selectAllLabel: t('models.selection.selectAll'),
        selectedRowsLabel: (count) => t('models.selection.selectedCount', { count }),
        clearSelectionLabel: t('models.selection.clear'),
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
      onRowClick={({ model }) => onOpenDetail(model.model_id)}
      stickyHeader
      emptyState={
        <EmptyState
          title={t('models.table.empty.title')}
          description={t('models.table.empty.description')}
        />
      }
    />
  )
}
