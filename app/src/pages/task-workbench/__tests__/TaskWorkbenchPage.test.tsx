// @vitest-environment jsdom

import type { ReactNode } from 'react'

import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { CurrentBatchTasksPanelProps } from '@/features/tasks'
import type { TaskWorkbenchSessionConfigProps } from '../TaskWorkbenchSessionConfig'
import type { TaskWorkbenchUploadQueueProps } from '../TaskWorkbenchUploadQueue'

const taskWorkbenchMocks = vi.hoisted(() => ({
  logger: {
    error: vi.fn(),
  },
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
  useAppConfig: vi.fn(),
  useFileUpload: vi.fn(),
  useSessionTasksStore: vi.fn(),
  addCreatedTask: vi.fn(),
  upsertSessionTask: vi.fn(),
  removeSessionTask: vi.fn(),
  createTask: vi.fn(),
  cancelTaskAndRefresh: vi.fn(),
  deleteTaskRecordAction: vi.fn(),
  batchCancelTasks: vi.fn(),
  batchRetryTasks: vi.fn(),
  retryTaskAndRefresh: vi.fn(),
  requestTaskRefresh: vi.fn(),
  useTaskDetail: vi.fn(),
  useTaskDetailSheet: vi.fn(),
  taskWorkbenchUploadQueue: vi.fn((_props: TaskWorkbenchUploadQueueProps) => (
    <div data-slot="mock-task-workbench-upload-queue">upload queue</div>
  )),
  taskWorkbenchSessionConfig: vi.fn((_props: TaskWorkbenchSessionConfigProps) => (
    <section data-slot="mock-task-workbench-session-config">
      <h2>Session Configuration</h2>
      <div>session config</div>
    </section>
  )),
  currentBatchTasksPanel: vi.fn((_props: CurrentBatchTasksPanelProps) => (
    <div data-slot="mock-current-batch-tasks-panel">current batch tasks</div>
  )),
  taskDetailSheet: vi.fn((_props: { open: boolean }) => (
    <div data-open={String(_props.open)} data-slot="mock-task-detail-sheet" />
  )),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const messages: Record<string, string> = {
        'shell.navigation.tasks': 'Tasks',
        'tasks.workbench.summary.uploaded.title': 'Uploaded',
        'tasks.workbench.summary.uploaded.description': 'Files added to this session',
        'tasks.workbench.summary.ready.title': 'Ready',
        'tasks.workbench.summary.ready.description': 'Uploads ready for transcription',
        'tasks.workbench.summary.processing.title': 'Processing',
        'tasks.workbench.summary.processing.description': 'Tasks pending or running',
        'tasks.workbench.summary.completed.title': 'Completed',
        'tasks.workbench.summary.completed.description': 'Tasks finished in this session',
        'tasks.workbench.sections.uploadQueue.title': 'Upload Queue',
        'tasks.workbench.sections.uploadQueue.description':
          'Add audio files and prepare the current batch.',
        'tasks.workbench.sections.sessionConfig.title': 'Session Configuration',
        'tasks.workbench.sections.sessionConfig.description':
          'Choose language and task settings before starting transcription.',
        'upload.startUpload': 'Start Upload',
        'upload.reset': 'Reset All',
        'tasks.toast.actionFailed': 'Task action failed, please retry',
        'tasks.toast.recordDeleted': `Task record deleted: ${String(params?.taskId ?? '')}`,
      }

      if (key === 'tasks.workbench.sections.uploadQueue.maxFileSize') {
        return `Max file size: ${String(params?.maxSize)} per file`
      }

      return messages[key] ?? key
    },
  }),
}))

vi.mock('sonner', () => ({
  toast: taskWorkbenchMocks.toast,
}))

vi.mock('@/config/logger', () => ({
  default: taskWorkbenchMocks.logger,
}))

vi.mock('@/components/common', () => ({
  ErrorBoundary: ({ children }: { children: ReactNode }) => children,
}))

vi.mock('@/config/use-app-config', () => ({
  useAppConfig: taskWorkbenchMocks.useAppConfig,
}))

vi.mock('@/features/upload', () => ({
  useFileUpload: taskWorkbenchMocks.useFileUpload,
}))

