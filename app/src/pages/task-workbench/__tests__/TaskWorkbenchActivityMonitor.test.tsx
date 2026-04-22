// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { TaskSummary } from '@/shared/types'
import { TaskWorkbenchActivityMonitor } from '../TaskWorkbenchActivityMonitor'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const messages: Record<string, string> = {
        'tasks.workbench.sections.activity.title': 'Session Activity Monitor',
        'tasks.workbench.sections.activity.empty': 'No tasks in this session yet',
        'tasks.workbench.sections.activity.waiting': 'Waiting for input...',
        'tasks.workbench.sections.activity.caption': 'Current session transcription tasks',
        'tasks.workbench.sections.activity.state.active': 'Processing active',
        'tasks.workbench.sections.activity.state.idle': 'System idle',
        'tasks.workbench.sections.activity.columns.filename': 'Filename',
        'tasks.workbench.sections.activity.columns.status': 'Status',
        'tasks.workbench.sections.activity.columns.progress': 'Progress',
        'tasks.workbench.sections.activity.columns.action': 'Action',
        'tasks.actions.cancel': 'Cancel',
        'tasks.actions.cancelling': 'Cancelling...',
        'tasks.status.pending': 'Pending',
        'tasks.status.processing': 'Processing',
        'tasks.status.completed': 'Completed',
        'tasks.status.failed': 'Failed',
        'tasks.status.cancelled': 'Cancelled',
      }

      return messages[key] ?? key
    },
  }),
}))

function createTask(overrides: Partial<TaskSummary>): TaskSummary {
  return {
    task_id: overrides.task_id ?? 'task-1',
    file_id: overrides.file_id ?? 'file-1',
    filename: overrides.filename ?? 'session.wav',
    status: overrides.status ?? 'pending',
    progress: overrides.progress ?? 0,
    created_at: overrides.created_at ?? '2026-04-10T10:00:00.000Z',
    completed_at: overrides.completed_at ?? null,
  }
}

function requireHtmlElement(value: Element | null, label: string): HTMLElement {
  if (value instanceof HTMLElement) return value
  throw new Error(`Expected ${label} to exist`)
}

describe('TaskWorkbenchActivityMonitor', () => {
  it('renders the empty state and idle indicator when the session has no tasks', () => {
    render(<TaskWorkbenchActivityMonitor tasks={[]} />)

    expect(
      screen.getByRole('heading', { name: 'Session Activity Monitor', level: 2 }),
    ).toBeInTheDocument()
    expect(screen.getByText('System idle')).toBeInTheDocument()
    expect(screen.getByText('No tasks in this session yet')).toBeInTheDocument()
    expect(screen.getByText('Waiting for input...')).toBeInTheDocument()
  })

  it('renders the planned columns and only exposes cancel for active tasks', () => {
    const onCancelTask = vi.fn().mockResolvedValue(undefined)

    render(
      <TaskWorkbenchActivityMonitor
        onCancelTask={onCancelTask}
        tasks={[
          createTask({
            task_id: 'task-processing',
            file_id: 'file-processing',
            filename: 'processing.wav',
            status: 'processing',
            progress: 82,
          }),
          createTask({
            task_id: 'task-completed',
            file_id: 'file-completed',
            filename: 'completed.wav',
            status: 'completed',
            progress: 100,
            completed_at: '2026-04-10T10:04:00.000Z',
          }),
        ]}
      />,
    )

    expect(screen.getByText('Processing active')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Filename' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Status' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Progress' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Action' })).toBeInTheDocument()
    expect(screen.getByText('processing.wav')).toBeInTheDocument()
    expect(screen.getByText('completed.wav')).toBeInTheDocument()
    expect(screen.getByText('82%')).toBeInTheDocument()
    expect(screen.getByText('100%')).toBeInTheDocument()

    const processingRow = requireHtmlElement(
      screen.getByText('processing.wav').closest('tr'),
      'processing row',
    )
    const completedRow = requireHtmlElement(
      screen.getByText('completed.wav').closest('tr'),
      'completed row',
    )

    expect(within(processingRow).getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    expect(within(completedRow).queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument()
  })

  it('runs the cancel handler for active tasks', async () => {
    const onCancelTask = vi.fn().mockResolvedValue(undefined)
    const task = createTask({
      task_id: 'task-processing',
      file_id: 'file-processing',
      filename: 'processing.wav',
      status: 'processing',
      progress: 42,
    })

    render(<TaskWorkbenchActivityMonitor tasks={[task]} onCancelTask={onCancelTask} />)

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    await waitFor(() => {
      expect(onCancelTask).toHaveBeenCalledTimes(1)
      expect(onCancelTask).toHaveBeenCalledWith(task)
    })
  })

  it('deduplicates rapid cancel clicks for the same task', async () => {
    let resolveCancel: (() => void) | undefined
    const onCancelTask = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveCancel = resolve
        }),
    )
    const task = createTask({
      task_id: 'task-processing',
      file_id: 'file-processing',
      filename: 'processing.wav',
      status: 'processing',
      progress: 42,
    })

    render(<TaskWorkbenchActivityMonitor tasks={[task]} onCancelTask={onCancelTask} />)

    const cancelButton = screen.getByRole('button', { name: 'Cancel' })
    fireEvent.click(cancelButton)
    fireEvent.click(cancelButton)

    await waitFor(() => {
      expect(onCancelTask).toHaveBeenCalledTimes(1)
    })

    if (!resolveCancel) {
      throw new Error('Expected cancel promise resolver to be assigned')
    }
    resolveCancel()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    })
  })
})
