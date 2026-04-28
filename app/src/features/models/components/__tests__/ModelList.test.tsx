// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { DownloadState } from '@/features/models'
import type { ModelResponse } from '@/shared/types'

import type { ModelListQuery } from '../../lib/model-query-options'
import { ModelList, type ModelListProps } from '../ModelList'

type TranslationParams = Record<string, string | number | boolean | null | undefined>

vi.mock('react-i18next', () => ({
  withTranslation: () => (Component: unknown) => Component,
  useTranslation: () => ({
    t: (key: string, params?: TranslationParams) => {
      const messages: Record<string, string> = {
        'models.empty': 'No models available',
        'models.configured': 'Default',
        'models.lastLoaded': 'Running',
        'models.actions.download': 'Download',
        'models.actions.cancel': 'Cancel',
        'models.actions.delete': 'Delete',
        'models.actions.select': 'Set as Default',
        'models.status.not_downloaded': 'Not Downloaded',
        'models.status.downloading': 'Downloading',
        'models.status.partial_download': 'Partial Download',
        'models.status.downloaded': 'Downloaded',
        'models.table.caption': 'Models table',
        'models.table.columns.name': 'Name',
        'models.table.columns.languages': 'Supported Languages',
        'models.table.columns.size': 'Size',
        'models.table.columns.status': 'Status',
        'models.table.columns.profile': 'Profile',
        'models.table.columns.actions': 'Actions',
        'models.table.rowActions': `More actions for ${String(params?.name)}`,
        'models.table.empty.title': 'No models available',
        'models.table.empty.description': 'Download a model to start configuring local runs.',
        'models.filters.searchPlaceholder': 'Search models',
        'models.filters.clearSearch': 'Clear search',
        'models.filters.status': 'Status filter',
        'models.filters.statusAll': 'All Statuses',
        'models.selection.selectAll': 'Select all models',
        'models.selection.selectRow': `Select ${String(params?.name)}`,
        'models.selection.clear': 'Clear selection',
        'models.batchActions.download': 'Download selected',
        'models.batchActions.cancel': 'Cancel selected',
        'models.batchActions.delete': 'Delete selected',
        'models.catalog.largeV3.description': 'Localized large multilingual engine',
        'error.generic': 'An error occurred',
        'error.boundary.retry': 'Try Again',
      }

      if (key === 'models.selection.selectedCount') {
        return `${String(params?.count)} selected`
      }

      if (key === 'models.table.diskUsage') {
        return `Disk usage: ${String(params?.value)}`
      }

      if (key === 'models.table.profileValue') {
        return `Accuracy ${String(params?.accuracy)} · Speed ${String(params?.speed)}`
      }

      if (key === 'models.table.downloadSnapshot') {
        return `Existing progress: ${String(params?.progress)}%`
      }

      if (key === 'models.rank.2') {
        return 'Fast'
      }

      if (key === 'models.rank.4') {
        return 'Slow'
      }

      if (key === 'models.accuracyRank.3') {
        return 'Good'
      }

      if (key === 'models.accuracyRank.5') {
        return 'Very High'
      }

      return messages[key] ?? key
    },
  }),
}))

function createModel(overrides: Partial<ModelResponse> = {}): ModelResponse {
  return {
    model_id: 'nola-large-v3',
    name: 'Nola Large V3',
    size_bytes: 3_100_000_000,
    repo_id: 'nola/large-v3',
    languages: 'en',
    speed_rank: 2,
    accuracy_rank: 5,
    description: 'Large multilingual engine',
    description_key: 'models.catalog.largeV3.description',
    status: 'downloaded',
    disk_usage: 3_100_000_000,
    is_configured: false,
    is_last_loaded: false,
    download_progress: null,
    ...overrides,
  }
}

const DEFAULT_QUERY: ModelListQuery = {
  q: '',
  status: 'all',
  sort_by: null,
  order: 'asc',
}

function renderModelList(overrides: Partial<ModelListProps> = {}) {
  const props: ModelListProps = {
    models: [],
    downloads: new Map(),
    query: DEFAULT_QUERY,
    onSearchChange: vi.fn(),
    onStatusFilterChange: vi.fn(),
    onSortChange: vi.fn(),
    onDownload: vi.fn(),
    onCancel: vi.fn(),
    onDelete: vi.fn(),
    onSelect: vi.fn(),
    onOpenDetail: vi.fn(),
    ...overrides,
  }

  return render(<ModelList {...props} />)
}

