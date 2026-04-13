// @vitest-environment jsdom

import type { ReactNode } from 'react'

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ExportDialogValue, ExportRequestOptions } from '@/features/export'
import type { FileInfo, TaskSummary } from '@/shared/types'

const historyPageMocks = vi.hoisted(() => ({
  logger: {
    error: vi.fn(),
  },
  navigate: vi.fn(),
  search: {} as Record<string, unknown>,
  useHistoryTasks: vi.fn(),
  useHistoryFiles: vi.fn(),
  useHistoryFileTaskCounts: vi.fn(),
  useHistoryFileActions: vi.fn(),
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
        'history.toolbar.searchLabel': 'Search history records',
        'history.toolbar.searchPlaceholder': 'Search by task ID or filename',
        'history.toolbar.exportSelected': 'Export Selected',
        'history.toolbar.status': 'Status',
        'history.toolbar.sortBy': 'Sort by',
        'history.toolbar.order': 'Order',
        'history.selection.clear': 'Clear selection',
        'history.files.table.caption': 'History file records',
        'history.files.table.typeFallback': 'Unknown',
        'history.files.table.tasksUnavailable': '—',
        'history.files.table.columns.file': 'File',
        'history.files.table.columns.tasks': 'Tasks',
        'history.files.table.columns.size': 'Size',
        'history.files.table.columns.contentType': 'Content Type',
        'history.files.table.columns.uploadedAt': 'Uploaded At',
        'history.files.table.columns.actions': 'Actions',
        'history.files.table.actions.delete': 'Delete file',
        'history.files.table.selectAll': 'Select all history files',
        'history.files.empty.title': 'No uploaded files found',
        'history.files.empty.description':
          'Your file archive is empty. Return to the task workbench to add source audio and start new runs.',
        'history.files.empty.action': 'Go to task workbench',
        'history.files.batch.deleteComingSoon': 'Delete selected coming soon',
        'history.files.deleteDialog.title': 'Delete file',
        'history.files.deleteDialog.cancel': 'Cancel',
        'history.files.deleteDialog.confirm': 'Delete file',
        'history.files.deleteDialog.deleting': 'Deleting...',
        'history.table.caption': 'History task records',
        'history.table.columns.taskId': 'Task ID',
        'history.table.columns.filename': 'Filename',
        'history.table.columns.status': 'Status',
        'history.table.columns.duration': 'Duration',
        'history.table.columns.actions': 'Actions',
        'history.table.filenameFallback': 'Unnamed file',
        'history.table.durationFallback': 'Not finished',
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

      if (key === 'history.files.selection.selectedCount') {
        return `${String(params?.count)} selected`
      }

      if (key === 'history.files.table.selectRow') {
        return `Select file ${String(params?.fileId)}`
      }

      if (key === 'history.files.table.tasksCount') {
        return `${String(params?.count)} tasks`
      }

      if (key === 'history.files.deleteDialog.description') {
        return `Delete ${String(params?.filename)} and its associated data?`
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

vi.mock('@/config/logger', () => ({
  default: historyPageMocks.logger,
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => historyPageMocks.navigate,
  useSearch: () => historyPageMocks.search,
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

vi.mock('../useHistoryFiles', () => ({
  useHistoryFiles: historyPageMocks.useHistoryFiles,
}))

vi.mock('../useHistoryFileTaskCounts', () => ({
  useHistoryFileTaskCounts: historyPageMocks.useHistoryFileTaskCounts,
}))

vi.mock('../useHistoryFileActions', () => ({
  useHistoryFileActions: historyPageMocks.useHistoryFileActions,
}))

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

function createFile(overrides: Partial<FileInfo>): FileInfo {
  return {
    file_id: 'file-1',
    filename: 'briefing.wav',
    size: 1048576,
    content_type: 'audio/wav',
    created_at: '2026-04-11T10:00:00.000Z',
    ...overrides,
  }
}

describe('HistoryPage', () => {
  beforeEach(() => {
    historyPageMocks.logger.error.mockReset()
    historyPageMocks.navigate.mockReset()
    historyPageMocks.search = {}
    historyPageMocks.useHistoryTasks.mockReset()
    historyPageMocks.useHistoryFiles.mockReset()
    historyPageMocks.useHistoryFileTaskCounts.mockReset()
    historyPageMocks.useHistoryFileActions.mockReset()
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

    historyPageMocks.useHistoryFiles.mockReturnValue({
      files: [createFile({ file_id: 'file-archive', filename: 'archive.wav' })],
      total: 1,
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    })
    historyPageMocks.useHistoryFileTaskCounts.mockReturnValue(new Map([['file-archive', 3]]))
    historyPageMocks.useHistoryFileActions.mockReturnValue({
      deletingFileId: null,
      deleteHistoryFile: vi.fn(),
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
    expect(screen.getByRole('textbox', { name: 'Search history records' })).toBeTruthy()
    expect(screen.getByPlaceholderText('Search by task ID or filename')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Export Selected' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Filename' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Task ID' })).toBeEnabled()
    expect(screen.getByRole('columnheader', { name: 'Task ID' })).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: 'Filename' })).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: 'Duration' })).toBeTruthy()
    expect(screen.getByText('Showing 1-2 of 2 records')).toBeTruthy()
    expect(screen.getByText('briefing.wav')).toBeTruthy()
    expect(screen.getByText('queue.wav')).toBeTruthy()
    expect(screen.getByText('05:00.0')).toBeTruthy()
    expect(screen.getByText('Not finished')).toBeTruthy()
  })

  it('switches to filename mode through the route search model', () => {
    historyPageMocks.search = {
      order: 'asc',
      page: 3,
      q: 'alpha',
      sort_by: 'filename',
      status: 'processing',
    }

    render(<HistoryPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Filename' }))

    const navigation = historyPageMocks.navigate.mock.calls.at(-1)?.[0]
    expect(navigation?.replace).toBe(false)
    expect(
      navigation?.search({
        order: 'asc',
        page: 3,
        q: 'alpha',
        sort_by: 'filename',
        status: 'processing',
      }),
    ).toEqual({
      mode: 'files',
    })
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
    expect(screen.getByRole('button', { name: 'Clear selection' })).toBeTruthy()

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

  it('renders the filename mode with the files data source', () => {
    historyPageMocks.search = {
      mode: 'files',
      page: 2,
      page_size: 50,
    }

    render(<HistoryPage />)

    expect(historyPageMocks.useHistoryTasks).not.toHaveBeenCalled()
    expect(historyPageMocks.useHistoryFiles).toHaveBeenCalledWith({
      onPageClamp: expect.any(Function),
      query: {
        page: 2,
        page_size: 50,
      },
    })
    expect(screen.queryByPlaceholderText('Search by task ID or filename')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Export Selected' })).toBeNull()
    expect(screen.getByRole('columnheader', { name: 'File' })).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: 'Tasks' })).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: 'Content Type' })).toBeTruthy()
    expect(screen.getByText('archive.wav')).toBeTruthy()
    expect(screen.getByText('3 tasks')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Delete file' })).toBeTruthy()
  })

  it('shows the file selection placeholder and file delete confirmation in filename mode', async () => {
    const deleteHistoryFile = vi.fn().mockResolvedValue(undefined)
    historyPageMocks.search = {
      mode: 'files',
    }
    historyPageMocks.useHistoryFiles.mockReturnValue({
      files: [createFile({ file_id: 'file-archive', filename: 'archive.wav' })],
      total: 1,
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    })
    historyPageMocks.useHistoryFileActions.mockReturnValue({
      deletingFileId: null,
      deleteHistoryFile,
    })

    render(<HistoryPage />)

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select file file-archive' }))
    expect(screen.getByText('1 selected')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Delete selected coming soon' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Clear selection' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Delete file' }))
    expect(screen.getByText('Delete archive.wav and its associated data?')).toBeTruthy()

    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete file' }))

    await waitFor(() => {
      expect(deleteHistoryFile).toHaveBeenCalledWith(
        expect.objectContaining({ file_id: 'file-archive' }),
      )
    })
  })

  it('logs task record delete failures before showing the generic action toast', async () => {
    const { toast } = await import('sonner')
    historyPageMocks.deleteTaskRecordAction.mockRejectedValueOnce(new Error('delete failed'))

    render(<HistoryPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Delete record' }))

    await waitFor(() => {
      expect(historyPageMocks.logger.error).toHaveBeenCalledWith(
        'history.deleteTaskRecordFailed',
        expect.objectContaining({
          error: expect.any(Error),
          taskId: 'task-completed',
        }),
      )
    })
    expect(toast.error).toHaveBeenCalledWith('Task action failed, please retry')
  })
})
