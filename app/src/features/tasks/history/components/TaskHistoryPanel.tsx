import { useEffect, useMemo, useRef, useState } from 'react'
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
import { TaskBatchActionBar } from '@/features/tasks/components/TaskBatchActionBar'
import { useTaskSelection } from '@/features/tasks/hooks/useTaskSelection'
import type { ExportRequestOptions, SingleExportRequestOptions } from '@/features/export'
import type {
  BatchTaskActionResponse,
  TaskFilterStatus,
  TaskQueryModel,
  TaskSortBy,
  TaskSummary,
} from '@/shared/types'

type BatchTaskHandler = (taskIds: string[]) => Promise<void | BatchTaskActionResponse>
type BatchExportHandler = (
  taskIds: string[],
  options: ExportRequestOptions & { zip_name?: string | null },
) => Promise<void>

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
  onBatchCancelTasks?: BatchTaskHandler
  onBatchRetryTasks?: BatchTaskHandler
  onBatchExportTasks?: BatchExportHandler
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
  const [runningBatchAction, setRunningBatchAction] = useState<'cancel' | 'retry' | null>(null)
  const runningBatchActionRef = useRef(false)
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
  const [searchDraft, setSearchDraft] = useState(query.q)

  useEffect(() => {
    // Keep input draft aligned when search state is changed externally via URL navigation.
    setSearchDraft(query.q)
  }, [query.q])

  const selectionResetToken = `${query.order}|${query.page}|${query.q}|${query.sort_by}|${query.status}`
  const { selectedTaskIds, allCurrentPageSelected, toggleTask, toggleCurrentPage, clearSelection } =
    useTaskSelection(tasks, {
      resetToken: selectionResetToken,
    })

  const tasksById = useMemo(() => {
    return Object.fromEntries(tasks.map((task) => [task.task_id, task]))
  }, [tasks])

  const currentPageTaskIds = useMemo(() => {
    return tasks.map((task) => task.task_id)
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

    // Block duplicate submissions in the same tick before state-driven disable is rendered.
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
          clearSelection()
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
          taskFilename: exportDialog.task.filename ?? resolveFileName?.(exportDialog.task) ?? null,
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
            <TaskBatchActionBar
              scope="history"
              allCurrentPageSelected={allCurrentPageSelected}
              selectedCount={selectedTaskIds.length}
              hasCurrentPageTasks={currentPageTaskIds.length > 0}
              runningBatchAction={runningBatchAction}
              cancellableCount={cancellableTaskIds.length}
              retryableCount={retryableTaskIds.length}
              exportableCount={exportableTaskIds.length}
              onToggleCurrentPage={toggleCurrentPage}
              onBatchCancel={
                onBatchCancelTasks
                  ? () => {
                      void runBatchAction('cancel', cancellableTaskIds, onBatchCancelTasks)
                    }
                  : undefined
              }
              onBatchRetry={
                onBatchRetryTasks
                  ? () => {
                      void runBatchAction('retry', retryableTaskIds, onBatchRetryTasks)
                    }
                  : undefined
              }
              onBatchExport={
                onBatchExportTasks
                  ? () => {
                      void openBatchExportDialog(exportableTaskIds)
                    }
                  : undefined
              }
            />
            <ListToolbar
              searchValue={searchDraft}
              statusValue={query.status}
              sortByValue={query.sort_by}
              orderValue={query.order}
              onSearchChange={setSearchDraft}
              onSearchSubmit={onSearchChange}
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
          onToggleTask: toggleTask,
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
