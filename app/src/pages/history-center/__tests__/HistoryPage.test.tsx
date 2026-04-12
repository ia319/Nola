// @vitest-environment jsdom

import type { ReactNode } from 'react'

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ExportDialogValue, ExportRequestOptions } from '@/features/export'
import type { TaskSummary } from '@/shared/types'

const historyPageMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  useHistoryTasks: vi.fn(),
  useHistoryTaskActions: vi.fn(),
  useSessionTasksStore: vi.fn(),
  deleteTaskRecordAction: vi.fn(),
  requestTaskRefresh: vi.fn(),
  exportDefaultsRefresh: vi.fn<() => Promise<ExportRequestOptions>>(),
  exportDefaultsUpdate: vi.fn<(_: ExportRequestOptions) => Promise<void>>(),
  exportDefaultsReset: vi.fn<() => Promise<ExportRequestOptions>>(),
  exportDialog: vi.fn(
    ({
      open,
      taskCount,
      value,
    }: {
      open: boolean
      taskCount: number
      value: ExportDialogValue
    }) => (
      <div
        data-slot="mock-export-dialog"
        data-open={String(open)}
        data-task-count={String(taskCount)}
        data-format={value.format}
      />
    ),
  ),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const messages: Record<string, string> = {
        'history.title': 'History',
        'history.description': 'Review archived task records and recent execution output.',
        'history.modes.files': 'Filename',
        'history.modes.tasks': 'Task ID',
        'history.toolbar.searchPlaceholder': 'Search by task ID or filename',
        'history.toolbar.exportSelected': 'Export Selected',
        'history.toolbar.status': 'Status',
        'history.toolbar.sortBy': 'Sort by',
        'history.toolbar.order': 'Order',
        'history.table.caption': 'History task records',
        'history.table.columns.identity': 'Task ID / Filename',
        'history.table.columns.model': 'Model Engine',
        'history.table.columns.status': 'Status',
        'history.table.columns.progress': 'Progress / Notes',
        'history.table.columns.executionDate': 'Execution Date',
        'history.table.columns.actions': 'Actions',
        'history.table.modelFallback': 'System default',
        'history.table.filenameFallback': 'Unnamed file',
        'history.table.progressNotes.pending': 'Queued for processing',
        'history.table.progressNotes.processing': 'Task in progress',
        'history.table.progressNotes.completed': 'Ready to export',
        'history.table.progressNotes.failed': 'Needs attention',
        'history.table.progressNotes.cancelled': 'Stopped before completion',
        'history.table.execution.created': 'CRE',
        'history.table.execution.completed': 'FIN',
        'history.table.execution.inProgress': 'In progress',
        'history.table.actions.export': 'Export record',
        'history.table.actions.cancel': 'Cancel task',
        'history.table.actions.retry': 'Retry task',
        'history.table.actions.deleteRecord': 'Delete record',
        'history.table.selectAll': 'Select all history rows',
        'history.empty.title': 'No transcription records found',
        'history.empty.description':
          'Your archive is currently empty. Initialize a new transcription task to begin populating your operational history.',
        'history.empty.action': 'Create transcription task',
        'history.pagination.pageSize': 'Page size',
        'history.pagination.previous': 'Previous page',
        'history.pagination.next': 'Next page',
        'tasks.filters.statusAll': 'All statuses',
        'tasks.filters.sortBy.created_at': 'Created time',
        'tasks.filters.sortBy.completed_at': 'Completed time',
        'tasks.filters.sortBy.status': 'Status',
        'tasks.filters.sortBy.progress': 'Progress',
        'tasks.filters.sortBy.filename': 'Filename',
        'tasks.filters.order.desc': 'Desc',
        'tasks.filters.order.asc': 'Asc',
        'tasks.history.batchActions.cancel': `Cancel selected (${String(params?.count)})`,
        'tasks.history.batchActions.retry': `Retry selected (${String(params?.count)})`,
        'tasks.history.batchActions.export': `Export selected (${String(params?.count)})`,
        'tasks.exportDialog.actions.copyPath': 'Copy path',
        'tasks.exportDialog.toast.defaultsSaved': 'Export defaults updated',
        'tasks.exportDialog.toast.defaultsReset': 'Export defaults reset',
        'tasks.exportDialog.toast.pathCopied': 'Saved path copied',
        'tasks.toast.actionFailed': 'Task action failed, please retry',
        'tasks.status.pending': 'Pending',
        'tasks.status.processing': 'Processing',
        'tasks.status.completed': 'Completed',
        'tasks.status.failed': 'Failed',
        'tasks.status.cancelled': 'Cancelled',
      }

      if (key === 'history.selection.selectedCount') {
        return `${String(params?.count)} selected`
      }

      if (key === 'history.table.selectRow') {
        return `Select task ${String(params?.taskId)}`
      }

      if (key === 'history.pagination.summary') {
        return `Showing ${String(params?.start)}-${String(params?.end)} of ${String(params?.total)} records`
      }

      if (key === 'history.pagination.page') {
        return `Page ${String(params?.page)}`
      }

      if (key === 'tasks.exportDialog.savedPathLabel') {
        return `Last saved path: ${String(params?.path)}`
      }

      return messages[key] ?? key
    },
  }),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => historyPageMocks.navigate,
  useSearch: () => ({}),
}))

vi.mock('@/components/common', () => ({
  ErrorBoundary: ({ children }: { children: ReactNode }) => children,
}))