vi.mock('@/features/tasks', () => ({
  batchCancelTasks: taskWorkbenchMocks.batchCancelTasks,
  batchRetryTasks: taskWorkbenchMocks.batchRetryTasks,
  cancelTaskAndRefresh: taskWorkbenchMocks.cancelTaskAndRefresh,
  createTask: taskWorkbenchMocks.createTask,
  CurrentBatchTasksPanel: taskWorkbenchMocks.currentBatchTasksPanel,
  deleteTaskRecordAction: taskWorkbenchMocks.deleteTaskRecordAction,
  requestTaskRefresh: taskWorkbenchMocks.requestTaskRefresh,
  TaskDetailSheet: taskWorkbenchMocks.taskDetailSheet,
  useTaskDetail: taskWorkbenchMocks.useTaskDetail,
  useTaskDetailSheet: taskWorkbenchMocks.useTaskDetailSheet,
  useSessionTasksStore: taskWorkbenchMocks.useSessionTasksStore,
}))

vi.mock('../TaskWorkbenchUploadQueue', () => ({
  TaskWorkbenchUploadQueue: taskWorkbenchMocks.taskWorkbenchUploadQueue,
}))

vi.mock('../TaskWorkbenchSessionConfig', () => ({
  TaskWorkbenchSessionConfig: taskWorkbenchMocks.taskWorkbenchSessionConfig,
}))

import { TaskWorkbenchPage } from '../TaskWorkbenchPage'

function requireHtmlElement(value: Element | null, label: string): HTMLElement {
  if (value instanceof HTMLElement) return value
  throw new Error(`Expected ${label} to exist`)
}

