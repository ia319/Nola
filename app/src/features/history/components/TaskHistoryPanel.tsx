import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ListToolbar, TaskListPanel } from '@/components/common'
import type { TaskActionHandler } from '@/components/common'
import { Button } from '@/components/ui/button'
import {
  ExportDialog,
  buildSingleExportFilename,
  type ExportDialogValue,
  useExportDefaults,
} from '@/features/export'
import type { ExportRequestOptions, SingleExportRequestOptions } from '@/features/export'
import type { TaskFilterStatus, TaskQueryModel, TaskSortBy, TaskSummary } from '@/shared/types'

export interface TaskHistoryPanelProps {
  tasks: TaskSummary[]
  query: TaskQueryModel
  total: number
  isLoading?: boolean
  errorMessage?: string | null
  onSearchChange: (value: string) => void
  onStatusChange: (value: TaskFilterStatus) => void
  onSortByChange: (value: TaskSortBy) => void
  onOrderChange: (value: TaskQueryModel['order']) => void
  onPageChange: (value: number) => void
  resolveFileName?: (task: TaskSummary) => string | undefined
  onCancelTask?: TaskActionHandler
  onRetryTask?: TaskActionHandler
  onDeleteTaskRecord?: TaskActionHandler
  onExportTask?: (
    task: TaskSummary,
    options: SingleExportRequestOptions,
  ) => Promise<{ mode: 'download' } | { mode: 'save'; savedPath: string }>
  onBatchCancelTasks?: (taskIds: string[]) => Promise<unknown>
  onBatchRetryTasks?: (taskIds: string[]) => Promise<unknown>
  onBatchExportTasks?: (
    taskIds: string[],
    options: ExportRequestOptions & { zip_name?: string | null },
  ) => Promise<unknown>
}

interface ExportDialogState {
  open: boolean
  mode: 'single' | 'batch'
  task: TaskSummary | null
  taskIds: string[]
}

const FALLBACK_EXPORT_OPTIONS: ExportRequestOptions = {
  format: 'srt',
  include_timestamps: true,
}

function createExportDialogValue(defaults: ExportRequestOptions): ExportDialogValue {
  return {
    format: defaults.format,
    includeTimestamps: defaults.include_timestamps,
    target: 'download',
    filename: '',
    zipName: '',
    saveAsDefault: false,
  }
}

/**
 * Keep history list presentation reusable across route, modal, and drawer containers.
 *
 * @param tasks History tasks for current query/page.
 * @param query Current query model for search/filter/sort/pagination controls.
 * @param total Total matched task count from backend pagination.
 * @param isLoading Whether current history query is in-flight.
 * @param errorMessage Optional query error message rendered above the list.
 * @param onSearchChange Query search-text handler.
 * @param onStatusChange Query status-filter handler.
 * @param onSortByChange Query sort-field handler.
 * @param onOrderChange Query order handler.
 * @param onPageChange Query page-change handler.
 * @param resolveFileName Optional file-name resolver for display labels.
 * @param onCancelTask Optional cancel action callback.
 * @param onRetryTask Optional retry action callback.
 * @param onDeleteTaskRecord Optional delete-record action callback.
 * @param onExportTask Optional single-task export action callback.
 * @param onBatchCancelTasks Optional batch cancel action callback.
 * @param onBatchRetryTasks Optional batch retry action callback.
 * @param onBatchExportTasks Optional batch export action callback.
 * @returns History task panel.
 */
