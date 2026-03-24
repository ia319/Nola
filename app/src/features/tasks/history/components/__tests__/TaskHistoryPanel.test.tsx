// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { TaskSummary } from '@/shared/types'
import { TaskHistoryPanel } from '../TaskHistoryPanel'

const exportDefaultsMocks = vi.hoisted(() => ({
  defaults: {
    format: 'srt',
    include_timestamps: true,
  },
  isLoading: false,
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
      defaults: exportDefaultsMocks.defaults,
      isLoading: exportDefaultsMocks.isLoading,
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
  exportDefaultsMocks.defaults = {
    format: 'srt',
    include_timestamps: true,
  }
  exportDefaultsMocks.isLoading = false
  exportDefaultsMocks.refreshMock.mockResolvedValue({
    format: 'srt',
    include_timestamps: true,
  })
})

describe('TaskHistoryPanel', () => {
  it('submits search only on explicit Enter action', async () => {
    const onSearchChange = vi.fn()

    render(
      <TaskHistoryPanel
        tasks={[buildTask('task-processing', 'processing')]}
        query={{
          q: '',
          status: 'all',
          sort_by: 'created_at',
          order: 'desc',
          page: 1,
          page_size: 20,
        }}
        total={1}
        onSearchChange={onSearchChange}
        onStatusChange={vi.fn()}
        onSortByChange={vi.fn()}
        onOrderChange={vi.fn()}
        onPageChange={vi.fn()}
      />,
    )

    const searchInput = screen.getByPlaceholderText('tasks.filters.searchPlaceholder')
    fireEvent.change(searchInput, { target: { value: 'alpha' } })

    expect(onSearchChange).not.toHaveBeenCalled()

    fireEvent.keyDown(searchInput, { key: 'Enter' })

    await waitFor(() => {
      expect(onSearchChange).toHaveBeenCalledWith('alpha')
    })
  })

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
    const confirmBatchExportButton = await screen.findByRole('button', {
      name: 'tasks.exportDialog.actions.confirm',
    })
    fireEvent.click(confirmBatchExportButton)

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

    await screen.findByText(
      'tasks.exportDialog.fields.defaultFilenameHint:filename=task-completed.srt',
    )

    fireEvent.change(await screen.findByLabelText('tasks.exportDialog.fields.filename'), {
      target: { value: 'my-caption' },
    })
    fireEvent.click(await screen.findByLabelText('tasks.exportDialog.actions.saveAsDefault'))
    fireEvent.click(
      await screen.findByRole('button', { name: 'tasks.exportDialog.actions.confirm' }),
    )

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
      await screen.findByRole('button', { name: 'tasks.exportDialog.actions.resetDefaults' }),
    )

    await waitFor(() => {
      expect(exportDefaultsMocks.resetDefaultsMock).toHaveBeenCalledTimes(1)
    })
  })

  it('loads persisted defaults before opening export dialog while loading', async () => {
    exportDefaultsMocks.isLoading = true
    exportDefaultsMocks.refreshMock.mockResolvedValue({
      format: 'ass',
      include_timestamps: false,
    })
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

    await waitFor(() => {
      expect(exportDefaultsMocks.refreshMock).toHaveBeenCalledTimes(1)
    })
    fireEvent.click(
      await screen.findByRole('button', { name: 'tasks.exportDialog.actions.confirm' }),
    )

    await waitFor(() => {
      expect(onExportTask).toHaveBeenCalledWith(
        expect.objectContaining({ task_id: 'task-completed' }),
        {
          format: 'ass',
          include_timestamps: false,
          target: 'download',
          filename: undefined,
        },
      )
    })
  })

  it('keeps export dialog open when export request fails', async () => {
    const onExportTask = vi.fn().mockRejectedValue(new Error('export-failed'))

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
      await screen.findByRole('button', { name: 'tasks.exportDialog.actions.confirm' }),
    )

    await waitFor(() => {
      expect(onExportTask).toHaveBeenCalledTimes(1)
    })
    expect(
      await screen.findByRole('button', { name: 'tasks.exportDialog.actions.confirm' }),
    ).toBeTruthy()
  })

  it('prunes selected task ids when current-page tasks refresh', async () => {
    const query = {
      q: '',
      status: 'all' as const,
      sort_by: 'created_at' as const,
      order: 'desc' as const,
      page: 1,
      page_size: 20,
    }
    const taskA = buildTask('task-a', 'completed')
    const taskB = buildTask('task-b', 'completed')
    const onPageChange = vi.fn()

    const { rerender } = render(
      <TaskHistoryPanel
        tasks={[taskA, taskB]}
        query={query}
        total={2}
        onSearchChange={vi.fn()}
        onStatusChange={vi.fn()}
        onSortByChange={vi.fn()}
        onOrderChange={vi.fn()}
        onPageChange={onPageChange}
      />,
    )

    fireEvent.click(screen.getByLabelText('tasks.selection.selectTask:taskId=task-a'))

    await screen.findByText('tasks.history.selection.selectedCount:count=1')

    rerender(
      <TaskHistoryPanel
        tasks={[taskB]}
        query={query}
        total={1}
        onSearchChange={vi.fn()}
        onStatusChange={vi.fn()}
        onSortByChange={vi.fn()}
        onOrderChange={vi.fn()}
        onPageChange={onPageChange}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('tasks.history.selection.selectedCount:count=0')).toBeTruthy()
    })
  })

  it('guards batch actions against duplicate rapid clicks', async () => {
    let resolveCancel!: () => void
    const onBatchCancelTasks = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveCancel = () => resolve()
        }),
    )

    render(
      <TaskHistoryPanel
        tasks={[buildTask('task-processing', 'processing')]}
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
        onBatchCancelTasks={onBatchCancelTasks}
      />,
    )

    fireEvent.click(
      screen.getByRole('button', { name: 'tasks.history.selection.selectCurrentPage' }),
    )
    const cancelButton = screen.getByRole('button', {
      name: 'tasks.history.batchActions.cancel:count=1',
    })
    fireEvent.click(cancelButton)
    fireEvent.click(cancelButton)

    expect(onBatchCancelTasks).toHaveBeenCalledTimes(1)

    resolveCancel()
    await waitFor(() => {
      expect(screen.getByText('tasks.history.selection.selectedCount:count=0')).toBeTruthy()
    })
  })

  it('uses resolved filename fallback in single-export default hint', async () => {
    const onExportTask = vi.fn().mockResolvedValue({ mode: 'download' })
    const completedTask = {
      ...buildTask('task-completed', 'completed'),
      filename: null,
    }

    render(
      <TaskHistoryPanel
        tasks={[completedTask]}
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
        resolveFileName={() => 'resolved-audio.wav'}
        onExportTask={onExportTask}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'tasks.actions.export' }))

    expect(
      await screen.findByText(
        'tasks.exportDialog.fields.defaultFilenameHint:filename=resolved-audio.srt',
      ),
    ).toBeTruthy()
  })
})
