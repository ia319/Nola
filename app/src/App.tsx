import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { toast, Toaster } from 'sonner'

import { ErrorBoundary } from '@/components/common'
import { TaskHistoryPanel, useHistoryTasks } from '@/features/history'
import { FileUploader, UploadList, useFileUpload } from '@/features/upload'
import {
  cancelTaskAndRefresh,
  CurrentBatchTasksPanel,
  deleteTaskRecordAndRefresh,
  OptionsBar,
  requestTaskRefresh,
  retryTaskAndRefresh,
  useSessionTasksStore,
  useTaskPolling,
} from '@/features/transcription'
import type { TaskCreateResult } from '@/features/transcription'
import { Button } from '@/components/ui/button'
import { useAppConfig } from '@/config/use-app-config'
import type { TaskSummary } from '@/shared/types'

/**
 * Root application shell.
 *
 * Wire upload and transcription features together with independent
 * ErrorBoundary panels so a crash in one section does not take down the other.
 */
function App() {
  const { t } = useTranslation()
  const { fileValidationConfig } = useAppConfig()
  const addCreatedTask = useSessionTasksStore((state) => state.addCreatedTask)
  const removeSessionTask = useSessionTasksStore((state) => state.removeSessionTask)
  const upsertSessionTask = useSessionTasksStore((state) => state.upsertSessionTask)
  useTaskPolling()
  const historyTasks = useHistoryTasks()

  const {
    uploads,
    addFiles,
    removeFile,
    startUpload,
    cancelUpload,
    retryUpload,
    markTaskCreated,
    reset,
    isUploading,
    availableFileIds,
    batchError,
    clearBatchError,
  } = useFileUpload(fileValidationConfig)

  const hasPending = uploads.some((u) => u.status === 'pending')

  /** Forward selected files to the upload queue for admission and validation. */
  function handleFilesSelected(files: File[]) {
    addFiles(files)
  }

  /** Mark successful task creations and notify via toast. */
  function handleTasksCreated(results: TaskCreateResult[]) {
    let hasNewTask = false

    for (const result of results) {
      if (result.ok && result.fileId && result.taskId) {
        addCreatedTask({
          task_id: result.taskId,
          file_id: result.fileId,
          filename: result.filename,
          status: 'pending',
        })
        hasNewTask = true
        markTaskCreated(result.fileId)
        toast.success(t('options.taskCreated', { taskId: result.taskId }))
        continue
      }

      toast.error(
        result.error?.i18nKey
          ? t(result.error.i18nKey, result.error.params ?? {})
          : t('error.generic'),
      )
    }

    if (hasNewTask) {
      requestTaskRefresh()
    }
  }

  /** Reset all upload state with orphan cleanup. */
  async function handleReset() {
    await reset()
  }

  async function handleCancelRecentTask(task: TaskSummary) {
    try {
      const response = await cancelTaskAndRefresh(task.task_id)
      upsertSessionTask(response.task)
      toast.success(t('tasks.toast.cancelled', { taskId: task.task_id }))
    } catch {
      toast.error(t('tasks.toast.actionFailed'))
    }
  }

  async function handleRetryRecentTask(task: TaskSummary) {
    try {
      const response = await retryTaskAndRefresh({ file_id: task.file_id })
      addCreatedTask({
        task_id: response.task_id,
        file_id: task.file_id,
        filename: response.filename,
        status: 'pending',
      })
      toast.success(t('tasks.toast.retried', { taskId: response.task_id }))
    } catch {
      toast.error(t('tasks.toast.actionFailed'))
    }
  }

  async function handleCancelHistoryTask(task: TaskSummary) {
    try {
      const response = await cancelTaskAndRefresh(task.task_id)
      upsertSessionTask(response.task)
      toast.success(t('tasks.toast.cancelled', { taskId: task.task_id }))
    } catch {
      toast.error(t('tasks.toast.actionFailed'))
    } finally {
      await historyTasks.refresh()
    }
  }

  async function handleRetryHistoryTask(task: TaskSummary) {
    try {
      const response = await retryTaskAndRefresh({ file_id: task.file_id })
      addCreatedTask({
        task_id: response.task_id,
        file_id: task.file_id,
        filename: response.filename,
        status: 'pending',
      })
      toast.success(t('tasks.toast.retried', { taskId: response.task_id }))
    } catch {
      toast.error(t('tasks.toast.actionFailed'))
    } finally {
      await historyTasks.refresh()
    }
  }

  async function handleDeleteHistoryTask(task: TaskSummary) {
    try {
      await deleteTaskRecordAndRefresh(task.task_id)
      removeSessionTask(task.task_id)
      toast.success(t('tasks.toast.recordDeleted', { taskId: task.task_id }))
    } catch {
      toast.error(t('tasks.toast.actionFailed'))
    } finally {
      await historyTasks.refresh()
    }
  }

  // Surface batch-level errors (e.g. duplicate file skip) as toast.
  useEffect(() => {
    if (!batchError) return
    toast.warning(t(batchError.i18nKey, batchError.params ?? {}))
    clearBatchError()
  }, [batchError, clearBatchError, t])

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      {/* Upload panel */}
      <ErrorBoundary>
        <FileUploader onFilesSelected={handleFilesSelected} disabled={isUploading} />

        <UploadList
          uploads={uploads}
          onCancel={cancelUpload}
          onRetry={retryUpload}
          onRemove={removeFile}
        />

        {/* Upload / reset actions */}
        {uploads.length > 0 && (
          <div className="flex gap-2 pt-2">
            {hasPending && (
              <Button onClick={startUpload} disabled={isUploading}>
                {isUploading ? t('upload.progress.uploading') : t('upload.startUpload')}
              </Button>
            )}
            <Button variant="outline" onClick={handleReset} disabled={isUploading}>
              {t('upload.reset')}
            </Button>
          </div>
        )}
      </ErrorBoundary>

      {/* Transcription options panel */}
      <ErrorBoundary>
        <OptionsBar
          fileIds={availableFileIds}
          onTasksCreated={handleTasksCreated}
          disabled={isUploading}
        />
      </ErrorBoundary>

      <ErrorBoundary>
        <CurrentBatchTasksPanel
          onCancelTask={handleCancelRecentTask}
          onRetryTask={handleRetryRecentTask}
        />
      </ErrorBoundary>

      <ErrorBoundary>
        <TaskHistoryPanel
          tasks={historyTasks.tasks}
          query={historyTasks.query}
          total={historyTasks.total}
          isLoading={historyTasks.isLoading}
          errorMessage={
            historyTasks.error
              ? t(historyTasks.error.i18nKey, historyTasks.error.params ?? {})
              : null
          }
          onSearchChange={historyTasks.setSearch}
          onStatusChange={historyTasks.setStatus}
          onSortByChange={historyTasks.setSortBy}
          onOrderChange={historyTasks.setOrder}
          onPageChange={historyTasks.setPage}
          onCancelTask={handleCancelHistoryTask}
          onRetryTask={handleRetryHistoryTask}
          onDeleteTaskRecord={handleDeleteHistoryTask}
        />
      </ErrorBoundary>

      <Toaster />
    </div>
  )
}

export default App
