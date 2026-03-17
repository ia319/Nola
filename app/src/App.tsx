import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { toast, Toaster } from 'sonner'

import { ErrorBoundary } from '@/components/common'
import { FileUploader, UploadList, useFileUpload } from '@/features/upload'
import { OptionsBar } from '@/features/transcription'
import type { TaskCreateResult } from '@/features/transcription'
import { Button } from '@/components/ui/button'
import { useAppConfig } from '@/config/use-app-config'

/**
 * Root application shell.
 *
 * Wire upload and transcription features together with independent
 * ErrorBoundary panels so a crash in one section does not take down the other.
 */
function App() {
  const { t } = useTranslation()
  const { fileValidationConfig } = useAppConfig()

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
    for (const result of results) {
      if (result.ok && result.fileId) {
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
  }

  /** Reset all upload state with orphan cleanup. */
  async function handleReset() {
    await reset()
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

      <Toaster />
    </div>
  )
}

export default App