describe('TaskWorkbenchPage', () => {
  beforeEach(() => {
    taskWorkbenchMocks.logger.error.mockReset()
    taskWorkbenchMocks.toast.success.mockClear()
    taskWorkbenchMocks.toast.error.mockClear()
    taskWorkbenchMocks.toast.warning.mockClear()
    taskWorkbenchMocks.useAppConfig.mockReset()
    taskWorkbenchMocks.useFileUpload.mockReset()
    taskWorkbenchMocks.useSessionTasksStore.mockReset()
    taskWorkbenchMocks.addCreatedTask.mockReset()
    taskWorkbenchMocks.upsertSessionTask.mockReset()
    taskWorkbenchMocks.removeSessionTask.mockReset()
    taskWorkbenchMocks.deleteTaskRecordAction.mockReset()
    taskWorkbenchMocks.batchCancelTasks.mockReset()
    taskWorkbenchMocks.batchRetryTasks.mockReset()
    taskWorkbenchMocks.useTaskDetail.mockReset()
    taskWorkbenchMocks.useTaskDetailSheet.mockReset()
    taskWorkbenchMocks.taskWorkbenchUploadQueue.mockClear()
    taskWorkbenchMocks.taskWorkbenchSessionConfig.mockClear()
    taskWorkbenchMocks.currentBatchTasksPanel.mockClear()
    taskWorkbenchMocks.taskDetailSheet.mockClear()

    const sessionState = {
      addCreatedTask: taskWorkbenchMocks.addCreatedTask,
      removeSessionTask: taskWorkbenchMocks.removeSessionTask,
      upsertSessionTask: taskWorkbenchMocks.upsertSessionTask,
      order: ['task-processing', 'task-pending', 'task-completed'],
      byId: {
        'task-processing': {
          task_id: 'task-processing',
          file_id: 'file-processing',
          filename: 'processing.wav',
          status: 'processing',
          progress: 42,
          created_at: '2026-04-10T10:00:00.000Z',
          completed_at: null,
        },
        'task-pending': {
          task_id: 'task-pending',
          file_id: 'file-pending',
          filename: 'pending.wav',
          status: 'pending',
          progress: 0,
          created_at: '2026-04-10T10:01:00.000Z',
          completed_at: null,
        },
        'task-completed': {
          task_id: 'task-completed',
          file_id: 'file-completed',
          filename: 'completed.wav',
          status: 'completed',
          progress: 100,
          created_at: '2026-04-10T10:02:00.000Z',
          completed_at: '2026-04-10T10:03:00.000Z',
        },
      },
    }

    taskWorkbenchMocks.useSessionTasksStore.mockImplementation(
      <T,>(selector: (state: typeof sessionState) => T) => selector(sessionState),
    )

    taskWorkbenchMocks.useAppConfig.mockReturnValue({
      fileValidationConfig: {
        allowedExtensions: ['mp3', 'wav'],
        allowedMimeTypes: ['audio/mpeg', 'audio/wav'],
        maxFileSize: 500 * 1024 * 1024,
      },
      isLoading: false,
    })

    taskWorkbenchMocks.useFileUpload.mockReturnValue({
      uploads: [
        {
          id: 'upload-ready',
          file: new File(['ready'], 'ready.wav', { type: 'audio/wav' }),
          status: 'success',
          progress: 100,
          error: null,
          fileId: 'file-ready',
          taskCreated: false,
        },
        {
          id: 'upload-created',
          file: new File(['created'], 'created.wav', { type: 'audio/wav' }),
          status: 'success',
          progress: 100,
          error: null,
          fileId: 'file-created',
          taskCreated: true,
        },
        {
          id: 'upload-pending',
          file: new File(['pending'], 'pending.wav', { type: 'audio/wav' }),
          status: 'pending',
          progress: 0,
          error: null,
          fileId: null,
          taskCreated: false,
        },
      ],
      addFiles: vi.fn(),
      removeFile: vi.fn(),
      startUpload: vi.fn(),
      cancelUpload: vi.fn(),
      retryUpload: vi.fn(),
      markTaskCreated: vi.fn(),
      reset: vi.fn(),
      isUploading: false,
      availableFileIds: ['file-ready', 'file-created'],
      batchError: null,
      clearBatchError: vi.fn(),
    })

    taskWorkbenchMocks.useTaskDetail.mockReturnValue({
      task: null,
      isLoading: false,
      error: null,
      refresh: vi.fn().mockResolvedValue(undefined),
    })
    taskWorkbenchMocks.useTaskDetailSheet.mockReturnValue({
      open: false,
      selectedTask: null,
      runningAction: null,
      openTaskDetail: vi.fn(),
      closeTaskDetail: vi.fn(),
      onOpenChange: vi.fn(),
      runDetailAction: vi.fn(),
    })
  })

  it('renders the planned workbench skeleton and session summary cards', () => {
    render(<TaskWorkbenchPage />)

    const page = screen.getByRole('main')
    expect(page).toHaveAttribute('data-slot', 'task-workbench-page')
    expect(screen.getByRole('heading', { name: 'Tasks', level: 1, hidden: true })).toBeTruthy()

    const summary = screen.getByText('Uploaded').closest('[data-slot="task-workbench-summary"]')
    expect(summary).toBeTruthy()

    const uploadedCard = requireHtmlElement(
      screen.getByText('Uploaded').closest('[data-slot="card"]'),
      'uploaded summary card',
    )
    const readyCard = requireHtmlElement(
      screen.getByText('Ready').closest('[data-slot="card"]'),
      'ready summary card',
    )
    const processingCard = requireHtmlElement(
      screen.getByText('Processing').closest('[data-slot="card"]'),
      'processing summary card',
    )
    const completedCard = requireHtmlElement(
      screen.getByText('Completed').closest('[data-slot="card"]'),
      'completed summary card',
    )

    expect(within(uploadedCard).getByText('3')).toBeTruthy()
    expect(within(readyCard).getByText('1')).toBeTruthy()
    expect(within(processingCard).getByText('2')).toBeTruthy()
    expect(within(completedCard).getByText('1')).toBeTruthy()

    expect(screen.getByRole('heading', { name: 'Session Configuration', level: 2 })).toBeTruthy()
    expect(screen.getByText('upload queue')).toBeTruthy()
    expect(screen.getByText('session config')).toBeTruthy()
    expect(screen.getByText('current batch tasks')).toBeTruthy()
  })

  it('passes current task actions into the workbench current batch panel', () => {
    render(<TaskWorkbenchPage />)

    expect(taskWorkbenchMocks.currentBatchTasksPanel).toHaveBeenCalledTimes(1)
    expect(taskWorkbenchMocks.currentBatchTasksPanel.mock.calls[0]?.[0]).toMatchObject({
      onCancelTask: expect.any(Function),
      onDeleteTaskRecord: expect.any(Function),
      onBatchCancelTasks: expect.any(Function),
      onBatchRetryTasks: expect.any(Function),
      onOpenTaskDetail: expect.any(Function),
    })
    expect(taskWorkbenchMocks.taskWorkbenchSessionConfig.mock.calls[0]?.[0]).toMatchObject({
      fileIds: ['file-ready', 'file-created'],
      disabled: false,
      onCreateTask: expect.any(Function),
      onTasksCreated: expect.any(Function),
    })
    expect(taskWorkbenchMocks.taskWorkbenchUploadQueue.mock.calls[0]?.[0]).toMatchObject({
      uploads: expect.any(Array),
      maxFileSize: 500 * 1024 * 1024,
      isUploading: false,
      disabled: false,
      hasPending: true,
      onFilesSelected: expect.any(Function),
      onCancelUpload: expect.any(Function),
      onRetryUpload: expect.any(Function),
      onRemoveUpload: expect.any(Function),
      onStartUpload: expect.any(Function),
      onReset: expect.any(Function),
    })
  })

  it('disables upload and task creation controls while app config is still loading', () => {
    taskWorkbenchMocks.useAppConfig.mockReturnValue({
      fileValidationConfig: {
        allowedExtensions: ['mp3', 'wav'],
        allowedMimeTypes: ['audio/mpeg', 'audio/wav'],
        maxFileSize: 500 * 1024 * 1024,
      },
      isLoading: true,
    })

    render(<TaskWorkbenchPage />)

    expect(taskWorkbenchMocks.taskWorkbenchUploadQueue.mock.calls[0]?.[0]).toMatchObject({
      disabled: true,
      isUploading: false,
    })
    expect(taskWorkbenchMocks.taskWorkbenchSessionConfig.mock.calls[0]?.[0]).toMatchObject({
      disabled: true,
    })
  })

  it('logs cancel failures before showing the generic task action toast', async () => {
    taskWorkbenchMocks.cancelTaskAndRefresh.mockRejectedValueOnce(new Error('cancel failed'))

    render(<TaskWorkbenchPage />)

    const panelProps = taskWorkbenchMocks.currentBatchTasksPanel.mock.calls[0]?.[0]
    expect(panelProps).toBeTruthy()
    const onCancelTask = panelProps?.onCancelTask
    expect(onCancelTask).toBeTypeOf('function')
    if (!onCancelTask) {
      throw new Error('Expected onCancelTask to be defined')
    }

    await onCancelTask({
      task_id: 'task-processing',
      file_id: 'file-processing',
      filename: 'processing.wav',
      status: 'processing',
      progress: 42,
      created_at: '2026-04-10T10:00:00.000Z',
      completed_at: null,
    })

    expect(taskWorkbenchMocks.logger.error).toHaveBeenCalledWith(
      'tasks.workbench.cancelFailed',
      expect.objectContaining({
        error: expect.any(Error),
        taskId: 'task-processing',
      }),
    )
    expect(taskWorkbenchMocks.toast.error).toHaveBeenCalledWith('Task action failed, please retry')
  })

  it('deletes current task records through the current batch panel action', async () => {
    taskWorkbenchMocks.deleteTaskRecordAction.mockResolvedValueOnce({
      task_id: 'task-completed',
      message: 'deleted',
    })

    render(<TaskWorkbenchPage />)

    const panelProps = taskWorkbenchMocks.currentBatchTasksPanel.mock.calls[0]?.[0]
    expect(panelProps).toBeTruthy()
    const onDeleteTaskRecord = panelProps?.onDeleteTaskRecord
    expect(onDeleteTaskRecord).toBeTypeOf('function')
    if (!onDeleteTaskRecord) {
      throw new Error('Expected onDeleteTaskRecord to be defined')
    }

    await onDeleteTaskRecord({
      task_id: 'task-completed',
      file_id: 'file-completed',
      filename: 'completed.wav',
      status: 'completed',
      progress: 100,
      created_at: '2026-04-10T10:02:00.000Z',
      completed_at: '2026-04-10T10:03:00.000Z',
    })

    expect(taskWorkbenchMocks.deleteTaskRecordAction).toHaveBeenCalledWith('task-completed')
    expect(taskWorkbenchMocks.removeSessionTask).toHaveBeenCalledWith('task-completed')
    expect(taskWorkbenchMocks.toast.success).toHaveBeenCalledWith(
      'Task record deleted: task-completed',
    )
  })

  it('shows each batch warning once without clearing the upload hook state', () => {
    const clearBatchError = vi.fn()
    const duplicateBatchError = {
      code: 'VALIDATION_DUPLICATE',
      i18nKey: 'upload.error.duplicateFiles',
      retriable: false,
      params: { count: 2 },
    }

    taskWorkbenchMocks.useFileUpload.mockReturnValue({
      uploads: [],
      addFiles: vi.fn(),
      removeFile: vi.fn(),
      startUpload: vi.fn(),
      cancelUpload: vi.fn(),
      retryUpload: vi.fn(),
      markTaskCreated: vi.fn(),
      reset: vi.fn(),
      isUploading: false,
      availableFileIds: [],
      batchError: duplicateBatchError,
      clearBatchError,
    })

    const { rerender } = render(<TaskWorkbenchPage />)

    expect(taskWorkbenchMocks.toast.warning).toHaveBeenCalledTimes(1)
    expect(taskWorkbenchMocks.toast.warning).toHaveBeenCalledWith('upload.error.duplicateFiles')
    expect(clearBatchError).not.toHaveBeenCalled()

    rerender(<TaskWorkbenchPage />)

    expect(taskWorkbenchMocks.toast.warning).toHaveBeenCalledTimes(1)
    expect(clearBatchError).not.toHaveBeenCalled()
  })
})