export function TaskHistoryPanel({
  tasks,
  query,
  total,
  isLoading = false,
  errorMessage,
  onSearchChange,
  onStatusChange,
  onSortByChange,
  onOrderChange,
  onPageChange,
  resolveFileName,
  onCancelTask,
  onRetryTask,
  onDeleteTaskRecord,
  onExportTask,
  onBatchCancelTasks,
  onBatchRetryTasks,
  onBatchExportTasks,
}: TaskHistoryPanelProps) {
  const { t } = useTranslation()
  const exportDefaults = useExportDefaults()
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([])
  const [runningBatchAction, setRunningBatchAction] = useState<'cancel' | 'retry' | null>(null)
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
    setSelectedTaskIds([])
  }, [query.order, query.page, query.q, query.sort_by, query.status])

  const tasksById = useMemo(() => {
    return Object.fromEntries(tasks.map((task) => [task.task_id, task]))
  }, [tasks])

  const selectedTaskIdSet = useMemo(() => {
    return new Set(selectedTaskIds)
  }, [selectedTaskIds])

  const currentPageTaskIds = useMemo(() => {
    return tasks.map((task) => task.task_id)
  }, [tasks])

  const allCurrentPageSelected =
    currentPageTaskIds.length > 0 &&
    currentPageTaskIds.every((taskId) => selectedTaskIdSet.has(taskId))

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

  function handleToggleTask(taskId: string, checked: boolean): void {
    setSelectedTaskIds((previous) => {
      if (checked) {
        if (previous.includes(taskId)) {
          return previous
        }
        return [...previous, taskId]
      }
      return previous.filter((value) => value !== taskId)
    })
  }

  function handleToggleCurrentPage(): void {
    setSelectedTaskIds((previous) => {
      if (allCurrentPageSelected) {
        return previous.filter((taskId) => !currentPageTaskIds.includes(taskId))
      }

      const next = new Set(previous)
      for (const taskId of currentPageTaskIds) {
        next.add(taskId)
      }
      return Array.from(next)
    })
  }

  async function runBatchAction(
    action: 'cancel' | 'retry',
    taskIds: string[],
    handler?: (taskIds: string[]) => Promise<unknown>,
  ): Promise<void> {
    if (!handler || taskIds.length === 0 || runningBatchAction) {
      return
    }

    setRunningBatchAction(action)
    try {
      await handler(taskIds)
      setSelectedTaskIds([])
    } finally {
      setRunningBatchAction(null)
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
      target: exportValue.target,
      filename: customFilename || undefined,
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
          setSelectedTaskIds([])
        }
      } catch {
        // Keep dialog open so users can retry after export action failure.
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
          taskId: exportDialog.task.task_id,
          taskFilename: exportDialog.task.filename,
        })
      : undefined

  return (
    <>
      <TaskListPanel
        title={t('tasks.history.title')}
        description={t('tasks.history.description')}
        emptyText={t('tasks.history.empty')}
        tasks={tasks}
        toolbar={
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed p-2">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleToggleCurrentPage}
                  disabled={currentPageTaskIds.length === 0 || Boolean(runningBatchAction)}
                >
                  {allCurrentPageSelected
                    ? t('tasks.history.selection.clearCurrentPage')
                    : t('tasks.history.selection.selectCurrentPage')}
                </Button>
                <span className="text-muted-foreground text-xs">
                  {t('tasks.history.selection.selectedCount', { count: selectedTaskIds.length })}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
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
                  {runningBatchAction === 'cancel'
                    ? t('tasks.actions.cancelling')
                    : t('tasks.history.batchActions.cancel', { count: cancellableTaskIds.length })}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={
                    runningBatchAction !== null ||
                    retryableTaskIds.length === 0 ||
                    !onBatchRetryTasks
                  }
                  onClick={() => {
                    void runBatchAction('retry', retryableTaskIds, onBatchRetryTasks)
                  }}
                >
                  {runningBatchAction === 'retry'
                    ? t('tasks.actions.retrying')
                    : t('tasks.history.batchActions.retry', { count: retryableTaskIds.length })}
                </Button>
                <Button
                  type="button"
                  size="sm"
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
                  {t('tasks.history.batchActions.export', { count: exportableTaskIds.length })}
                </Button>
              </div>
            </div>
            <ListToolbar
              searchValue={query.q}
              statusValue={query.status}
              sortByValue={query.sort_by}
              orderValue={query.order}
              onSearchChange={onSearchChange}
              onStatusChange={onStatusChange}
              onSortByChange={onSortByChange}
              onOrderChange={onOrderChange}
            />
            {lastSavedPath ? (
              <div className="flex flex-wrap items-center gap-2 rounded-md border p-2">
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
            ) : null}
            {errorMessage ? <p className="text-destructive text-xs">{errorMessage}</p> : null}
          </div>
        }
        pagination={{
          page: query.page,
          pageSize: query.page_size,
          total,
          isLoading,
          onPageChange,
        }}
        resolveFileName={resolveFileName}
        selection={{
          selectedTaskIds,
          onToggleTask: handleToggleTask,
        }}
        onCancelTask={onCancelTask}
        onRetryTask={onRetryTask}
        onDeleteTaskRecord={onDeleteTaskRecord}
        onExportTask={
          onExportTask
            ? async (task) => {
                await openSingleExportDialog(task)
              }
            : undefined
        }
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
    </>
  )
}