function createDownloadState(overrides: Partial<DownloadState> = {}): DownloadState {
  return {
    status: 'downloading',
    percent: 42.5,
    downloadedBytes: 1_250_000_000,
    totalBytes: 3_100_000_000,
    speedBps: 35_000_000,
    error: null,
    ...overrides,
  }
}

function openRowActionMenu(name: string): void {
  fireEvent.pointerDown(screen.getByRole('button', { name }), {
    button: 0,
    ctrlKey: false,
    pointerType: 'mouse',
  })
}

function getModelRowTexts(): string[] {
  return screen
    .getAllByRole('row')
    .slice(1)
    .map((row) => row.textContent ?? '')
}

describe('ModelList', () => {
  it('renders an empty state when no models are available', () => {
    renderModelList()

    expect(screen.getByText('No models available')).toBeTruthy()
    expect(screen.getByText('Download a model to start configuring local runs.')).toBeTruthy()
  })

  it('renders table skeleton rows while models load', () => {
    renderModelList({ isLoading: true })

    expect(screen.getByRole('table')).toBeTruthy()
    expect(screen.queryByText('No models available')).toBeNull()
  })

  it('renders a retryable error state when models fail to load', () => {
    const onRetry = vi.fn()

    renderModelList({
      errorMessage: 'Server error',
      onRetry,
    })

    expect(screen.getByText('An error occurred')).toBeTruthy()
    expect(screen.getByText('Server error')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('renders model rows with table columns and action variants', async () => {
    const onDownload = vi.fn()
    const onCancel = vi.fn()
    const onDelete = vi.fn()
    const onSelect = vi.fn()
    const onOpenDetail = vi.fn()
    const downloadingModel = createModel({
      model_id: 'nola-medium-v3',
      name: 'Nola Medium V3',
      status: 'downloading',
      is_configured: false,
    })
    const selectableModel = createModel({
      model_id: 'nola-base-v3',
      name: 'Nola Base V3',
      status: 'downloaded',
      is_configured: false,
      is_last_loaded: false,
      accuracy_rank: 4,
      speed_rank: 3,
    })
    const configuredModel = createModel({
      model_id: 'nola-large-v3',
      is_configured: true,
      is_last_loaded: true,
    })
    const pendingModel = createModel({
      model_id: 'nola-small-v3',
      name: 'Nola Small V3',
      status: 'partial_download',
      is_configured: false,
      is_last_loaded: false,
      accuracy_rank: 3,
      speed_rank: 4,
    })

    renderModelList({
      models: [configuredModel, pendingModel, downloadingModel, selectableModel],
      downloads: new Map([['nola-medium-v3', createDownloadState()]]),
      onDownload,
      onCancel,
      onDelete,
      onSelect,
      onOpenDetail,
    })

    expect(screen.getByText('Name')).toBeTruthy()
    expect(screen.getByText('Supported Languages')).toBeTruthy()
    expect(screen.getByText('Size')).toBeTruthy()
    expect(screen.getByText('Status')).toBeTruthy()
    expect(screen.getByText('Profile')).toBeTruthy()
    expect(screen.getByText('Actions')).toBeTruthy()
    expect(getModelRowTexts()[0]).toContain('Nola Large V3')

    const configuredRow = screen.getByRole('row', { name: /Nola Large V3/i })
    expect(within(configuredRow).getAllByText('Default')).toHaveLength(2)
    expect(within(configuredRow).getByText('Running')).toBeTruthy()
    expect(within(configuredRow).getByText('en')).toBeTruthy()
    expect(within(configuredRow).getByText('Localized large multilingual engine')).toBeTruthy()
    expect(within(configuredRow).getByText('Accuracy 5 · Speed 2')).toBeTruthy()
    expect(within(configuredRow).getByRole('button', { name: 'Delete' })).toBeDisabled()

    const downloadingRow = screen.getByRole('row', { name: /Nola Medium V3/i })
    expect(within(downloadingRow).getByText('Downloading')).toBeTruthy()
    expect(within(downloadingRow).getByRole('button', { name: 'Cancel' })).toBeTruthy()
    expect(within(downloadingRow).getByRole('progressbar')).toBeTruthy()
    expect(within(downloadingRow).getByText('33.4 MB/s')).toBeTruthy()
    expect(within(downloadingRow).getByText('en')).toBeTruthy()

    const pendingRow = screen.getByRole('row', { name: /Nola Small V3/i })
    expect(within(pendingRow).getByText('Partial Download')).toBeTruthy()
    openRowActionMenu('More actions for Nola Small V3')
    expect(await screen.findByRole('menuitem', { name: 'Download' })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeTruthy()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Download' }))
    expect(onDownload).toHaveBeenCalledWith('nola-small-v3')
    expect(within(pendingRow).getByText('Accuracy 3 · Speed 4')).toBeTruthy()

    screen.getByRole('row', { name: /Nola Base V3/i })
    openRowActionMenu('More actions for Nola Base V3')
    expect(await screen.findByRole('menuitem', { name: 'Set as Default' })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeTruthy()
  })

  it('requests API-backed sort changes through sortable headers', () => {
    const onSortChange = vi.fn()

    renderModelList({
      models: [
        createModel({
          model_id: 'nola-large-v3',
          name: 'Nola Large V3',
          is_configured: true,
        }),
        createModel({
          model_id: 'nola-small-v3',
          name: 'Nola Small V3',
          status: 'partial_download',
          is_configured: false,
          accuracy_rank: 3,
        }),
        createModel({
          model_id: 'nola-base-v3',
          name: 'Nola Base V3',
          is_configured: false,
          accuracy_rank: 4,
        }),
      ],
      onSortChange,
    })

    expect(getModelRowTexts()[0]).toContain('Nola Large V3')

    fireEvent.click(screen.getByRole('button', { name: 'Sort Name ascending' }))

    expect(onSortChange).toHaveBeenCalledWith({ key: 'name', direction: 'asc' })
    expect(getModelRowTexts()[0]).toContain('Nola Large V3')
  })

  it('renders API query controls without moving selected actions into a new row', () => {
    const onSearchChange = vi.fn()
    const onStatusFilterChange = vi.fn()

    renderModelList({
      query: {
        ...DEFAULT_QUERY,
        q: 'large',
        status: 'downloaded',
      },
      models: [createModel({ model_id: 'nola-large-v3', name: 'Nola Large V3' })],
      onSearchChange,
      onStatusFilterChange,
    })

    expect(screen.getByRole('textbox', { name: 'Search models' })).toHaveValue('large')
    fireEvent.change(screen.getByRole('textbox', { name: 'Search models' }), {
      target: { value: 'repo' },
    })
    expect(onSearchChange).toHaveBeenCalledWith('repo')

    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(onSearchChange).toHaveBeenCalledWith('')

    const toolbar = screen
      .getByRole('textbox', { name: 'Search models' })
      .closest('[data-slot="interactive-table-toolbar"]')
    if (!(toolbar instanceof HTMLElement)) {
      throw new Error('Expected table toolbar to be rendered')
    }

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all models' }))
    expect(within(toolbar).getByText('1 selected')).toBeTruthy()
  })

  it('runs batch actions only for eligible selected models', async () => {
    const onDelete = vi.fn()

    renderModelList({
      models: [
        createModel({ model_id: 'nola-large-v3', name: 'Nola Large V3', is_configured: true }),
        createModel({
          model_id: 'nola-base-v3',
          name: 'Nola Base V3',
          is_configured: false,
          status: 'downloaded',
        }),
        createModel({
          model_id: 'nola-small-v3',
          name: 'Nola Small V3',
          is_configured: false,
          status: 'partial_download',
        }),
      ],
      onDelete,
    })

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all models' }))

    expect(screen.getByText('3 selected')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Download selected(1)' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Cancel selected(0)' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Delete selected(2)' }))

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledTimes(2)
    })
    expect(onDelete).toHaveBeenNthCalledWith(1, 'nola-base-v3')
    expect(onDelete).toHaveBeenNthCalledWith(2, 'nola-small-v3')
  })

  it('opens detail on row click without hijacking action buttons', async () => {
    const onOpenDetail = vi.fn()
    const onSelect = vi.fn()

    renderModelList({
      models: [createModel({ model_id: 'nola-base-v3', name: 'Nola Base V3' })],
      onSelect,
      onOpenDetail,
    })

    const row = screen.getByRole('row', { name: /Nola Base V3/i })
    fireEvent.click(row)
    expect(onOpenDetail).toHaveBeenCalledWith('nola-base-v3')

    openRowActionMenu('More actions for Nola Base V3')
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Set as Default' }))
    expect(onSelect).toHaveBeenCalledWith('nola-base-v3')
    expect(onOpenDetail).toHaveBeenCalledTimes(1)
  })
})
