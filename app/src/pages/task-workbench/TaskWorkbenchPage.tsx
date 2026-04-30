import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ErrorBoundary } from '@/components/common'
import { MetricCard } from '@/components/ui'
import logger from '@/config/logger'
import { useAppConfig } from '@/config/use-app-config'
import {
  batchCancelTasks,
  batchRetryTasks,
  cancelTaskAndRefresh,
  createTask,
  CurrentBatchTasksPanel,
  deleteTaskRecordAction,
  requestTaskRefresh,
  TaskDetailSheet,
  type TaskDetailSheetAction,
  useTaskDetail,
  useTaskDetailSheet,
  useSessionTasksStore,
} from '@/features/tasks'
import type { TaskCreateResult } from '@/features/transcription-options'
import { selectAvailableFileIds, useFileUpload, type UploadItem } from '@/features/upload'
import { ContentCanvas, TwoColumnLayout } from '@/layouts'
import { queryClient } from '@/shared/lib/query-client'
import { queryKeys } from '@/shared/lib/query-keys'
import {
  isActiveTaskStatus,
  isDeletableTaskRecordStatus,
  isRetryableTaskStatus,
} from '@/shared/lib/task-status'
import type { AppError, BatchTaskActionResponse, TaskSummary } from '@/shared/types'
import { buildTaskWorkbenchSummary } from './task-workbench-summary'
import { TaskWorkbenchSessionConfig } from './TaskWorkbenchSessionConfig'
import { TaskWorkbenchUploadQueue } from './TaskWorkbenchUploadQueue'

type WorkbenchTaskDetailAction = 'cancel' | 'delete' | 'retry'

function normalizeTaskIds(taskIds: string[]): string[] {
  return Array.from(new Set(taskIds.map((taskId) => taskId.trim()).filter(Boolean)))
}

function buildEmptyBatchResponse(
  action: BatchTaskActionResponse['action'],
): BatchTaskActionResponse {
  return {
    action,
    summary: { requested: 0, succeeded: 0, failed: 0 },
    results: [],
  }
}

function areStringArraysEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

