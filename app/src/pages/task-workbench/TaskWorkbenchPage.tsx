import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ErrorBoundary } from '@/components/common'
import { MetricCard } from '@/components/ui'
import { useAppConfig } from '@/config/use-app-config'
import {
  cancelTaskAndRefresh,
  createTask,
  requestTaskRefresh,
  useSessionTasksStore,
} from '@/features/tasks'
import type { TaskCreateResult } from '@/features/transcription-options'
import { useFileUpload } from '@/features/upload'
import { ContentCanvas, PageHeader, TwoColumnLayout } from '@/layouts'
import type { TaskSummary } from '@/shared/types'
import { TaskWorkbenchActivityMonitor } from './TaskWorkbenchActivityMonitor'
import { buildTaskWorkbenchSummary } from './task-workbench-summary'
import { TaskWorkbenchSessionConfig } from './TaskWorkbenchSessionConfig'
import { TaskWorkbenchUploadQueue } from './TaskWorkbenchUploadQueue'

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
          <ErrorBoundary>
            <TaskWorkbenchUploadQueue
              uploads={uploads}
              maxFileSize={fileValidationConfig.maxFileSize}
              isUploading={isUploading}
              hasPending={hasPending}
              onFilesSelected={handleFilesSelected}
              onCancelUpload={cancelUpload}
              onRetryUpload={retryUpload}
              onRemoveUpload={removeFile}
              onStartUpload={startUpload}
              onReset={handleReset}
            />
          </ErrorBoundary>
        }
        right={
          <ErrorBoundary>
            <TaskWorkbenchSessionConfig
              fileIds={availableFileIds}
              onCreateTask={createTask}
              onTasksCreated={handleTasksCreated}
              disabled={isUploading}
            />
          </ErrorBoundary>
        }
      />

      <section data-slot="task-workbench-activity">
        <ErrorBoundary>
          <TaskWorkbenchActivityMonitor
            tasks={sessionTasks}
            onCancelTask={handleCancelRecentTask}
          />
        </ErrorBoundary>
      </section>
    </ContentCanvas>
  )
}
