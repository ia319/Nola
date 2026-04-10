// @vitest-environment jsdom

import type { ReactNode } from 'react'

import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { CurrentBatchTasksPanelProps } from '@/features/tasks'
import type { TaskWorkbenchSessionConfigProps } from '../TaskWorkbenchSessionConfig'
import type { TaskWorkbenchUploadQueueProps } from '../TaskWorkbenchUploadQueue'

const taskWorkbenchMocks = vi.hoisted(() => ({
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
  createTask: vi.fn(),
  cancelTaskAndRefresh: vi.fn(),
  retryTaskAndRefresh: vi.fn(),
  requestTaskRefresh: vi.fn(),
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
    <div data-slot="mock-current-batch-tasks-panel">current batch tasks panel</div>
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
        'tasks.workbench.sections.activity.title': 'Session Activity Monitor',
        'tasks.workbench.sections.activity.description':
          'Track tasks created during the current session.',
        'tasks.workbench.sections.activity.empty': 'No tasks in this session yet',
        'upload.startUpload': 'Start Upload',
        'upload.reset': 'Reset All',
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
  CurrentBatchTasksPanel: taskWorkbenchMocks.currentBatchTasksPanel,
  cancelTaskAndRefresh: taskWorkbenchMocks.cancelTaskAndRefresh,
  createTask: taskWorkbenchMocks.createTask,
  requestTaskRefresh: taskWorkbenchMocks.requestTaskRefresh,
  retryTaskAndRefresh: taskWorkbenchMocks.retryTaskAndRefresh,
  useSessionTasksStore: taskWorkbenchMocks.useSessionTasksStore,
}))

vi.mock('../TaskWorkbenchUploadQueue', () => ({
  TaskWorkbenchUploadQueue: taskWorkbenchMocks.taskWorkbenchUploadQueue,
}))

vi.mock('../TaskWorkbenchSessionConfig', () => ({
  TaskWorkbenchSessionConfig: taskWorkbenchMocks.taskWorkbenchSessionConfig,
}))

import { TaskWorkbenchPage } from '../TaskWorkbenchPage'

describe('TaskWorkbenchPage', () => {
  beforeEach(() => {
    taskWorkbenchMocks.toast.success.mockClear()
    taskWorkbenchMocks.toast.error.mockClear()
    taskWorkbenchMocks.toast.warning.mockClear()
    taskWorkbenchMocks.useAppConfig.mockReset()
    taskWorkbenchMocks.useFileUpload.mockReset()
    taskWorkbenchMocks.useSessionTasksStore.mockReset()
    taskWorkbenchMocks.addCreatedTask.mockReset()
    taskWorkbenchMocks.upsertSessionTask.mockReset()
    taskWorkbenchMocks.taskWorkbenchUploadQueue.mockClear()
    taskWorkbenchMocks.taskWorkbenchSessionConfig.mockClear()
    taskWorkbenchMocks.currentBatchTasksPanel.mockClear()

    const sessionState = {
      addCreatedTask: taskWorkbenchMocks.addCreatedTask,
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
  })

  it('renders the planned workbench skeleton and session summary cards', () => {
    render(<TaskWorkbenchPage />)

    const page = screen.getByRole('main')
    expect(page).toHaveAttribute('data-slot', 'task-workbench-page')
    expect(screen.getByRole('heading', { name: 'Tasks', level: 1 })).toBeTruthy()

    const summary = screen.getByText('Uploaded').closest('[data-slot="task-workbench-summary"]')
    expect(summary).toBeTruthy()

    const uploadedCard = screen.getByText('Uploaded').closest('[data-slot="card"]')
    const readyCard = screen.getByText('Ready').closest('[data-slot="card"]')
    const processingCard = screen.getByText('Processing').closest('[data-slot="card"]')
    const completedCard = screen.getByText('Completed').closest('[data-slot="card"]')

    expect(within(uploadedCard as HTMLElement).getByText('3')).toBeTruthy()
    expect(within(readyCard as HTMLElement).getByText('1')).toBeTruthy()
    expect(within(processingCard as HTMLElement).getByText('2')).toBeTruthy()
    expect(within(completedCard as HTMLElement).getByText('1')).toBeTruthy()

    expect(screen.getByRole('heading', { name: 'Session Configuration', level: 2 })).toBeTruthy()
    expect(screen.getByText('upload queue')).toBeTruthy()
    expect(screen.getByText('session config')).toBeTruthy()
    expect(screen.getByText('current batch tasks panel')).toBeTruthy()
  })

  it('passes the workbench-specific activity copy into the current batch panel', () => {
    render(<TaskWorkbenchPage />)

    expect(taskWorkbenchMocks.currentBatchTasksPanel).toHaveBeenCalledTimes(1)
    expect(taskWorkbenchMocks.currentBatchTasksPanel.mock.calls[0]?.[0]).toMatchObject({
      title: 'Session Activity Monitor',
      description: 'Track tasks created during the current session.',
      emptyText: 'No tasks in this session yet',
      onCancelTask: expect.any(Function),
      onRetryTask: expect.any(Function),
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
      hasPending: true,
      onFilesSelected: expect.any(Function),
      onCancelUpload: expect.any(Function),
      onRetryUpload: expect.any(Function),
      onRemoveUpload: expect.any(Function),
      onStartUpload: expect.any(Function),
      onReset: expect.any(Function),
    })
  })
})
