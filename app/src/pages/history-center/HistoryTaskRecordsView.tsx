import { lazy, Suspense, useMemo, useRef, useState } from 'react'
import { Download, FileText, RotateCcw, Trash2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

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
import {
  buildSingleExportFilename,
  type ExportDialogValue,
  type ExportRequestOptions,
  type SingleExportRequestOptions,
  useExportDefaults,
} from '@/features/export'
import {
  isActiveTaskStatus,
  isDeletableTaskRecordStatus,
  isExportableTaskStatus,
  isRetryableTaskStatus,
} from '@/shared/lib/task-status'
import type {
  BatchTaskActionResponse,
  TaskFilterStatus,
  TaskSortBy,
  TaskSummary,
} from '@/shared/types'
import type { HistoryPageSize, HistoryRecordsMode, HistoryTaskQuery } from '@/routes/history-search'
import { HistoryPagination } from './HistoryPagination'
import { HistoryToolbar } from './HistoryToolbar'
import { useHistorySearchDraft } from './hooks/useHistorySearchDraft'

type BatchTaskHandler = (taskIds: string[]) => Promise<void | BatchTaskActionResponse>
type BatchExportHandler = (
  taskIds: string[],
  options: ExportRequestOptions & { zip_name?: string | null },
) => Promise<void>
type RowAction = 'cancel' | 'delete' | 'retry'
type BatchTaskAction = 'cancel' | 'delete' | 'retry'

interface ExportDialogState {
  open: boolean
  mode: 'batch' | 'single'
  task: TaskSummary | null
  taskIds: string[]
}

export interface HistoryTaskRecordsViewProps {
  tasks: TaskSummary[]
  query: HistoryTaskQuery
  total: number
  isLoading?: boolean
  errorMessage?: string | null
  mode?: HistoryRecordsMode
  onSearchChange: (value: string) => void
  onStatusChange: (value: TaskFilterStatus) => void
  onSortChange: (value: InteractiveSortState<TaskSortBy>) => void
  onPageChange: (value: number) => void
  onPageSizeChange: (value: HistoryPageSize) => void
  onModeChange?: (mode: HistoryRecordsMode) => void
  onCreateTask?: () => void
  onRetry?: () => void | Promise<void>
  onOpenTaskDetail?: (task: TaskSummary) => void
  resolveFileName?: (task: TaskSummary) => string | undefined
  onCancelTask?: (task: TaskSummary) => Promise<void>
  onRetryTask?: (task: TaskSummary) => Promise<void>
  onDeleteTaskRecord?: (task: TaskSummary) => Promise<void>
  onExportTask?: (
    task: TaskSummary,
    options: SingleExportRequestOptions,
  ) => Promise<{ mode: 'download' } | { mode: 'save'; savedPath: string }>
  onBatchCancelTasks?: BatchTaskHandler
  onBatchRetryTasks?: BatchTaskHandler
  onBatchExportTasks?: BatchExportHandler
  onBatchDeleteTaskRecords?: BatchTaskHandler
}

const FALLBACK_EXPORT_OPTIONS: ExportRequestOptions = {
  format: 'srt',
  include_timestamps: true,
}
const LazyExportDialog = lazy(async () => {
  const module = await import('@/features/export')
  return { default: module.ExportDialog }
})

function formatDuration(
  createdAt: string,
  completedAt: string | null,
  fallbackLabel: string,
): string {
  if (!completedAt) {
    return fallbackLabel
  }

  const createdTimestamp = Date.parse(createdAt)
  const completedTimestamp = Date.parse(completedAt)
  if (Number.isNaN(createdTimestamp) || Number.isNaN(completedTimestamp)) {
    return fallbackLabel
  }

  const totalTenths = Math.round(Math.max(0, completedTimestamp - createdTimestamp) / 100)
  const totalSeconds = Math.floor(totalTenths / 10)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const tenths = totalTenths % 10
  const secondsLabel = `${String(seconds).padStart(2, '0')}.${tenths}`

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${secondsLabel}`
  }

  return `${String(minutes).padStart(2, '0')}:${secondsLabel}`
}

function createExportDialogValue(defaults: ExportRequestOptions): ExportDialogValue {
  return {
    filename: '',
    format: defaults.format,
    includeTimestamps: defaults.include_timestamps,
    saveAsDefault: false,
    target: 'download',
    zipName: '',
  }
}

function buildRowActionKey(taskId: string, action: RowAction): string {
  return `${taskId}:${action}`
}

export function HistoryTaskRecordsView({
  tasks,
  query,
  total,
  isLoading = false,
  errorMessage,
  mode = 'tasks',
  onSearchChange,
  onStatusChange,
  onSortChange,
  onPageChange,
  onPageSizeChange,
  onModeChange,
  onCreateTask,
  onRetry,
  onOpenTaskDetail,
  resolveFileName,
  onCancelTask,
  onRetryTask,
  onDeleteTaskRecord,
  onExportTask,
  onBatchCancelTasks,
  onBatchRetryTasks,
  onBatchExportTasks,
  onBatchDeleteTaskRecords,
}: HistoryTaskRecordsViewProps) {
  const { t } = useTranslation()
  const exportDefaults = useExportDefaults()
  const rowActionsRef = useRef<Set<string>>(new Set())
  const runningBatchActionRef = useRef(false)
  const [runningRowActions, setRunningRowActions] = useState<Set<string>>(() => new Set())
  const [runningBatchAction, setRunningBatchAction] = useState<BatchTaskAction | null>(null)
  const [searchDraft, setSearchDraft] = useHistorySearchDraft(query.q)
  const [exportDialog, setExportDialog] = useState<ExportDialogState>({
    open: false,
    mode: 'single',
    task: null,
    taskIds: [],
  })
  const [exportValue, setExportValue] = useState<ExportDialogValue>(() =>
    createExportDialogValue(FALLBACK_EXPORT_OPTIONS),
  )
  const [isSubmittingExport, setIsSubmittingExport] = useState(false)
  const [isUpdatingDefaults, setIsUpdatingDefaults] = useState(false)
  const [lastSavedPath, setLastSavedPath] = useState<string | null>(null)

  const selectionResetToken = `${mode}|${query.order}|${query.page}|${query.page_size}|${query.q}|${query.sort_by}|${query.status}`
  const tableSelection = useInteractiveTableSelection({
    rows: tasks,
    getRowId: (task) => task.task_id,
    resetToken: selectionResetToken,
  })
  const { onClearSelection: clearSelection } = tableSelection

  async function runBatchAction(
    action: BatchTaskAction,
    taskIds: string[],
    handler?: BatchTaskHandler,
  ): Promise<void> {
    if (!handler || taskIds.length === 0 || runningBatchActionRef.current) {
      return
    }

    runningBatchActionRef.current = true
    setRunningBatchAction(action)
    try {
      await handler(taskIds)
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
    } catch (error: unknown) {
      logger.error('history.rowActionFailed', {
        action,
        error,
        taskId: task.task_id,
      })
    } finally {
      clearRowActionRunning(actionKey)
    }
  }

  function buildCurrentExportOptions(): ExportRequestOptions {
    return {
      format: exportValue.format,
      include_timestamps: exportValue.includeTimestamps,
    }
  }

  function buildSingleExportOptions(): SingleExportRequestOptions {
    const customFilename = exportValue.filename.trim()
    return {
      ...buildCurrentExportOptions(),
      filename: customFilename || undefined,
      target: exportValue.target,
    }
  }

  async function resolveDialogDefaults(): Promise<ExportRequestOptions | null> {
    if (!exportDefaults.isLoading) {
      return {
        format: exportDefaults.defaults.format,
        include_timestamps: exportDefaults.defaults.include_timestamps,
      }
    }

    try {
      const defaults = await exportDefaults.refresh()
      return {
        format: defaults.format,
        include_timestamps: defaults.include_timestamps,
      }
    } catch {
      toast.error(t('tasks.toast.actionFailed'))
      return null
    }
  }

  async function openSingleExportDialog(task: TaskSummary): Promise<void> {
    if (!onExportTask) {
      return
    }

    const defaults = await resolveDialogDefaults()
    if (!defaults) {
      return
    }

    setExportValue(createExportDialogValue(defaults))
    setExportDialog({
      open: true,
      mode: 'single',
      task,
      taskIds: [task.task_id],
    })
  }

  async function openBatchExportDialog(taskIds: string[]): Promise<void> {
    if (!onBatchExportTasks || taskIds.length === 0) {
      return
    }

    const defaults = await resolveDialogDefaults()
    if (!defaults) {
      return
    }

    setExportValue(createExportDialogValue(defaults))
    setExportDialog({
      open: true,
      mode: 'batch',
      task: null,
      taskIds,
    })
  }

  function closeExportDialog(): void {
    if (isSubmittingExport) {
      return
    }

    setExportDialog((previous) => ({
      ...previous,
      open: false,
    }))
  }

  async function handleConfirmExport(): Promise<void> {
    if (!exportDialog.open) {
      return
    }

    const options = buildCurrentExportOptions()

    setIsSubmittingExport(true)
    try {
      try {
        if (exportDialog.mode === 'single') {
          if (!onExportTask || !exportDialog.task) {
            return
          }

          const result = await onExportTask(exportDialog.task, buildSingleExportOptions())
          if (result.mode === 'save') {
            setLastSavedPath(result.savedPath)
          } else {
            setLastSavedPath(null)
          }
        } else {
          if (!onBatchExportTasks || exportDialog.taskIds.length === 0) {
            return
          }

          await onBatchExportTasks(exportDialog.taskIds, {
            ...options,
            zip_name: exportValue.zipName.trim() || undefined,
          })
          setLastSavedPath(null)
          clearSelection()
        }
      } catch {
        return
      }

      setExportDialog((previous) => ({
        ...previous,
        open: false,
      }))

      if (exportValue.saveAsDefault) {
        try {
          await exportDefaults.updateDefaults(options)
          toast.success(t('tasks.exportDialog.toast.defaultsSaved'))
        } catch {
          toast.error(t('tasks.toast.actionFailed'))
        }
      }
    } finally {
      setIsSubmittingExport(false)
    }
  }

  async function handleResetExportDefaults(): Promise<void> {
    setIsUpdatingDefaults(true)
    try {
      const defaults = await exportDefaults.resetDefaults()
      setExportValue((previous) => ({
        ...previous,
        format: defaults.format,
        includeTimestamps: defaults.include_timestamps,
      }))
      toast.success(t('tasks.exportDialog.toast.defaultsReset'))
    } catch {
      toast.error(t('tasks.toast.actionFailed'))
    } finally {
      setIsUpdatingDefaults(false)
    }
  }

  async function handleCopySavedPath(): Promise<void> {
    if (!lastSavedPath || !navigator.clipboard?.writeText) {
      return
    }

    try {
      await navigator.clipboard.writeText(lastSavedPath)
      toast.success(t('tasks.exportDialog.toast.pathCopied'))
    } catch {
      toast.error(t('tasks.toast.actionFailed'))
    }
  }

  const singleDefaultFilename =
    exportDialog.mode === 'single' && exportDialog.task
      ? buildSingleExportFilename({
          format: exportValue.format,
          taskFilename: exportDialog.task.filename ?? resolveFileName?.(exportDialog.task) ?? null,
          taskId: exportDialog.task.task_id,
        })
      : undefined

  const sort = useMemo<InteractiveSortState<TaskSortBy>>(
    () => ({
      key: query.sort_by,
      direction: query.order,
    }),
    [query.order, query.sort_by],
  )

  const columns: readonly InteractiveTableColumn<TaskSummary, TaskSortBy>[] = [
    {
      id: 'taskId',
      header: t('history.table.columns.taskId'),
      sortKey: 'task_id',
      className: 'min-w-[220px]',
      cell: (task) => {
        return (
          <span className="font-mono text-sm font-semibold tracking-tight">{task.task_id}</span>
        )
      },
    },
    {
      id: 'filename',
      header: t('history.table.columns.filename'),
      sortKey: 'filename',
      className: 'min-w-[280px]',
      cell: (task) => {
        const fileLabel =
          task.filename?.trim() ||
          resolveFileName?.(task)?.trim() ||
          t('history.table.filenameFallback')

        return <span className="block truncate text-sm font-medium">{fileLabel}</span>
      },
    },
    {
      id: 'status',
      header: t('history.table.columns.status'),
      sortKey: 'status',
      className: 'min-w-[140px]',
      cell: (task) => <StatusBadge status={task.status} />,
    },
    {
      id: 'duration',
      header: t('history.table.columns.duration'),
      sortKey: 'duration',
      defaultSortDirection: 'desc',
      className: 'min-w-[140px]',
      cell: (task) => (
        <span className="text-sm">
          {formatDuration(task.created_at, task.completed_at, t('history.table.durationFallback'))}
        </span>
      ),
    },
    {
      id: 'actions',
      header: t('history.table.columns.actions'),
      className: 'w-[152px]',
      headerClassName: 'text-right',
      cell: (task) => {
        const canCancel = isActiveTaskStatus(task.status)
        const canRetry = isRetryableTaskStatus(task.status)
        const canDelete = isDeletableTaskRecordStatus(task.status)
        const canExport = isExportableTaskStatus(task.status)

        const cancelBusy = runningRowActions.has(buildRowActionKey(task.task_id, 'cancel'))
        const retryBusy = runningRowActions.has(buildRowActionKey(task.task_id, 'retry'))
        const deleteBusy = runningRowActions.has(buildRowActionKey(task.task_id, 'delete'))

        const rowActions: readonly InteractiveTableRowAction[] = [
          {
            id: 'export',
            label: t('history.table.actions.export'),
            ariaLabel: t('history.table.actions.export'),
            icon: <Download />,
            hidden: !canExport || !onExportTask,
            run: () => openSingleExportDialog(task),
          },
          {
            id: 'cancel',
            label: t('history.table.actions.cancel'),
            ariaLabel: t('history.table.actions.cancel'),
            icon: <X />,
            hidden: !canCancel || !onCancelTask,
            disabled: cancelBusy,
            run: () => runRowAction(task, 'cancel', onCancelTask),
          },
          {
            id: 'retry',
            label: t('history.table.actions.retry'),
            ariaLabel: t('history.table.actions.retry'),
            icon: <RotateCcw />,
            hidden: !canRetry || !onRetryTask,
            disabled: retryBusy,
            run: () => runRowAction(task, 'retry', onRetryTask),
          },
          {
            id: 'delete',
            label: t('history.table.actions.deleteRecord'),
            ariaLabel: t('history.table.actions.deleteRecord'),
            icon: <Trash2 />,
            hidden: !canDelete || !onDeleteTaskRecord,
            disabled: deleteBusy,
            variant: 'destructive',
            run: () => runRowAction(task, 'delete', onDeleteTaskRecord),
          },
        ]

        return (
          <div className="flex justify-end">
            <InteractiveTableRowActionsMenu
              actions={rowActions}
              triggerLabel={t('history.table.actions.more', { taskId: task.task_id })}
            />
          </div>
        )
      },
    },
  ]

  const batchActions: readonly InteractiveBatchAction<TaskSummary>[] = [
    {
      id: 'cancel',
      label: t('tasks.actions.cancel'),
      icon: <X />,
      getEligibleRows: (selectedRows) =>
        selectedRows.filter((task) => isActiveTaskStatus(task.status)),
      run: (selectedRows) =>
        runBatchAction(
          'cancel',
          selectedRows.map((task) => task.task_id),
          onBatchCancelTasks,
        ),
      disabled: runningBatchAction !== null || !onBatchCancelTasks,
      isRunning: runningBatchAction === 'cancel',
    },
    {
      id: 'retry',
      label: t('tasks.actions.retry'),
      icon: <RotateCcw />,
      getEligibleRows: (selectedRows) =>
        selectedRows.filter((task) => isRetryableTaskStatus(task.status)),
      run: (selectedRows) =>
        runBatchAction(
          'retry',
          selectedRows.map((task) => task.task_id),
          onBatchRetryTasks,
        ),
      disabled: runningBatchAction !== null || !onBatchRetryTasks,
      isRunning: runningBatchAction === 'retry',
    },
    {
      id: 'export',
      label: t('tasks.actions.export'),
      icon: <Download />,
      getEligibleRows: (selectedRows) =>
        selectedRows.filter((task) => isExportableTaskStatus(task.status)),
      run: (selectedRows) => {
        void openBatchExportDialog(selectedRows.map((task) => task.task_id))
      },
      disabled: runningBatchAction !== null || !onBatchExportTasks,
    },
    {
      id: 'delete',
      label: t('tasks.actions.deleteRecord'),
      icon: <Trash2 />,
      getEligibleRows: (selectedRows) =>
        selectedRows.filter((task) => isDeletableTaskRecordStatus(task.status)),
      run: (selectedRows) =>
        runBatchAction(
          'delete',
          selectedRows.map((task) => task.task_id),
          onBatchDeleteTaskRecords,
        ),
      disabled: runningBatchAction !== null || !onBatchDeleteTaskRecords,
      isRunning: runningBatchAction === 'delete',
      variant: 'destructive',
    },
  ]

  return (
    <>
      {lastSavedPath ? (
        <div className="border-b px-4 py-3">
          <div className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2">
            <span className="text-sm">
              {t('tasks.exportDialog.savedPathLabel', { path: lastSavedPath })}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                void handleCopySavedPath()
              }}
            >
              {t('tasks.exportDialog.actions.copyPath')}
            </Button>
          </div>
        </div>
      ) : null}

      <InteractiveTable
        data-slot="history-records-view"
        columns={columns}
        rows={tasks}
        getRowId={(task) => task.task_id}
        caption={t('history.table.caption')}
        sort={sort}
        onSortChange={onSortChange}
        filters={
          <HistoryToolbar
            mode={mode}
            searchValue={searchDraft}
            statusValue={query.status}
            isLoading={isLoading}
            onSearchChange={setSearchDraft}
            onSearchSubmit={onSearchChange}
            onStatusChange={onStatusChange}
            onModeChange={onModeChange}
          />
        }
        selection={{
          ...tableSelection.selection,
          selectAllLabel: t('history.table.selectAll'),
          getRowLabel: (task) => t('history.table.selectRow', { taskId: task.task_id }),
          selectedRowsLabel: (count) => t('history.selection.selectedCount', { count }),
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
        onRowClick={onOpenTaskDetail}
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
            icon={<FileText className="size-6" />}
            title={t('history.empty.title')}
            description={t('history.empty.description')}
            action={
              onCreateTask ? (
                <Button type="button" onClick={onCreateTask}>
                  {t('history.empty.action')}
                </Button>
              ) : null
            }
          />
        }
      />

      {exportDialog.open ? (
        <Suspense fallback={null}>
          <LazyExportDialog
            open={exportDialog.open}
            mode={exportDialog.mode}
            taskCount={exportDialog.mode === 'single' ? 1 : exportDialog.taskIds.length}
            defaultFilename={singleDefaultFilename}
            value={exportValue}
            isLoadingDefaults={exportDefaults.isLoading}
            isSubmitting={isSubmittingExport}
            isUpdatingDefaults={isUpdatingDefaults}
            onChange={setExportValue}
            onConfirm={() => {
              void handleConfirmExport()
            }}
            onCancel={closeExportDialog}
            onResetDefaults={() => {
              void handleResetExportDefaults()
            }}
          />
        </Suspense>
      ) : null}
    </>
  )
}
