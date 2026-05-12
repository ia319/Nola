// @vitest-environment jsdom

import type { ComponentType, ReactNode } from 'react'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { isSameHistorySearch, normalizeHistorySearch } from '@/routes/history-search'
import type { ExportDialogValue, ExportRequestOptions } from '@/features/export'
import type { UseHistoryTaskActionsResult } from '../hooks/useHistoryTaskActions'
import type { FileInfo, TaskDetail, TaskSummary } from '@/shared/types'

const historyPageMocks = vi.hoisted(() => ({
  logger: {
    error: vi.fn(),
  },
  navigate: vi.fn(),
  search: {} as Record<string, unknown>,
  useHistoryTasks: vi.fn(),
  useHistoryFiles: vi.fn(),
  useHistoryTaskDetail: vi.fn(),
  useHistoryFileAssociatedTasks: vi.fn(),
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
      onChange,
      onConfirm,
    }: {
      open: boolean
      taskCount: number
      value: ExportDialogValue
      onChange: (next: ExportDialogValue) => void
      onConfirm: () => void
    }) => (
      <div
        data-slot="mock-export-dialog"
        data-open={String(open)}
        data-task-count={String(taskCount)}
        data-format={value.format}
      >
        <button
          type="button"
          onClick={() => {
            onChange({
              ...value,
              target: 'save',
            })
          }}
        >
          Use save target
        </button>
        <button
          type="button"
          onClick={() => {
            onChange({
              ...value,
              target: 'download',
            })
          }}
        >
          Use download target
        </button>
        <button type="button" onClick={onConfirm}>
          Confirm export
        </button>
      </div>
    ),
  ),
}))

type TranslationParams = Record<string, string | number | boolean | null | undefined>

