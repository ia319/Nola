import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { Download, FileText, RotateCcw, SquareSlash, Trash2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import logger from '@/config/logger'
import { Button } from '@/components/ui/button'
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable'
import { EmptyState } from '@/components/ui/EmptyState'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { StatusBadge } from '@/components/ui/StatusBadge'
import {
  ExportDialog,
  buildSingleExportFilename,
  type ExportDialogValue,
  type ExportRequestOptions,
  type SingleExportRequestOptions,
  useExportDefaults,
} from '@/features/export'
import { useTaskSelection } from '@/features/tasks'
import type {
  BatchTaskActionResponse,
  SortOrder,
  TaskFilterStatus,
  TaskQueryModel,
  TaskSortBy,
  TaskSummary,
} from '@/shared/types'
import type { HistoryPageSize, HistoryRecordsMode } from '@/routes/history-search'
import { HistoryPagination } from './HistoryPagination'
import { HistoryToolbar } from './HistoryToolbar'

type BatchTaskHandler = (taskIds: string[]) => Promise<void | BatchTaskActionResponse>
type BatchExportHandler = (
  taskIds: string[],
  options: ExportRequestOptions & { zip_name?: string | null },
) => Promise<void>
type RowAction = 'cancel' | 'delete' | 'retry'

interface ExportDialogState {
  open: boolean
  mode: 'batch' | 'single'
  task: TaskSummary | null
  taskIds: string[]
}

export interface HistoryTaskRecordsViewProps {
  tasks: TaskSummary[]
  query: TaskQueryModel
  total: number
  isLoading?: boolean
  errorMessage?: string | null
  mode?: HistoryRecordsMode
  onSearchChange: (value: string) => void
  onStatusChange: (value: TaskFilterStatus) => void
  onSortByChange: (value: TaskSortBy) => void
  onOrderChange: (value: SortOrder) => void
  onPageChange: (value: number) => void
  onPageSizeChange: (value: HistoryPageSize) => void
  onModeChange?: (mode: HistoryRecordsMode) => void
  onCreateTask?: () => void
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
}

const FALLBACK_EXPORT_OPTIONS: ExportRequestOptions = {
  format: 'srt',
  include_timestamps: true,
}

function clampProgress(progress: number): number {
  if (!Number.isFinite(progress)) return 0
  if (progress <= 0) return 0
  if (progress >= 100) return 100
  return progress
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

function formatTimestamp(value: string | null, fallback: ReactNode): ReactNode {
  if (!value) return fallback
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

export function HistoryTaskRecordsView({
  tasks,
  query,
  total,
  isLoading = false,
  errorMessage,
  mode = 'tasks',
  onSearchChange,
  onStatusChange,
  onSortByChange,
  onOrderChange,
  onPageChange,
  onPageSizeChange,
  onModeChange,
  onCreateTask,
  resolveFileName,
  onCancelTask,
  onRetryTask,
  onDeleteTaskRecord,
  onExportTask,
  onBatchCancelTasks,
  onBatchRetryTasks,
  onBatchExportTasks,
}: HistoryTaskRecordsViewProps) {
  const { t } = useTranslation()
  const exportDefaults = useExportDefaults()
  const rowActionsRef = useRef<Set<string>>(new Set())
  const runningBatchActionRef = useRef(false)
  const [runningRowActions, setRunningRowActions] = useState<Set<string>>(() => new Set())
  const [runningBatchAction, setRunningBatchAction] = useState<'cancel' | 'retry' | null>(null)
  const [searchDraft, setSearchDraft] = useState(query.q)
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

  useEffect(() => {
    setSearchDraft(query.q)
  }, [query.q])

  const selectionResetToken = `${mode}|${query.order}|${query.page}|${query.page_size}|${query.q}|${query.sort_by}|${query.status}`
  const { clearSelection, selectedTaskIds, toggleCurrentPage, toggleTask } = useTaskSelection(
    tasks,
    {
      resetToken: selectionResetToken,
    },
  )

  const tasksById = useMemo(() => {
    return Object.fromEntries(tasks.map((task) => [task.task_id, task]))
  }, [tasks])

  const cancellableTaskIds = selectedTaskIds.filter((taskId) => {
    const task = tasksById[taskId]
    return task?.status === 'pending' || task?.status === 'processing'
  })

  const retryableTaskIds = selectedTaskIds.filter((taskId) => {
    const task = tasksById[taskId]
    return task?.status === 'failed' || task?.status === 'cancelled'
  })

  const exportableTaskIds = selectedTaskIds.filter((taskId) => {
    const task = tasksById[taskId]
    return task?.status === 'completed'
  })

  async function runBatchAction(
    action: 'cancel' | 'retry',
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
          }
        } else {
          if (!onBatchExportTasks || exportDialog.taskIds.length === 0) {
            return
          }

          await onBatchExportTasks(exportDialog.taskIds, {
            ...options,
            zip_name: exportValue.zipName.trim() || undefined,
          })
          clearSelection()
        }
      } catch {
        return
      }

      if (exportValue.saveAsDefault) {
        try {
          await exportDefaults.updateDefaults(options)
          toast.success(t('tasks.exportDialog.toast.defaultsSaved'))
        } catch {
          toast.error(t('tasks.toast.actionFailed'))
        }
      }

      setExportDialog((previous) => ({
        ...previous,
        open: false,
      }))
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

  const columns: readonly DataTableColumn<TaskSummary>[] = [
    {
      key: 'identity',
      header: t('history.table.columns.identity'),
      className: 'min-w-[240px]',
      cell: (task) => {
        const fileLabel =
          task.filename?.trim() ||
          resolveFileName?.(task)?.trim() ||
          t('history.table.filenameFallback')

        return (
          <div className="min-w-0 space-y-1">
            <p className="font-mono text-sm font-semibold tracking-tight">{task.task_id}</p>
            <p className="text-muted-foreground truncate text-[11px] font-medium tracking-[0.14em] uppercase">
              {fileLabel}
            </p>
          </div>
        )
      },
    },
    {
      key: 'model',
      header: t('history.table.columns.model'),
      className: 'min-w-[160px]',
      cell: (task) => (
        <span className="text-sm font-medium">
          {task.model_id ?? t('history.table.modelFallback')}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('history.table.columns.status'),
      className: 'min-w-[140px]',
      cell: (task) => <StatusBadge status={task.status} />,
    },
    {
      key: 'progress',
      header: t('history.table.columns.progress'),
      className: 'min-w-[220px]',
      cell: (task) => (
        <div className="space-y-2">
          <ProgressBar percent={clampProgress(task.progress)} showValue={false} />
          <p className="text-muted-foreground text-xs">
            {t(`history.table.progressNotes.${task.status}`)}
          </p>
        </div>
      ),
    },
    {
      key: 'executionDate',
      header: t('history.table.columns.executionDate'),
      className: 'min-w-[220px]',
      cell: (task) => (
        <div className="space-y-1 text-xs">
          <div className="flex items-start gap-2">
            <span className="text-muted-foreground w-8 font-semibold tracking-[0.14em] uppercase">
              {t('history.table.execution.created')}
            </span>
            <span>{formatTimestamp(task.created_at, '—')}</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-muted-foreground w-8 font-semibold tracking-[0.14em] uppercase">
              {t('history.table.execution.completed')}
            </span>
            <span>
              {formatTimestamp(task.completed_at, t('history.table.execution.inProgress'))}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'actions',
      header: t('history.table.columns.actions'),
      className: 'w-[152px]',
      headerClassName: 'text-right',
      cell: (task) => {
        const canCancel = task.status === 'pending' || task.status === 'processing'
        const canRetry = task.status === 'failed' || task.status === 'cancelled'
        const canDelete =
          task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled'
        const canExport = task.status === 'completed'

        const cancelBusy = runningRowActions.has(buildRowActionKey(task.task_id, 'cancel'))
        const retryBusy = runningRowActions.has(buildRowActionKey(task.task_id, 'retry'))
        const deleteBusy = runningRowActions.has(buildRowActionKey(task.task_id, 'delete'))

        return (
          <div className="flex flex-wrap items-center justify-end gap-1">
            {canExport && onExportTask ? (
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                aria-label={t('history.table.actions.export')}
                onClick={() => {
                  void openSingleExportDialog(task)
                }}
              >
                <Download />
              </Button>
            ) : null}

            {canCancel && onCancelTask ? (
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                aria-label={t('history.table.actions.cancel')}
                disabled={cancelBusy}
                onClick={() => {
                  void runRowAction(task, 'cancel', onCancelTask)
                }}
              >
                <SquareSlash />
              </Button>
            ) : null}

            {canRetry && onRetryTask ? (
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                aria-label={t('history.table.actions.retry')}
                disabled={retryBusy}
                onClick={() => {
                  void runRowAction(task, 'retry', onRetryTask)
                }}
              >
                <RotateCcw />
              </Button>
            ) : null}

            {canDelete && onDeleteTaskRecord ? (
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                aria-label={t('history.table.actions.deleteRecord')}
                disabled={deleteBusy}
                onClick={() => {
                  void runRowAction(task, 'delete', onDeleteTaskRecord)
                }}
              >
                <Trash2 />
              </Button>
            ) : null}
          </div>
        )
      },
    },
  ]

  return (
    <section
      data-slot="history-records-view"
      className="bg-card flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border shadow-sm"
    >
      <HistoryToolbar
        mode={mode}
        searchValue={searchDraft}
        statusValue={query.status}
        sortByValue={query.sort_by}
        orderValue={query.order}
        isLoading={isLoading}
        canExportSelection={exportableTaskIds.length > 0}
        onSearchChange={setSearchDraft}
        onSearchSubmit={onSearchChange}
        onStatusChange={onStatusChange}
        onSortByChange={onSortByChange}
        onOrderChange={onOrderChange}
        onExportSelection={() => {
          void openBatchExportDialog(exportableTaskIds)
        }}
        onModeChange={onModeChange}
      />

      {selectedTaskIds.length > 0 ? (
        <div
          data-slot="history-selection-bar"
          className="bg-surface-container flex flex-col gap-3 border-b px-4 py-3 lg:flex-row lg:items-center lg:justify-between"
        >
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold tracking-[0.18em] uppercase">
              {t('history.selection.selectedCount', { count: selectedTaskIds.length })}
            </span>
            <div className="bg-border hidden h-4 w-px lg:block" />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="xs"
                variant="outline"
                disabled={
                  runningBatchAction !== null ||
                  cancellableTaskIds.length === 0 ||
                  !onBatchCancelTasks
                }
                onClick={() => {
                  void runBatchAction('cancel', cancellableTaskIds, onBatchCancelTasks)
                }}
              >
                <SquareSlash />
                {t('tasks.history.batchActions.cancel', { count: cancellableTaskIds.length })}
              </Button>
              <Button
                type="button"
                size="xs"
                variant="outline"
                disabled={
                  runningBatchAction !== null || retryableTaskIds.length === 0 || !onBatchRetryTasks
                }
                onClick={() => {
                  void runBatchAction('retry', retryableTaskIds, onBatchRetryTasks)
                }}
              >
                <RotateCcw />
                {t('tasks.history.batchActions.retry', { count: retryableTaskIds.length })}
              </Button>
              <Button
                type="button"
                size="xs"
                variant="outline"
                disabled={
                  runningBatchAction !== null ||
                  exportableTaskIds.length === 0 ||
                  !onBatchExportTasks
                }
                onClick={() => {
                  void openBatchExportDialog(exportableTaskIds)
                }}
              >
                <Download />
                {t('tasks.history.batchActions.export', { count: exportableTaskIds.length })}
              </Button>
            </div>
          </div>

          <Button type="button" size="icon-xs" variant="ghost" onClick={clearSelection}>
            <X />
          </Button>
        </div>
      ) : null}

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

      {errorMessage ? (
        <div className="border-b px-4 py-3">
          <p className="text-destructive text-sm">{errorMessage}</p>
        </div>
      ) : null}

      <DataTable
        className="rounded-none border-0 shadow-none"
        columns={columns}
        rows={tasks}
        getRowId={(task) => task.task_id}
        caption={t('history.table.caption')}
        scrollAreaClassName="max-h-[56vh] overflow-auto"
        stickyHeader
        selection={{
          selectedRowIds: selectedTaskIds,
          selectAllLabel: t('history.table.selectAll'),
          getRowLabel: (task) => t('history.table.selectRow', { taskId: task.task_id }),
          onToggleRow: (rowId, checked) => {
            toggleTask(rowId, checked)
          },
          onToggleAllRows: () => {
            toggleCurrentPage()
          },
        }}
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

      <HistoryPagination
        page={query.page}
        pageSize={query.page_size as HistoryPageSize}
        total={total}
        isLoading={isLoading}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />

      <ExportDialog
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
    </section>
  )
}