vi.mock('@/features/export', () => ({
  ExportDialog: historyPageMocks.exportDialog,
  buildSingleExportFilename: () => 'default-export.srt',
  useExportDefaults: () => ({
    defaults: {
      format: 'srt',
      include_timestamps: true,
    },
    isLoading: false,
    refresh: historyPageMocks.exportDefaultsRefresh,
    updateDefaults: historyPageMocks.exportDefaultsUpdate,
    resetDefaults: historyPageMocks.exportDefaultsReset,
  }),
}))

vi.mock('@/features/tasks', async () => {
  const actual = await vi.importActual('@/features/tasks')

  return {
    ...actual,
    deleteTaskRecordAction: historyPageMocks.deleteTaskRecordAction,
    requestTaskRefresh: historyPageMocks.requestTaskRefresh,
    useHistoryTaskActions: historyPageMocks.useHistoryTaskActions,
    useHistoryTasks: historyPageMocks.useHistoryTasks,
    useSessionTasksStore: historyPageMocks.useSessionTasksStore,
  }
})

import { HistoryPage } from '../HistoryPage'

function createTask(overrides: Partial<TaskSummary>): TaskSummary {
  return {
    task_id: 'task-1',
    file_id: 'file-1',
    filename: 'briefing.wav',
    model_id: 'large-v3',
    status: 'completed',
    progress: 100,
    created_at: '2026-04-11T10:00:00.000Z',
    completed_at: '2026-04-11T10:05:00.000Z',
    ...overrides,
  }
}

describe('HistoryPage', () => {
  beforeEach(() => {
    historyPageMocks.navigate.mockReset()
    historyPageMocks.useHistoryTasks.mockReset()
    historyPageMocks.useHistoryTaskActions.mockReset()
    historyPageMocks.useSessionTasksStore.mockReset()
    historyPageMocks.deleteTaskRecordAction.mockReset()
    historyPageMocks.requestTaskRefresh.mockReset()
    historyPageMocks.exportDefaultsRefresh.mockReset()
    historyPageMocks.exportDefaultsUpdate.mockReset()
    historyPageMocks.exportDefaultsReset.mockReset()
    historyPageMocks.exportDialog.mockClear()

    historyPageMocks.useHistoryTasks.mockReturnValue({
      tasks: [
        createTask({ task_id: 'task-completed', status: 'completed' }),
        createTask({
          task_id: 'task-processing',
          filename: 'queue.wav',
          status: 'processing',
          progress: 45,
          completed_at: null,
        }),
      ],
      total: 2,
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    })

    historyPageMocks.useHistoryTaskActions.mockReturnValue({
      cancelTasks: vi.fn(),
      retryTasks: vi.fn(),
      exportTask: vi.fn(),
      exportTasks: vi.fn(),
    })

    const sessionState = {
      addCreatedTask: vi.fn(),
      removeSessionTask: vi.fn(),
      upsertSessionTask: vi.fn(),
      byId: {},
    }

    historyPageMocks.useSessionTasksStore.mockImplementation(
      <T,>(selector: (state: typeof sessionState) => T) => selector(sessionState),
    )
  })

  it('renders the planned history skeleton with toolbar, table, and pagination', () => {
    render(<HistoryPage />)

    const page = screen.getByRole('main')
    expect(page).toHaveAttribute('data-slot', 'history-page')
    expect(screen.getByRole('heading', { level: 1, name: 'History', hidden: true })).toBeTruthy()
    expect(screen.getByPlaceholderText('Search by task ID or filename')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Export Selected' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Filename' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Task ID' })).toBeDisabled()
    expect(screen.getByText('Task ID / Filename')).toBeTruthy()
    expect(screen.getByText('Model Engine')).toBeTruthy()
    expect(screen.getByText('Progress / Notes')).toBeTruthy()
    expect(screen.getByText('Showing 1-2 of 2 records')).toBeTruthy()
    expect(screen.getByText('briefing.wav')).toBeTruthy()
    expect(screen.getByText('queue.wav')).toBeTruthy()
    expect(screen.getByText('Ready to export')).toBeTruthy()
    expect(screen.getByText('Task in progress')).toBeTruthy()
  })

  it('shows batch actions after selecting a row and opens the export dialog', async () => {
    render(<HistoryPage />)

    const table = screen.getByRole('table')
    const selectCompleted = within(table).getByRole('checkbox', {
      name: 'Select task task-completed',
    })
    fireEvent.click(selectCompleted)

    expect(screen.getByText('1 selected')).toBeTruthy()
    const exportSelected = screen.getByRole('button', { name: 'Export Selected' })
    expect(exportSelected).toBeEnabled()

    fireEvent.click(exportSelected)

    await waitFor(() => {
      const lastCall = historyPageMocks.exportDialog.mock.calls.at(-1)?.[0]
      expect(lastCall).toMatchObject({
        open: true,
        taskCount: 1,
      })
    })

    expect(screen.getByText('Export selected (1)')).toBeTruthy()
  })

  it('renders the history empty state and navigates back to tasks', () => {
    historyPageMocks.useHistoryTasks.mockReturnValue({
      tasks: [],
      total: 0,
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    })

    render(<HistoryPage />)

    expect(screen.getByText('No transcription records found')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Create transcription task' }))
    expect(historyPageMocks.navigate).toHaveBeenCalledWith({ to: '/' })
  })
})
