// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import logger from '@/config/logger'
import type { TaskSummary } from '@/shared/types'
import { TaskListPanel } from '../TaskListPanel'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (!params) return key
      return `${key}:${Object.entries(params)
        .map(([name, value]) => `${name}=${String(value)}`)
        .join(',')}`
    },
  }),
}))

vi.mock('@/config/logger', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

const loggerErrorMock = vi.mocked(logger.error)

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function buildTask(taskId: string, status: TaskSummary['status']): TaskSummary {
  return {
    task_id: taskId,
    file_id: `file-${taskId}`,
    filename: `audio-${taskId}.mp3`,
    status,
    progress: status === 'completed' ? 100 : 20,
    created_at: '2026-03-21T10:00:00.000Z',
    completed_at: status === 'completed' ? '2026-03-21T10:10:00.000Z' : null,
  }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('TaskListPanel', () => {
  it('deduplicates repeated clicks for the same row action while pending', async () => {
    const deferred = createDeferred<void>()
    const onCancelTask = vi.fn(() => deferred.promise)

    render(
      <TaskListPanel
        title="tasks.currentBatch.title"
        emptyText="tasks.currentBatch.empty"
        tasks={[buildTask('task-1', 'processing')]}
        onCancelTask={onCancelTask}
      />,
    )

    const cancelButton = screen.getByRole('button', { name: 'tasks.actions.cancel' })

    fireEvent.click(cancelButton)
    fireEvent.click(cancelButton)

    expect(onCancelTask).toHaveBeenCalledTimes(1)
    expect(cancelButton).toBeDisabled()

    await act(async () => {
      deferred.resolve()
      await deferred.promise
    })

    await waitFor(() => {
      expect(cancelButton).not.toBeDisabled()
    })
  })

  it('tracks pending actions per row so concurrent actions stay disabled independently', async () => {
    const pendingByTaskId = new Map<string, ReturnType<typeof createDeferred<void>>>()
    const onCancelTask = vi.fn((task: TaskSummary) => {
      const deferred = createDeferred<void>()
      pendingByTaskId.set(task.task_id, deferred)
      return deferred.promise
    })

    render(
      <TaskListPanel
        title="tasks.currentBatch.title"
        emptyText="tasks.currentBatch.empty"
        tasks={[buildTask('task-1', 'processing'), buildTask('task-2', 'processing')]}
        onCancelTask={onCancelTask}
      />,
    )

    const [firstCancelButton, secondCancelButton] = screen.getAllByRole('button', {
      name: 'tasks.actions.cancel',
    })

    fireEvent.click(firstCancelButton)
    fireEvent.click(secondCancelButton)

    await waitFor(() => {
      expect(firstCancelButton).toBeDisabled()
      expect(secondCancelButton).toBeDisabled()
    })

    const firstDeferred = pendingByTaskId.get('task-1')
    if (!firstDeferred) {
      throw new Error('expected pending handler for task-1')
    }
    await act(async () => {
      firstDeferred.resolve()
      await firstDeferred.promise
    })

    await waitFor(() => {
      expect(firstCancelButton).not.toBeDisabled()
      expect(secondCancelButton).toBeDisabled()
    })

    const secondDeferred = pendingByTaskId.get('task-2')
    if (!secondDeferred) {
      throw new Error('expected pending handler for task-2')
    }
    await act(async () => {
      secondDeferred.resolve()
      await secondDeferred.promise
    })

    await waitFor(() => {
      expect(firstCancelButton).not.toBeDisabled()
      expect(secondCancelButton).not.toBeDisabled()
    })
  })

  it('logs action handler failures and clears busy state', async () => {
    const onCancelTask = vi.fn(async () => {
      throw new Error('boom')
    })

    render(
      <TaskListPanel
        title="tasks.currentBatch.title"
        emptyText="tasks.currentBatch.empty"
        tasks={[buildTask('task-1', 'processing')]}
        onCancelTask={onCancelTask}
      />,
    )

    const cancelButton = screen.getByRole('button', { name: 'tasks.actions.cancel' })
    fireEvent.click(cancelButton)

    await waitFor(() => {
      expect(loggerErrorMock).toHaveBeenCalledTimes(1)
    })
    expect(loggerErrorMock).toHaveBeenCalledWith(
      'task.actionHandlerFailed',
      expect.objectContaining({
        taskId: 'task-1',
        action: 'cancel',
      }),
    )
    expect(cancelButton).not.toBeDisabled()
  })

  it('normalizes non-positive page size when computing pagination summary', () => {
    render(
      <TaskListPanel
        title="tasks.history.title"
        emptyText="tasks.history.empty"
        tasks={[buildTask('task-1', 'completed')]}
        pagination={{
          page: 1,
          pageSize: 0,
          total: 5,
          onPageChange: vi.fn(),
        }}
      />,
    )

    expect(screen.getByText('tasks.pagination.summary:start=1,end=1,total=5')).toBeTruthy()
    expect(screen.getByText('tasks.pagination.page:current=1,total=5')).toBeTruthy()
  })

  it('clamps negative total when computing pagination summary', () => {
    render(
      <TaskListPanel
        title="tasks.history.title"
        emptyText="tasks.history.empty"
        tasks={[buildTask('task-1', 'completed')]}
        pagination={{
          page: 1,
          pageSize: 10,
          total: -3,
          onPageChange: vi.fn(),
        }}
      />,
    )

    expect(screen.getByText('tasks.pagination.summary:start=0,end=0,total=0')).toBeTruthy()
    expect(screen.getByText('tasks.pagination.page:current=1,total=1')).toBeTruthy()
  })

  it('falls back to file_id when filename is empty', () => {
    const task = buildTask('task-1', 'completed')
    task.filename = ''

    render(
      <TaskListPanel title="tasks.history.title" emptyText="tasks.history.empty" tasks={[task]} />,
    )

    expect(screen.getByText('tasks.fields.file: file-task-1')).toBeTruthy()
  })

  it('supports row selection and completed-task export action', async () => {
    const onToggleTask = vi.fn()
    const onExportTask = vi.fn().mockResolvedValue(undefined)

    render(
      <TaskListPanel
        title="tasks.history.title"
        emptyText="tasks.history.empty"
        tasks={[buildTask('task-1', 'completed')]}
        selection={{
          selectedTaskIds: [],
          onToggleTask,
        }}
        onExportTask={onExportTask}
      />,
    )

    const checkbox = screen.getByRole('checkbox', {
      name: 'tasks.selection.selectTask:taskId=task-1',
    })
    fireEvent.click(checkbox)
    expect(onToggleTask).toHaveBeenCalledWith('task-1', true)

    const exportButton = screen.getByRole('button', { name: 'tasks.actions.export' })
    fireEvent.click(exportButton)

    await waitFor(() => {
      expect(onExportTask).toHaveBeenCalledTimes(1)
    })
  })
})