export function TaskWorkbenchPage() {
  const { t } = useTranslation()
  const { fileValidationConfig, isLoading: isConfigLoading } = useAppConfig()
  const displayedBatchErrorRef = useRef<AppError | null>(null)
  const [selectedUploadIds, setSelectedUploadIds] = useState<string[]>([])
  const addCreatedTask = useSessionTasksStore((state) => state.addCreatedTask)
  const removeSessionTask = useSessionTasksStore((state) => state.removeSessionTask)
  const sessionTaskOrder = useSessionTasksStore((state) => state.order)
  const sessionTaskById = useSessionTasksStore((state) => state.byId)
  const upsertSessionTask = useSessionTasksStore((state) => state.upsertSessionTask)
  const taskDetailSheet = useTaskDetailSheet<WorkbenchTaskDetailAction>({
    onActionError: (action, error) => {
      logger.error('tasks.workbench.detailActionFailed', { action, error })
    },
  })
  const taskDetail = useTaskDetail(taskDetailSheet.selectedTask?.task_id ?? null)

  const {
    uploads,
    addFiles,
    removeFile,
    removeFiles,
    startUploads,
    cancelUpload,
    cancelUploads,
    retryUpload,
    retryUploads,
    markTaskCreated,
    reset,
    isUploading,
    batchError,
  } = useFileUpload(fileValidationConfig)

  const hasPending = uploads.some((upload) => upload.status === 'pending')
  // Keep the workbench visible while config loads, but block uploads and task creation
  // until the server-backed config is ready.
  const controlsDisabled = isUploading || isConfigLoading
  const sessionTasks = useMemo(() => {
    return sessionTaskOrder
      .map((taskId) => sessionTaskById[taskId])
      .filter((task): task is TaskSummary => Boolean(task))
  }, [sessionTaskById, sessionTaskOrder])

  const summary = useMemo(
    () => buildTaskWorkbenchSummary(uploads, sessionTasks),
    [sessionTasks, uploads],
  )
  const selectedUploadIdSet = useMemo(() => new Set(selectedUploadIds), [selectedUploadIds])
  const selectedAvailableFileIds = useMemo(
    () => selectAvailableFileIds(uploads.filter((upload) => selectedUploadIdSet.has(upload.id))),
    [selectedUploadIdSet, uploads],
  )
  const detailActionTask = taskDetail.task ?? taskDetailSheet.selectedTask
  const canCancelDetail = detailActionTask ? isActiveTaskStatus(detailActionTask.status) : false
  const canRetryDetail = detailActionTask ? isRetryableTaskStatus(detailActionTask.status) : false
  const canDeleteDetail = detailActionTask
    ? isDeletableTaskRecordStatus(detailActionTask.status)
    : false
  const detailActions: readonly TaskDetailSheetAction<WorkbenchTaskDetailAction>[] = [
    {
      id: 'retry',
      label: t('tasks.actions.retry'),
      enabled: Boolean(canRetryDetail),
      run: async (task) => {
        await handleBatchRetryRecentTasks([task.task_id])
        await taskDetail.refresh()
      },
    },
    {
      id: 'cancel',
      label: t('tasks.actions.cancel'),
      enabled: Boolean(canCancelDetail),
      run: async (task) => {
        await handleBatchCancelRecentTasks([task.task_id])
        await taskDetail.refresh()
      },
    },
    {
      id: 'delete',
      label: t('tasks.actions.deleteRecord'),
      enabled: Boolean(canDeleteDetail),
      placement: 'danger',
      run: async (task) => {
        const deleted = await handleDeleteRecentTaskRecord(task)
        if (deleted) {
          taskDetailSheet.closeTaskDetail()
        }
      },
    },
  ]

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

  const handleSelectedUploadsChange = useCallback((selectedUploads: readonly UploadItem[]) => {
    const nextSelectedUploadIds = selectedUploads.map((upload) => upload.id)

    setSelectedUploadIds((previous) =>
      areStringArraysEqual(previous, nextSelectedUploadIds) ? previous : nextSelectedUploadIds,
    )
  }, [])

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
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.lists() })
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
    } catch (error: unknown) {
      logger.error('tasks.workbench.cancelFailed', { error, taskId: task.task_id })
      toast.error(t('tasks.toast.actionFailed'))
    }
  }

  async function handleDeleteRecentTaskRecord(task: TaskSummary): Promise<boolean> {
    try {
      await deleteTaskRecordAction(task.task_id)
      removeSessionTask(task.task_id)
      toast.success(t('tasks.toast.recordDeleted', { taskId: task.task_id }))
      return true
    } catch (error: unknown) {
      logger.error('tasks.workbench.deleteTaskRecordFailed', { error, taskId: task.task_id })
      toast.error(t('tasks.toast.actionFailed'))
      return false
    } finally {
      await refreshTaskLists()
    }
  }

  async function handleDeleteRecentTaskRecordAction(task: TaskSummary): Promise<void> {
    await handleDeleteRecentTaskRecord(task)
  }

  async function refreshTaskLists(): Promise<void> {
    try {
      await queryClient.invalidateQueries({ queryKey: queryKeys.tasks.lists() })
    } catch (error: unknown) {
      logger.error('tasks.workbench.refreshTasksFailed', { error })
    } finally {
      requestTaskRefresh()
    }
  }

  function notifyBatchActionSummary(
    action: BatchTaskActionResponse['action'],
    response: BatchTaskActionResponse,
  ): void {
    const { succeeded, failed } = response.summary
    if (succeeded > 0 && failed === 0) {
      toast.success(t(`tasks.toast.batch.${action}.success`, { count: succeeded }))
      return
    }
    if (succeeded > 0 && failed > 0) {
      toast.warning(t(`tasks.toast.batch.${action}.partial`, { succeeded, failed }))
      return
    }
    if (failed > 0) {
      toast.error(t(`tasks.toast.batch.${action}.failed`, { count: failed }))
    }
  }

  async function handleBatchCancelRecentTasks(taskIds: string[]): Promise<BatchTaskActionResponse> {
    const normalizedTaskIds = normalizeTaskIds(taskIds)
    if (normalizedTaskIds.length === 0) {
      return buildEmptyBatchResponse('cancel')
    }

    try {
      const response = await batchCancelTasks(normalizedTaskIds)
      for (const result of response.results) {
        const existingTask = sessionTaskById[result.task_id]
        const fileId = result.file_id ?? existingTask?.file_id
        if (result.ok && result.status && fileId) {
          upsertSessionTask({
            task_id: result.task_id,
            file_id: fileId,
            filename: result.filename ?? existingTask?.filename,
            status: result.status,
          })
        }
      }
      notifyBatchActionSummary('cancel', response)
      return response
    } catch (error: unknown) {
      logger.error('tasks.workbench.batchCancelFailed', { error, taskIds: normalizedTaskIds })
      toast.error(t('tasks.toast.actionFailed'))
      throw error
    } finally {
      await refreshTaskLists()
    }
  }

  async function handleBatchRetryRecentTasks(taskIds: string[]): Promise<BatchTaskActionResponse> {
    const normalizedTaskIds = normalizeTaskIds(taskIds)
    if (normalizedTaskIds.length === 0) {
      return buildEmptyBatchResponse('retry')
    }

    try {
      const response = await batchRetryTasks(normalizedTaskIds)
      for (const result of response.results) {
        const existingTask = sessionTaskById[result.task_id]
        const fileId = result.file_id ?? existingTask?.file_id
        if (result.ok && result.new_task_id && fileId) {
          addCreatedTask({
            task_id: result.new_task_id,
            file_id: fileId,
            filename: result.filename ?? existingTask?.filename,
            status: 'pending',
          })
        }
      }
      notifyBatchActionSummary('retry', response)
      return response
    } catch (error: unknown) {
      logger.error('tasks.workbench.batchRetryFailed', { error, taskIds: normalizedTaskIds })
      toast.error(t('tasks.toast.actionFailed'))
      throw error
    } finally {
      await refreshTaskLists()
    }
  }

  // Surface batch-level errors such as duplicate file skips as toast feedback.
  useEffect(() => {
    if (!batchError) {
      displayedBatchErrorRef.current = null
      return
    }

    if (displayedBatchErrorRef.current === batchError) return

    displayedBatchErrorRef.current = batchError
    toast.warning(t(batchError.i18nKey, batchError.params ?? {}))
  }, [batchError, t])

  return (
    <ContentCanvas
      as="main"
      width="full"
      data-slot="task-workbench-page"
      className="gap-8 px-0 py-0"
    >
      <h1 className="sr-only">{t('shell.navigation.tasks')}</h1>

      <section
        data-slot="task-workbench-summary"
        className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4"
      >
        {summaryCards.map((card) => (
          <MetricCard
            key={card.key}
            title={card.title}
            value={card.value}
            description={card.description}
            className="gap-2.5 py-4"
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
              disabled={isConfigLoading}
              hasPending={hasPending}
              onFilesSelected={handleFilesSelected}
              onCancelUpload={cancelUpload}
              onCancelUploads={cancelUploads}
              onRetryUpload={retryUpload}
              onRetryUploads={retryUploads}
              onRemoveUpload={removeFile}
              onRemoveUploads={removeFiles}
              onStartUploads={startUploads}
              onReset={handleReset}
              onSelectedUploadsChange={handleSelectedUploadsChange}
            />
          </ErrorBoundary>
        }
        right={
          <ErrorBoundary>
            <TaskWorkbenchSessionConfig
              fileIds={selectedAvailableFileIds}
              onCreateTask={createTask}
              onTasksCreated={handleTasksCreated}
              disabled={controlsDisabled}
            />
          </ErrorBoundary>
        }
      />

      <section data-slot="task-workbench-activity" className="min-h-0">
        <ErrorBoundary>
          <CurrentBatchTasksPanel
            title={t('tasks.workbench.sections.activity.title')}
            description={t('tasks.workbench.sections.activity.description')}
            emptyText={t('tasks.workbench.sections.activity.empty')}
            onCancelTask={handleCancelRecentTask}
            onDeleteTaskRecord={handleDeleteRecentTaskRecordAction}
            onBatchCancelTasks={handleBatchCancelRecentTasks}
            onBatchRetryTasks={handleBatchRetryRecentTasks}
            onOpenTaskDetail={taskDetailSheet.openTaskDetail}
          />
        </ErrorBoundary>
      </section>

      <TaskDetailSheet
        open={taskDetailSheet.open}
        summaryTask={taskDetailSheet.selectedTask}
        detailTask={taskDetail.task}
        error={taskDetail.error}
        actions={detailActions}
        runningAction={taskDetailSheet.runningAction}
        onOpenChange={taskDetailSheet.onOpenChange}
        onRunAction={(action, task) => {
          void taskDetailSheet.runDetailAction(action.id, () => action.run(task))
        }}
      />
    </ContentCanvas>
  )
}