vi.mock('react-i18next', () => ({
  withTranslation: () => (Component: ComponentType) => Component,
  useTranslation: () => ({
    t: (key: string, params?: TranslationParams) => {
      const messages: Record<string, string> = {
        'history.title': 'History',
        'history.description': 'Review archived task records and recent execution output.',
        'history.navigationLabel': 'History sections',
        'history.views.task': 'Task',
        'history.views.live': 'Live',
        'history.modes.files': 'Filename',
        'history.modes.tasks': 'Task ID',
        'history.toolbar.searchLabel': 'Search history records',
        'history.toolbar.searchPlaceholder': 'Search by task ID or filename',
        'history.toolbar.clearSearch': 'Clear search',
        'history.toolbar.status': 'Status',
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
        'history.files.table.actions.openDetail': `Open details for ${String(params?.filename)}`,
        'history.files.table.actions.more': `More actions for ${String(params?.filename)}`,
        'history.files.table.selectAll': 'Select all history files',
        'error.generic': 'An error occurred',
        'error.boundary.retry': 'Try Again',
        'error.api.serverError': 'Server error',
        'history.files.empty.title': 'No uploaded files found',
        'history.files.empty.description':
          'Your file archive is empty. Return to the task workbench to add source audio and start new runs.',
        'history.files.empty.action': 'Go to task workbench',
        'history.files.batch.delete': 'Delete selected',
        'history.files.filters.searchPlaceholder': 'Search by file ID, filename, or content type',
        'history.files.filters.contentType': 'Content type',
        'history.files.filters.contentTypeAll': 'All Types',
        'history.files.detail.eyebrow': 'File detail',
        'history.files.detail.description': 'Review file metadata and known associated tasks.',
        'history.files.detail.close': 'Close file detail',
        'history.files.detail.loading': 'Loading file detail...',
        'history.files.detail.actions.reprocess': 'Re-process',
        'history.taskDetail.eyebrow': 'Task detail',
        'history.taskDetail.close': 'Close task detail',
        'history.taskDetail.copyTaskId': 'Copy task ID',
        'history.taskDetail.loading': 'Loading task detail...',
        'history.taskDetail.sections.transcriptionResult': 'Transcription Result',
        'history.taskDetail.sections.taskMetadata': 'Task Metadata',
        'history.taskDetail.sections.technicalProperties': 'Technical Properties',
        'history.taskDetail.fields.duration': 'Duration',
        'history.taskDetail.fields.model': 'Model',
        'history.taskDetail.fields.error': 'Error',
        'history.taskDetail.segments.empty.title': 'No segments available',
        'history.taskDetail.segments.empty.description':
          'This task does not include transcription segments yet.',
        'history.taskDetail.technicalUnavailable.title': 'Technical properties unavailable',
        'history.taskDetail.technicalUnavailable.description':
          'Additional media properties are not exposed in the current task detail response.',
        'history.taskDetail.toast.taskIdCopied': 'Task ID copied',
        'history.files.detail.sections.metadata': 'Metadata',
        'history.files.detail.sections.waveform': 'Waveform Preview',
        'history.files.detail.sections.associatedTasks': 'Associated Tasks',
        'history.files.detail.waveformDescription':
          'Waveform preview is decorative in this release.',
        'history.files.detail.waveformPlaceholder': 'Waveform preview coming soon',
        'history.files.detail.associatedTasksDescription':
          'Show tasks already known in the current history context.',
        'history.files.detail.associatedTasksUnavailable.title': 'Associated tasks unavailable',
        'history.files.detail.associatedTasksUnavailable.description':
          'Task links are not available from the current file API response.',
        'history.files.detail.associatedTasksEmpty.title': 'No associated tasks found',
        'history.files.detail.associatedTasksEmpty.description':
          'This file has no known tasks in the current history context.',
        'history.files.deleteDialog.title': 'Delete file',
        'history.files.deleteDialog.batchTitle': 'Delete files',
        'history.files.deleteDialog.cancel': 'Cancel',
        'history.files.deleteDialog.confirm': 'Delete file',
        'history.files.deleteDialog.deleting': 'Deleting...',
        'history.live.empty.title': 'No live records found',
        'history.live.empty.description': 'Finished live sessions will appear in this view.',
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
        'history.table.actions.more': `More actions for ${String(params?.taskId)}`,
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
        'tasks.actions.cancel': 'Cancel',
        'tasks.actions.retry': 'Retry',
        'tasks.actions.export': 'Export',
        'tasks.actions.deleteRecord': 'Delete Record',
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

      if (key === 'history.files.detail.taskCreatedAt') {
        return `Created ${String(params?.value)}`
      }

      if (key === 'history.files.deleteDialog.description') {
        return `Delete ${String(params?.filename)} and its associated data?`
      }

      if (key === 'history.files.deleteDialog.batchDescription') {
        return `Delete ${String(params?.count)} selected files and their associated data?`
      }

      if (key === 'history.files.deleteDialog.batchCount') {
        return `${String(params?.count)} files selected`
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
}))

vi.mock('@/app/locale/use-active-locale', () => ({
  useActiveLocale: () => null,
}))

vi.mock('@/components/common', async () => {
  const actual = (await vi.importActual('@/components/common')) as Record<string, unknown>

  return {
    ...actual,
    ErrorBoundary: ({ children }: { children: ReactNode }) => children,
    InteractiveTablePagination: ({
      page,
      pageSize,
      total,
      labels,
      onPageChange,
    }: {
      page: number
      pageSize: number
      total: number
      labels?: {
        summary?: (model: {
          page: number
          pageSize: number
          total: number
          totalPages: number
          start: number
          end: number
        }) => ReactNode
        page?: (page: number) => ReactNode
        previous?: string
        next?: string
      }
      onPageChange: (page: number) => void
    }) => {
      const totalPages = Math.max(1, Math.ceil(total / pageSize))
      const start = total === 0 ? 0 : (page - 1) * pageSize + 1
      const end = total === 0 ? 0 : Math.min(total, page * pageSize)
      const summary =
        labels?.summary?.({ page, pageSize, total, totalPages, start, end }) ??
        `Showing ${start}-${end} of ${total}`

      return (
        <footer data-slot="mock-interactive-table-pagination">
          <p>{summary}</p>
          <button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            {labels?.previous ?? 'Previous page'}
          </button>
          <button type="button" aria-label={String(labels?.page?.(page) ?? `Page ${page}`)}>
            {page}
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            {labels?.next ?? 'Next page'}
          </button>
        </footer>
      )
    },
  }
})

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
    useSessionTasksStore: historyPageMocks.useSessionTasksStore,
  }
})

vi.mock('../hooks/useHistoryTasks', () => ({
  useHistoryTasks: historyPageMocks.useHistoryTasks,
}))

vi.mock('../hooks/useHistoryTaskActions', () => ({
  useHistoryTaskActions: historyPageMocks.useHistoryTaskActions,
}))

vi.mock('../hooks/useHistoryFiles', () => ({
  useHistoryFiles: historyPageMocks.useHistoryFiles,
}))

vi.mock('../hooks/useHistoryTaskDetail', () => ({
  useHistoryTaskDetail: historyPageMocks.useHistoryTaskDetail,
}))

vi.mock('../hooks/useHistoryFileAssociatedTasks', () => ({
  useHistoryFileAssociatedTasks: historyPageMocks.useHistoryFileAssociatedTasks,
}))

vi.mock('../hooks/useHistoryFileTaskCounts', () => ({
  useHistoryFileTaskCounts: historyPageMocks.useHistoryFileTaskCounts,
}))

vi.mock('../hooks/useHistoryFileActions', () => ({
  useHistoryFileActions: historyPageMocks.useHistoryFileActions,
}))

import { HistoryPage } from '../HistoryPage'

function openMenu(button: HTMLElement): void {
  fireEvent.pointerDown(button, {
    button: 0,
    ctrlKey: false,
    pointerType: 'mouse',
  })
}

function buildHistoryUpdater() {
  return (patch: Record<string, unknown>, replace: boolean) => {
    historyPageMocks.navigate({
      replace,
      search: (previous: Record<string, unknown>) => {
        const next = normalizeHistorySearch({ ...previous, ...patch })
        return isSameHistorySearch(normalizeHistorySearch(previous), next) ? previous : next
      },
    })
  }
}

function renderHistoryPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <HistoryPage
        search={normalizeHistorySearch(historyPageMocks.search)}
        updateSearch={buildHistoryUpdater()}
      />
    </QueryClientProvider>,
  )
}

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

