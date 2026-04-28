// @vitest-environment jsdom
import type { ComponentType } from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useSessionTasksStore } from '@/features/tasks/store/session-tasks-store'
import type { TaskSummary } from '@/shared/types'
import { CurrentBatchTasksPanel } from '../CurrentBatchTasksPanel'

vi.mock('react-i18next', () => ({
  withTranslation: () => (Component: ComponentType<Record<string, unknown>>) =>
    function WithTranslationMock(props: Record<string, unknown>) {
      return <Component {...props} t={(key: string) => key} />
    },
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const messages: Record<string, string> = {
        'components.dataTable.empty.title': 'No rows',
        'components.dataTable.empty.description': 'No matching rows',
        'components.dataTable.selectAll': 'Select all rows',
        'tasks.actions.cancel': 'Cancel',
        'tasks.actions.cancelling': 'Cancelling...',
        'tasks.actions.retry': 'Retry',
        'tasks.actions.retrying': 'Retrying...',
        'tasks.actions.export': 'Export',
        'tasks.actions.exporting': 'Exporting...',
        'tasks.actions.deleteRecord': 'Delete Record',
        'tasks.actions.deleting': 'Deleting...',
        'tasks.currentBatch.backToFirstPage': 'Back to first page',
        'tasks.currentBatch.description': 'Current session tasks',
        'tasks.currentBatch.empty': 'No session tasks',
        'tasks.currentBatch.filters.clearSearch': 'Clear search',
        'tasks.currentBatch.selection.clear': 'Clear selection',
        'tasks.currentBatch.selection.selectCurrentPage': 'Select current page',
        'tasks.currentBatch.table.rowActions': `Actions for task ${String(params?.taskId ?? '')}`,
        'tasks.currentBatch.title': 'Current Session Tasks',
        'tasks.fields.createdAt': 'Created',
        'tasks.fields.progress': 'Progress',
        'tasks.fields.status': 'Status',
        'tasks.fields.taskId': 'Task ID',
        'tasks.filters.searchPlaceholder': 'Search tasks',
        'tasks.filters.statusAll': 'All Statuses',
        'tasks.pagination.next': 'Next',
        'tasks.pagination.previous': 'Previous',
        'tasks.status.cancelled': 'Cancelled',
        'tasks.status.completed': 'Completed',
        'tasks.status.failed': 'Failed',
        'tasks.status.pending': 'Pending',
        'tasks.status.processing': 'Processing',
        'tasks.workbench.sections.activity.caption': 'Session tasks',
        'tasks.workbench.sections.activity.columns.action': 'Action',
        'tasks.workbench.sections.activity.columns.filename': 'Filename',
        'tasks.workbench.sections.activity.empty': 'No activity',
        'tasks.workbench.sections.activity.state.active': 'Processing active',
        'tasks.workbench.sections.activity.state.idle': 'System idle',
        'tasks.workbench.sections.activity.waiting': 'Waiting',
      }

      if (key === 'tasks.currentBatch.selection.selectedCount') {
        return `${String(params?.count ?? 0)} selected`
      }
      if (key === 'tasks.pagination.summary') {
        return `Showing ${String(params?.start)}-${String(params?.end)} of ${String(params?.total)}`
      }
      if (key === 'tasks.pagination.page') {
        return `Page ${String(params?.current)} / ${String(params?.total)}`
      }
      if (key === 'tasks.selection.selectTask') {
        return `Select task ${String(params?.taskId)}`
      }

      return messages[key] ?? key
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

function buildTask(
  taskId: string,
  status: TaskSummary['status'],
  overrides: Partial<TaskSummary> = {},
): TaskSummary {
  return {
    task_id: taskId,
    file_id: `file-${taskId}`,
    filename: `${taskId}.wav`,
    status,
    progress: status === 'completed' ? 100 : 25,
    created_at: '2026-04-10T10:00:00.000Z',
    completed_at: status === 'completed' ? '2026-04-10T10:10:00.000Z' : null,
    ...overrides,
  }
}

function setSessionTasks(tasks: readonly TaskSummary[]): void {
  useSessionTasksStore.setState({
    order: tasks.map((task) => task.task_id),
    byId: Object.fromEntries(tasks.map((task) => [task.task_id, task])),
  })
}

function requireHtmlElement(value: Element | null, label: string): HTMLElement {
  if (value instanceof HTMLElement) return value
  throw new Error(`Expected ${label} to exist`)
}

beforeEach(() => {
  setSessionTasks([
    buildTask('task-beta', 'failed', {
      filename: 'beta.wav',
      progress: 15,
      created_at: '2026-04-10T10:01:00.000Z',
    }),
    buildTask('task-alpha', 'processing', {
      filename: 'alpha.wav',
      progress: 90,
      created_at: '2026-04-10T10:00:00.000Z',
    }),
    buildTask('task-gamma', 'completed', {
      filename: 'gamma.wav',
      progress: 100,
      created_at: '2026-04-10T09:59:00.000Z',
      completed_at: '2026-04-10T10:15:00.000Z',
    }),
  ])
})

afterEach(() => {
  setSessionTasks([])
  vi.clearAllMocks()
})

describe('CurrentBatchTasksPanel', () => {
  it('sorts through table headers and filters by search and status', () => {
    render(<CurrentBatchTasksPanel pageSize={10} />)

    fireEvent.click(screen.getByRole('button', { name: 'Sort Progress descending' }))

    const sortedRows = screen.getAllByRole('row')
    expect(within(sortedRows[1] as HTMLElement).getByText('gamma.wav')).toBeInTheDocument()
    expect(within(sortedRows[2] as HTMLElement).getByText('alpha.wav')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('Search tasks'), {
      target: { value: 'alpha' },
    })

    expect(screen.getByText('alpha.wav')).toBeInTheDocument()
    expect(screen.queryByText('beta.wav')).not.toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('Search tasks'), {
      target: { value: '' },
    })
    fireEvent.click(screen.getByRole('combobox', { name: 'Status' }))
    fireEvent.click(screen.getByRole('option', { name: 'Failed' }))

    expect(screen.getByText('beta.wav')).toBeInTheDocument()
    expect(screen.queryByText('alpha.wav')).not.toBeInTheDocument()
  })

  it('runs eligible batch actions for selected current-page rows', async () => {
    const onBatchCancelTasks = vi.fn().mockResolvedValue(undefined)
    const onBatchRetryTasks = vi.fn().mockResolvedValue(undefined)

    render(
      <CurrentBatchTasksPanel
        pageSize={10}
        onBatchCancelTasks={onBatchCancelTasks}
        onBatchRetryTasks={onBatchRetryTasks}
      />,
    )

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select task task-alpha' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select task task-beta' }))

    expect(screen.getByText('2 selected')).toBeInTheDocument()

    const batchActionBar = requireHtmlElement(
      screen.getByText('2 selected').closest('[data-slot="interactive-table-batch-action-bar"]'),
      'batch action bar',
    )
    const cancelButton = within(batchActionBar).getByRole('button', { name: /Cancel/ })
    expect(cancelButton).toHaveTextContent('(1)')

    fireEvent.click(cancelButton)
    await waitFor(() => {
      expect(onBatchCancelTasks).toHaveBeenCalledWith(['task-alpha'])
    })
    await waitFor(() => {
      expect(screen.queryByText('2 selected')).not.toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select task task-alpha' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select task task-beta' }))

    const nextBatchActionBar = requireHtmlElement(
      screen.getByText('2 selected').closest('[data-slot="interactive-table-batch-action-bar"]'),
      'batch action bar',
    )
    const retryButton = within(nextBatchActionBar).getByRole('button', { name: /Retry/ })
    expect(retryButton).toHaveTextContent('(1)')

    fireEvent.click(retryButton)

    await waitFor(() => {
      expect(onBatchRetryTasks).toHaveBeenCalledWith(['task-beta'])
    })
  })

  it('opens row details from non-interactive cells', () => {
    const onOpenTaskDetail = vi.fn()

    render(<CurrentBatchTasksPanel pageSize={10} onOpenTaskDetail={onOpenTaskDetail} />)

    fireEvent.click(screen.getByText('alpha.wav'))

    expect(onOpenTaskDetail).toHaveBeenCalledTimes(1)
    expect(onOpenTaskDetail).toHaveBeenCalledWith(
      expect.objectContaining({ task_id: 'task-alpha' }),
    )
  })

  it('keeps row actions from opening row details', async () => {
    const onOpenTaskDetail = vi.fn()
    const onCancelTask = vi.fn().mockResolvedValue(undefined)
    const onDeleteTaskRecord = vi.fn().mockResolvedValue(undefined)

    render(
      <CurrentBatchTasksPanel
        pageSize={10}
        onCancelTask={onCancelTask}
        onDeleteTaskRecord={onDeleteTaskRecord}
        onOpenTaskDetail={onOpenTaskDetail}
      />,
    )

    const alphaRow = requireHtmlElement(screen.getByText('alpha.wav').closest('tr'), 'alpha row')
    fireEvent.click(within(alphaRow).getByRole('button', { name: 'Cancel' }))

    expect(onOpenTaskDetail).not.toHaveBeenCalled()

    await waitFor(() => {
      expect(onCancelTask).toHaveBeenCalledWith(expect.objectContaining({ task_id: 'task-alpha' }))
    })
    expect(onOpenTaskDetail).not.toHaveBeenCalled()

    const gammaRow = requireHtmlElement(screen.getByText('gamma.wav').closest('tr'), 'gamma row')
    fireEvent.click(within(gammaRow).getByRole('button', { name: 'Delete Record' }))

    await waitFor(() => {
      expect(onDeleteTaskRecord).toHaveBeenCalledWith(
        expect.objectContaining({ task_id: 'task-gamma' }),
      )
    })
    expect(onOpenTaskDetail).not.toHaveBeenCalled()
  })
})
