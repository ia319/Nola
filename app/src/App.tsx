import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ErrorBoundary } from '@/components/common'
import { Button } from '@/components/ui/button'
import { useAppConfig } from '@/config/use-app-config'
import { FileUploader, UploadList, useFileUpload } from '@/features/upload'
import {
  cancelTaskAndRefresh,
  CurrentBatchTasksPanel,
  OptionsBar,
  requestTaskRefresh,
  retryTaskAndRefresh,
  useSessionTasksStore,
} from '@/features/transcription'
import type { TaskCreateResult } from '@/features/transcription'
import type { TaskSummary } from '@/shared/types'

/**
 * Home page composition layer for upload, options, and recent session tasks.
 */
function App() {
  const { t } = useTranslation()
  const { fileValidationConfig } = useAppConfig()
  const addCreatedTask = useSessionTasksStore((state) => state.addCreatedTask)
  const upsertSessionTask = useSessionTasksStore((state) => state.upsertSessionTask)

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

  // Surface batch-level errors (e.g. duplicate file skip) as toast.
  useEffect(() => {
    if (!batchError) return
    toast.warning(t(batchError.i18nKey, batchError.params ?? {}))
    clearBatchError()
  }, [batchError, clearBatchError, t])

  return (
    <div className="space-y-6">
      <ErrorBoundary>
        <FileUploader onFilesSelected={handleFilesSelected} disabled={isUploading} />

        <UploadList
          uploads={uploads}
          onCancel={cancelUpload}
          onRetry={retryUpload}
          onRemove={removeFile}
        />

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
    </div>
  )
}

export default App