function createTaskDetail(overrides: Partial<TaskDetail> = {}) {
  return {
    task_id: 'task-completed',
    file_id: 'file-1',
    filename: 'briefing.wav',
    model_id: 'large-v3',
    status: 'completed',
    progress: 100,
    created_at: '2026-04-11T10:00:00.000Z',
    completed_at: '2026-04-11T10:05:00.000Z',
    duration: 300.5,
    segments: [
      {
        start: 0,
        end: 12,
        text: 'Welcome to the archive review.',
      },
    ],
    error: null,
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
    historyPageMocks.useHistoryTaskDetail.mockReset()
    historyPageMocks.useHistoryFileAssociatedTasks.mockReset()
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
      deleteTaskRecords: vi.fn(),
      retryTasks: vi.fn(),
      exportTask: vi.fn(),
      exportTasks: vi.fn(),
    })
    historyPageMocks.useHistoryTaskDetail.mockReturnValue({
      task: createTaskDetail(),
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    })

    historyPageMocks.useHistoryFiles.mockReturnValue({
      files: [createFile({ file_id: 'file-archive', filename: 'archive.wav' })],
      total: 1,
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    })
    historyPageMocks.useHistoryFileTaskCounts.mockReturnValue(new Map([['file-archive', 3]]))
    historyPageMocks.useHistoryFileAssociatedTasks.mockReturnValue([
      createTask({
        task_id: 'task-file-1',
        file_id: 'file-archive',
        filename: 'archive.wav',
        status: 'completed',
      }),
    ])
    historyPageMocks.useHistoryFileActions.mockReturnValue({
      batchDeleteHistoryFiles: vi.fn(),
      deletingFileId: null,
      isDeletingFiles: false,
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
    renderHistoryPage()

    const page = screen.getByRole('main')
    expect(page).toHaveAttribute('data-slot', 'history-page')
    expect(screen.getByRole('heading', { level: 1, name: 'History' })).toBeTruthy()
    expect(screen.getByRole('navigation', { name: 'History sections' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Task' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Live' })).toBeEnabled()
    expect(screen.getByRole('textbox', { name: 'Search history records' })).toBeTruthy()
    expect(screen.getByPlaceholderText('Search by task ID or filename')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Export Selected' })).toBeNull()
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

  it('carries rounded duration seconds into the next minute', () => {
    historyPageMocks.useHistoryTasks.mockReturnValue({
      tasks: [
        createTask({
          task_id: 'task-rounding',
          created_at: '2026-04-11T10:00:00.000Z',
          completed_at: '2026-04-11T10:00:59.960Z',
          status: 'completed',
        }),
      ],
      total: 1,
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    })

    renderHistoryPage()

    expect(screen.getByText('01:00.0')).toBeTruthy()
    expect(screen.queryByText('00:60.0')).toBeNull()
  })

  it('switches to filename mode through the route search model', () => {
    historyPageMocks.search = {
      order: 'asc',
      page: 3,
      q: 'alpha',
      sort_by: 'filename',
      status: 'processing',
    }

    renderHistoryPage()

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
      q: 'alpha',
    })
  })

  it('switches to live history through the top-level tab', () => {
    historyPageMocks.search = {
      order: 'asc',
      page: 3,
      q: 'alpha',
      sort_by: 'filename',
      status: 'processing',
    }

    renderHistoryPage()

    fireEvent.click(screen.getByRole('button', { name: 'Live' }))

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
      mode: 'live',
    })
  })

  it('renders live mode without task or filename data sources', () => {
    historyPageMocks.search = {
      mode: 'live',
      q: 'session',
    }

    renderHistoryPage()

    expect(screen.getByRole('button', { name: 'Live' })).toHaveAttribute('aria-current', 'page')
    expect(historyPageMocks.useHistoryTasks).not.toHaveBeenCalled()
    expect(historyPageMocks.useHistoryFiles).not.toHaveBeenCalled()
    expect(screen.getByText('No live records found')).toBeTruthy()
  })

  it('switches from live history back to the default task history', () => {
    historyPageMocks.search = {
      mode: 'live',
      page: 2,
      q: 'session',
    }

    renderHistoryPage()

    fireEvent.click(screen.getByRole('button', { name: 'Task' }))

    const navigation = historyPageMocks.navigate.mock.calls.at(-1)?.[0]
    expect(navigation?.replace).toBe(false)
    expect(
      navigation?.search({
        mode: 'live',
        page: 2,
        q: 'session',
      }),
    ).toEqual({})
  })

  it('shows batch actions after selecting a row and opens the export dialog', async () => {
    renderHistoryPage()

    const table = screen.getByRole('table')
    const selectCompleted = within(table).getByRole('checkbox', {
      name: 'Select task task-completed',
    })
    fireEvent.click(selectCompleted)

    expect(screen.getByText('1 selected')).toBeTruthy()
    const exportSelected = screen.getByRole('button', { name: 'Export (1)' })
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

    expect(screen.getByRole('button', { name: 'Export (1)' })).toBeTruthy()
  })

  it('clears stale saved paths after a later download export', async () => {
    const exportTask = vi
      .fn<UseHistoryTaskActionsResult['exportTask']>()
      .mockResolvedValueOnce({ mode: 'save', savedPath: 'D:/exports/task-completed.srt' })
      .mockResolvedValueOnce({ mode: 'download' })

    historyPageMocks.useHistoryTaskActions.mockReturnValue({
      cancelTasks: vi.fn(),
      deleteTaskRecords: vi.fn(),
      retryTasks: vi.fn(),
      exportTask,
      exportTasks: vi.fn(),
    })

    renderHistoryPage()

    const completedRow = screen.getByRole('row', { name: /task-completed/i })
    const refreshedCompletedRow = screen.getByRole('row', { name: /task-completed/i })
    openMenu(
      within(refreshedCompletedRow).getByRole('button', {
        name: 'More actions for task-completed',
      }),
    )
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Export record' }))

    fireEvent.click(await screen.findByRole('button', { name: 'Use save target' }))
    await waitFor(() => {
      expect(historyPageMocks.exportDialog.mock.calls.at(-1)?.[0].value.target).toBe('save')
    })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm export' }))

    await waitFor(() => {
      expect(screen.getByText('Last saved path: D:/exports/task-completed.srt')).toBeTruthy()
    })

    openMenu(within(completedRow).getByRole('button', { name: 'More actions for task-completed' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Export record' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm export' }))

    await waitFor(() => {
      expect(screen.queryByText('Last saved path: D:/exports/task-completed.srt')).toBeNull()
    })
    expect(exportTask).toHaveBeenCalledTimes(2)
  })

  it('renders the history empty state and navigates back to tasks', () => {
    historyPageMocks.useHistoryTasks.mockReturnValue({
      tasks: [],
      total: 0,
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    })

    renderHistoryPage()

    expect(screen.getByText('No transcription records found')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Create transcription task' }))
    expect(historyPageMocks.navigate).toHaveBeenCalledWith({ to: '/' })
  })

  it('renders a task table skeleton while the first page is loading', () => {
    historyPageMocks.useHistoryTasks.mockReturnValue({
      tasks: [],
      total: 0,
      isLoading: true,
      error: null,
      refresh: vi.fn(),
    })

    renderHistoryPage()

    expect(screen.getByRole('table')).toBeTruthy()
    expect(screen.queryByText('No transcription records found')).toBeNull()
  })

  it('renders a retryable task table error state', () => {
    const refresh = vi.fn()
    historyPageMocks.useHistoryTasks.mockReturnValue({
      tasks: [],
      total: 0,
      isLoading: false,
      error: {
        code: 'API_SERVER_UNKNOWN',
        i18nKey: 'error.api.serverError',
        retriable: true,
      },
      refresh,
    })

    renderHistoryPage()

    expect(screen.getByText('An error occurred')).toBeTruthy()
    expect(screen.getByText('Server error')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }))
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('renders the filename mode with the files data source', () => {
    historyPageMocks.search = {
      mode: 'files',
      page: 2,
      page_size: 50,
    }

    renderHistoryPage()

    expect(historyPageMocks.useHistoryTasks).not.toHaveBeenCalled()
    expect(historyPageMocks.useHistoryFiles).toHaveBeenCalledWith({
      onPageClamp: expect.any(Function),
      query: {
        content_type: 'all',
        order: 'desc',
        page: 2,
        page_size: 50,
        q: '',
        sort_by: 'created_at',
      },
    })
    expect(screen.getByPlaceholderText('Search by file ID, filename, or content type')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Export Selected' })).toBeNull()
    expect(screen.getByRole('columnheader', { name: 'File' })).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: 'Tasks' })).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: 'Content Type' })).toBeTruthy()
    expect(screen.getByText('archive.wav')).toBeTruthy()
    expect(screen.getByText('3 tasks')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Delete file' })).toBeTruthy()
  })

  it('renders a retryable filename table error state', () => {
    const refresh = vi.fn()
    historyPageMocks.search = {
      mode: 'files',
    }
    historyPageMocks.useHistoryFiles.mockReturnValue({
      files: [],
      total: 0,
      isLoading: false,
      error: {
        code: 'API_SERVER_UNKNOWN',
        i18nKey: 'error.api.serverError',
        retriable: true,
      },
      refresh,
    })

    renderHistoryPage()

    expect(screen.getByText('An error occurred')).toBeTruthy()
    expect(screen.getByText('Server error')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }))
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('opens the task detail dialog from a task row', async () => {
    renderHistoryPage()

    fireEvent.click(screen.getByText('task-completed'))

    expect(screen.getByText('Task detail')).toBeTruthy()
    expect(await screen.findByText('Transcription Result')).toBeTruthy()
    expect(screen.getByText('Task Metadata')).toBeTruthy()
    expect(screen.getByText('Welcome to the archive review.')).toBeTruthy()
  })

  it('opens the file detail dialog from a filename row', async () => {
    historyPageMocks.search = {
      mode: 'files',
    }

    renderHistoryPage()

    fireEvent.click(screen.getByText('archive.wav'))

    expect(screen.getByText('File detail')).toBeTruthy()
    expect(screen.getByText('Review file metadata and known associated tasks.')).toBeTruthy()
    expect(await screen.findByText('Associated Tasks')).toBeTruthy()
    expect(screen.getByText('task-file-1')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Re-process' })).toBeTruthy()
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
      batchDeleteHistoryFiles: vi.fn(),
      deletingFileId: null,
      isDeletingFiles: false,
      deleteHistoryFile,
    })

    renderHistoryPage()

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select file file-archive' }))
    expect(screen.getByText('1 selected')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Delete selected (1)' })).toBeEnabled()
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

    render(
      <HistoryPage
        search={normalizeHistorySearch(historyPageMocks.search)}
        updateSearch={buildHistoryUpdater()}
      />,
    )

    openMenu(screen.getByRole('button', { name: 'More actions for task-completed' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete record' }))

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
