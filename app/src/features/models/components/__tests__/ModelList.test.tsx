// @vitest-environment jsdom

import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { DownloadState } from '@/features/models'
import type { ModelResponse } from '@/shared/types'

import { ModelList } from '../ModelList'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
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
        'models.table.empty.title': 'No models available',
        'models.table.empty.description': 'Download a model to start configuring local runs.',
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

describe('ModelList', () => {
  it('renders an empty state when no models are available', () => {
    render(
      <ModelList
        models={[]}
        downloads={new Map()}
        onDownload={vi.fn()}
        onCancel={vi.fn()}
        onDelete={vi.fn()}
        onSelect={vi.fn()}
      />,
    )

    expect(screen.getByText('No models available')).toBeTruthy()
    expect(screen.getByText('Download a model to start configuring local runs.')).toBeTruthy()
  })

  it('renders model rows with table columns and action variants', () => {
    const onDownload = vi.fn()
    const onCancel = vi.fn()
    const onDelete = vi.fn()
    const onSelect = vi.fn()
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

    render(
      <ModelList
        models={[pendingModel, configuredModel, downloadingModel, selectableModel]}
        downloads={new Map([['nola-medium-v3', createDownloadState()]])}
        onDownload={onDownload}
        onCancel={onCancel}
        onDelete={onDelete}
        onSelect={onSelect}
      />,
    )

    expect(screen.getByText('Name')).toBeTruthy()
    expect(screen.getByText('Supported Languages')).toBeTruthy()
    expect(screen.getByText('Size')).toBeTruthy()
    expect(screen.getByText('Status')).toBeTruthy()
    expect(screen.getByText('Profile')).toBeTruthy()
    expect(screen.getByText('Actions')).toBeTruthy()

    const configuredRow = screen.getByRole('row', { name: /Nola Large V3/i })
    expect(within(configuredRow).getAllByText('Default')).toHaveLength(2)
    expect(within(configuredRow).getByText('Running')).toBeTruthy()
    expect(within(configuredRow).getByText('en')).toBeTruthy()
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
    expect(within(pendingRow).getByRole('button', { name: 'Download' })).toBeTruthy()
    expect(within(pendingRow).getByRole('button', { name: 'Delete' })).toBeTruthy()
    expect(within(pendingRow).getByText('Accuracy 3 · Speed 4')).toBeTruthy()

    const selectableRow = screen.getByRole('row', { name: /Nola Base V3/i })
    expect(within(selectableRow).getByRole('button', { name: 'Set as Default' })).toBeTruthy()
    expect(within(selectableRow).getByRole('button', { name: 'Delete' })).toBeTruthy()
  })
})
