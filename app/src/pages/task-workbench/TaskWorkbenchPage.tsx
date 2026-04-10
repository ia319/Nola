import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ErrorBoundary } from '@/components/common'
import { MetricCard } from '@/components/ui'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
import { ContentCanvas, PageHeader, TwoColumnLayout } from '@/layouts'
import { formatFileSize } from '@/shared/lib/format'
import type { TaskSummary } from '@/shared/types'
import { buildTaskWorkbenchSummary } from './task-workbench-summary'

export function TaskWorkbenchPage() {
  const { t } = useTranslation()
  const { fileValidationConfig } = useAppConfig()
  const addCreatedTask = useSessionTasksStore((state) => state.addCreatedTask)
  const sessionTaskOrder = useSessionTasksStore((state) => state.order)
  const sessionTaskById = useSessionTasksStore((state) => state.byId)
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
  const sessionTasks = useMemo(() => {
    return sessionTaskOrder
      .map((taskId) => sessionTaskById[taskId])
      .filter((task): task is TaskSummary => Boolean(task))
  }, [sessionTaskById, sessionTaskOrder])

  const summary = useMemo(
    () => buildTaskWorkbenchSummary(uploads, sessionTasks),
    [sessionTasks, uploads],
  )

  const summaryCards = useMemo(() => {
    return [
      {
        key: 'uploaded',
        title: t('tasks.workbench.summary.uploaded.title'),
        value: summary.uploaded,
        description: t('tasks.workbench.summary.uploaded.description'),
      },
      {
        key: 'ready',
        title: t('tasks.workbench.summary.ready.title'),
        value: summary.ready,
        description: t('tasks.workbench.summary.ready.description'),
      },
      {
        key: 'processing',
        title: t('tasks.workbench.summary.processing.title'),
        value: summary.processing,
        description: t('tasks.workbench.summary.processing.description'),
      },
      {
        key: 'completed',
        title: t('tasks.workbench.summary.completed.title'),
        value: summary.completed,
        description: t('tasks.workbench.summary.completed.description'),
      },
    ]
  }, [summary, t])

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
    <ContentCanvas as="main" data-slot="task-workbench-page" className="gap-6">
      <PageHeader title={t('shell.navigation.tasks')} />

      <section
        data-slot="task-workbench-summary"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {summaryCards.map((card) => (
          <MetricCard
            key={card.key}
            title={card.title}
            value={card.value}
            description={card.description}
            className="gap-3 py-5"
          />
        ))}
      </section>

      <TwoColumnLayout
        left={
          <section data-slot="task-workbench-upload-queue" className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <h2 className="text-foreground text-lg font-semibold tracking-tight">
                  {t('tasks.workbench.sections.uploadQueue.title')}
                </h2>
                <p className="text-muted-foreground text-sm leading-6">
                  {t('tasks.workbench.sections.uploadQueue.description')}
                </p>
              </div>
              <p className="text-muted-foreground text-xs">
                {t('tasks.workbench.sections.uploadQueue.maxFileSize', {
                  maxSize: formatFileSize(fileValidationConfig.maxFileSize),
                })}
              </p>
            </div>

            <Card className="gap-0 py-0">
              <CardContent className="space-y-4 px-5 py-5">
                <ErrorBoundary>
                  <FileUploader onFilesSelected={handleFilesSelected} disabled={isUploading} />

                  <UploadList
                    uploads={uploads}
                    onCancel={cancelUpload}
                    onRetry={retryUpload}
                    onRemove={removeFile}
                  />

                  {uploads.length > 0 ? (
                    <div className="flex flex-wrap gap-2 pt-2">
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
              </CardContent>
            </Card>
          </section>
        }
        right={
          <section data-slot="task-workbench-session-config" className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-foreground text-lg font-semibold tracking-tight">
                {t('tasks.workbench.sections.sessionConfig.title')}
              </h2>
              <p className="text-muted-foreground text-sm leading-6">
                {t('tasks.workbench.sections.sessionConfig.description')}
              </p>
            </div>

            <Card className="gap-0 py-0">
              <CardContent className="px-5 py-5">
                <ErrorBoundary>
                  <OptionsBar
                    fileIds={availableFileIds}
                    onCreateTask={createTask}
                    onTasksCreated={handleTasksCreated}
                    disabled={isUploading}
                  />
                </ErrorBoundary>
              </CardContent>
            </Card>
          </section>
        }
      />

      <section data-slot="task-workbench-activity">
        <ErrorBoundary>
          <CurrentBatchTasksPanel
            title={t('tasks.workbench.sections.activity.title')}
            description={t('tasks.workbench.sections.activity.description')}
            emptyText={t('tasks.workbench.sections.activity.empty')}
            onCancelTask={handleCancelRecentTask}
            onRetryTask={handleRetryRecentTask}
          />
        </ErrorBoundary>
      </section>
    </ContentCanvas>
  )
}
