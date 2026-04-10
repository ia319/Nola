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

describe('TaskWorkbenchActivityMonitor', () => {
  it('renders the empty state and idle indicator when the session has no tasks', () => {
    render(<TaskWorkbenchActivityMonitor tasks={[]} />)

    expect(screen.getByRole('heading', { name: 'Session Activity Monitor', level: 2 })).toBeTruthy()
    expect(screen.getByText('System idle')).toBeTruthy()
    expect(screen.getByText('No tasks in this session yet')).toBeTruthy()
    expect(screen.getByText('Waiting for input...')).toBeTruthy()
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

    expect(screen.getByText('Processing active')).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: 'Filename' })).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: 'Status' })).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: 'Progress' })).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: 'Action' })).toBeTruthy()
    expect(screen.getByText('processing.wav')).toBeTruthy()
    expect(screen.getByText('completed.wav')).toBeTruthy()
    expect(screen.getByText('82%')).toBeTruthy()
    expect(screen.getByText('100%')).toBeTruthy()

    const processingRow = screen.getByText('processing.wav').closest('tr')
    const completedRow = screen.getByText('completed.wav').closest('tr')

    expect(processingRow).toBeTruthy()
    expect(completedRow).toBeTruthy()
    expect(
      within(processingRow as HTMLElement).getByRole('button', { name: 'Cancel' }),
    ).toBeTruthy()
    expect(within(completedRow as HTMLElement).queryByRole('button', { name: 'Cancel' })).toBeNull()
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
})
