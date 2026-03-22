// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { TaskSummary } from '@/shared/types'
import { TaskHistoryPanel } from '../TaskHistoryPanel'

const exportDefaultsMocks = vi.hoisted(() => ({
  refreshMock: vi.fn(),
  updateDefaultsMock: vi.fn().mockResolvedValue({
    format: 'srt',
    include_timestamps: true,
  }),
  resetDefaultsMock: vi.fn().mockResolvedValue({
    format: 'srt',
    include_timestamps: true,
  }),
}))

vi.mock('@/features/export', async () => {
  const actual = await vi.importActual('@/features/export')
  return {
    ...actual,
    useExportDefaults: () => ({
      defaults: {
        format: 'srt',
        include_timestamps: true,
      },
      isLoading: false,
      refresh: exportDefaultsMocks.refreshMock,
      updateDefaults: exportDefaultsMocks.updateDefaultsMock,
      resetDefaults: exportDefaultsMocks.resetDefaultsMock,
    }),
  }
})

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (!params) return key
      return `${key}:${Object.entries(params)
        .map(([name, value]) => `${name}=${String(value)}`)
        .join(',')}`
    },
  }),
  withTranslation: () => (Component: unknown) => Component,
}))

function buildTask(taskId: string, status: TaskSummary['status']): TaskSummary {
  return {
    task_id: taskId,
    file_id: `file-${taskId}`,
    filename: `${taskId}.mp3`,
    status,
    progress: status === 'completed' ? 100 : 15,
    created_at: '2026-03-22T10:00:00.000Z',
    completed_at: status === 'completed' ? '2026-03-22T10:05:00.000Z' : null,
  }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('TaskHistoryPanel', () => {
  it('routes batch actions with status-based eligible task ids', async () => {
    const onBatchCancelTasks = vi.fn().mockResolvedValue(undefined)
    const onBatchRetryTasks = vi.fn().mockResolvedValue(undefined)
    const onBatchExportTasks = vi.fn().mockResolvedValue(undefined)

    render(
      <TaskHistoryPanel
        tasks={[
          buildTask('task-processing', 'processing'),
          buildTask('task-failed', 'failed'),
          buildTask('task-completed', 'completed'),
        ]}
        query={{
          q: '',
          status: 'all',
          sort_by: 'created_at',
          order: 'desc',
          page: 1,
          page_size: 20,
        }}
        total={3}
        onSearchChange={vi.fn()}
        onStatusChange={vi.fn()}
        onSortByChange={vi.fn()}
        onOrderChange={vi.fn()}
        onPageChange={vi.fn()}
        onBatchCancelTasks={onBatchCancelTasks}
        onBatchRetryTasks={onBatchRetryTasks}
        onBatchExportTasks={onBatchExportTasks}
      />,
    )

    fireEvent.click(
      screen.getByRole('button', { name: 'tasks.history.selection.selectCurrentPage' }),
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'tasks.history.batchActions.cancel:count=1' }),
    )

    await waitFor(() => {
      expect(onBatchCancelTasks).toHaveBeenCalledWith(['task-processing'])
    })

    fireEvent.click(
      screen.getByRole('button', { name: 'tasks.history.selection.selectCurrentPage' }),
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'tasks.history.batchActions.retry:count=1' }),
    )

    await waitFor(() => {
      expect(onBatchRetryTasks).toHaveBeenCalledWith(['task-failed'])
    })

    fireEvent.click(
      screen.getByRole('button', { name: 'tasks.history.selection.selectCurrentPage' }),
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'tasks.history.batchActions.export:count=1' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'tasks.exportDialog.actions.confirm' }))

    await waitFor(() => {
      expect(onBatchExportTasks).toHaveBeenCalledWith(['task-completed'], {
        format: 'srt',
        include_timestamps: true,
        zip_name: undefined,
      })
    })
  })

  it('passes single-export filename options and persists defaults when selected', async () => {
    const onExportTask = vi.fn().mockResolvedValue({ mode: 'download' })

    render(
      <TaskHistoryPanel
        tasks={[buildTask('task-completed', 'completed')]}
        query={{
          q: '',
          status: 'all',
          sort_by: 'created_at',
          order: 'desc',
          page: 1,
          page_size: 20,
        }}
        total={1}
        onSearchChange={vi.fn()}
        onStatusChange={vi.fn()}
        onSortByChange={vi.fn()}
        onOrderChange={vi.fn()}
        onPageChange={vi.fn()}
        onExportTask={onExportTask}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'tasks.actions.export' }))

    expect(
      screen.getByText('tasks.exportDialog.fields.defaultFilenameHint:filename=task-completed.srt'),
    ).toBeTruthy()

    fireEvent.change(screen.getByLabelText('tasks.exportDialog.fields.filename'), {
      target: { value: 'my-caption' },
    })
    fireEvent.click(screen.getByLabelText('tasks.exportDialog.actions.saveAsDefault'))
    fireEvent.click(screen.getByRole('button', { name: 'tasks.exportDialog.actions.confirm' }))

    await waitFor(() => {
      expect(onExportTask).toHaveBeenCalledWith(
        expect.objectContaining({ task_id: 'task-completed' }),
        {
          format: 'srt',
          include_timestamps: true,
          target: 'download',
          filename: 'my-caption',
        },
      )
    })

    await waitFor(() => {
      expect(exportDefaultsMocks.updateDefaultsMock).toHaveBeenCalledWith({
        format: 'srt',
        include_timestamps: true,
      })
    })
  })

  it('resets export defaults from dialog action', async () => {
    const onExportTask = vi.fn().mockResolvedValue({ mode: 'download' })

    render(
      <TaskHistoryPanel
        tasks={[buildTask('task-completed', 'completed')]}
        query={{
          q: '',
          status: 'all',
          sort_by: 'created_at',
          order: 'desc',
          page: 1,
          page_size: 20,
        }}
        total={1}
        onSearchChange={vi.fn()}
        onStatusChange={vi.fn()}
        onSortByChange={vi.fn()}
        onOrderChange={vi.fn()}
        onPageChange={vi.fn()}
        onExportTask={onExportTask}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'tasks.actions.export' }))
    fireEvent.click(
      screen.getByRole('button', { name: 'tasks.exportDialog.actions.resetDefaults' }),
    )

    await waitFor(() => {
      expect(exportDefaultsMocks.resetDefaultsMock).toHaveBeenCalledTimes(1)
    })
  })
})
