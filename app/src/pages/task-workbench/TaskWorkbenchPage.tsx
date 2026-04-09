import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ErrorBoundary } from '@/components/common'
import { Button } from '@/components/ui/button'
import { useAppConfig } from '@/config/use-app-config'
import {
  cancelTaskAndRefresh,
  createTask,
  CurrentBatchTasksPanel,
  requestTaskRefresh,
  retryTaskAndRefresh,
  useSessionTasksStore,
} from '@/features/tasks'
import type { TaskCreateResult } from '@/features/transcription-options'
import { OptionsBar } from '@/features/transcription-options'
import { FileUploader, UploadList, useFileUpload } from '@/features/upload'
import type { TaskSummary } from '@/shared/types'

export function TaskWorkbenchPage() {
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

  const hasPending = uploads.some((upload) => upload.status === 'pending')

  function handleFilesSelected(files: File[]) {
    addFiles(files)
  }

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

  // Surface batch-level errors such as duplicate file skips as toast feedback.
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

        {uploads.length > 0 ? (
          <div className="flex gap-2 pt-2">
            {hasPending ? (
              <Button onClick={startUpload} disabled={isUploading}>
                {isUploading ? t('upload.progress.uploading') : t('upload.startUpload')}
              </Button>
            ) : null}
            <Button variant="outline" onClick={handleReset} disabled={isUploading}>
              {t('upload.reset')}
            </Button>
          </div>
        ) : null}
      </ErrorBoundary>

      <ErrorBoundary>
        <OptionsBar
          fileIds={availableFileIds}
          onCreateTask={createTask}
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
