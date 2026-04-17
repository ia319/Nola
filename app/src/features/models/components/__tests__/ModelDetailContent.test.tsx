// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { DownloadState, ModelResponse } from '@/features/models'

import { ModelDetailContent } from '../ModelDetailContent'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, _params?: Record<string, unknown>) => {
      const messages: Record<string, string> = {
        'models.fields.accuracy': 'Accuracy',
        'models.fields.speed': 'Speed',
        'models.fields.size': 'Size',
        'models.fields.diskUsage': 'Disk Usage',
        'models.fields.languages': 'Languages',
        'models.fields.unavailable': '—',
        'models.detail.activeDownload': 'Active download',
        'models.detail.activeDownloadDescription': 'Download progress shown from the live feed.',
        'models.detail.performanceHint': 'Backend ranks are relative hints, not exact benchmarks.',
        'models.detail.sections.performance': 'Performance Metrics',
        'models.detail.sections.information': 'Model Information',
        'models.detail.sections.description': 'Description',
        'models.detail.localState.status': 'Status',
        'models.detail.localState.selection': 'Selection',
        'models.detail.localState.runtime': 'Runtime',
        'models.detail.localState.selectionConfigured': 'Current default model',
        'models.detail.localState.selectionAvailable': 'Available to select',
        'models.detail.localState.runtimeLoaded': 'Loaded in runtime',
        'models.detail.localState.runtimeIdle': 'Not loaded',
        'models.detail.fields.repoId': 'Repository ID',
        'models.detail.fields.runtime': 'Runtime',
        'models.detail.actions.copyRepoId': 'Copy repository ID',
        'models.status.downloaded': 'Downloaded',
        'models.status.downloading': 'Downloading',
        'models.catalog.largeV3.description': 'Localized large model description.',
        'models.rank.2': 'Fast',
        'models.accuracyRank.5': 'Very High',
      }

      return messages[key] ?? key
    },
  }),
}))

function createModel(overrides: Partial<ModelResponse> = {}): ModelResponse {
  return {
    model_id: 'large-v3',
    name: 'Large V3',
    size_bytes: 3_100_000_000,
    repo_id: 'Systran/faster-whisper-large-v3',
    languages: 'en, zh',
    speed_rank: 2,
    accuracy_rank: 5,
    description: 'High-fidelity multilingual transcription model.',
    description_key: 'models.catalog.largeV3.description',
    status: 'downloaded',
    disk_usage: 3_100_000_000,
    is_configured: true,
    is_last_loaded: true,
    download_progress: null,
    ...overrides,
  }
}

function createDownloadState(overrides: Partial<DownloadState> = {}): DownloadState {
  return {
    status: 'downloading',
    percent: 45.5,
    downloadedBytes: 1_000_000_000,
    totalBytes: 3_100_000_000,
    speedBps: 25_000_000,
    error: null,
    ...overrides,
  }
}

describe('ModelDetailContent', () => {
  it('renders model information and delegates repository copy', () => {
    const onCopyRepoId = vi.fn()

    render(
      <ModelDetailContent
        model={createModel()}
        downloadState={createDownloadState()}
        onCopyRepoId={onCopyRepoId}
      />,
    )

    expect(screen.getByText('Performance Metrics')).toBeTruthy()
    expect(screen.getByText('Model Information')).toBeTruthy()
    expect(screen.getByText('Description')).toBeTruthy()
    expect(screen.getByText('Repository ID')).toBeTruthy()
    expect(screen.getByText('Systran/faster-whisper-large-v3')).toBeTruthy()
    expect(screen.getAllByText('2956.4 MB')).toHaveLength(2)
    expect(screen.getByText('Downloading')).toBeTruthy()
    expect(screen.getByText('Current default model')).toBeTruthy()
    expect(screen.getByText('Loaded in runtime')).toBeTruthy()
    expect(screen.getByText('Active download')).toBeTruthy()
    expect(screen.getByText('Download progress shown from the live feed.')).toBeTruthy()
    expect(screen.getByText('Localized large model description.')).toBeTruthy()
    expect(screen.getByText('en')).toBeTruthy()
    expect(screen.getByText('zh')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Copy repository ID' }))

    expect(onCopyRepoId).toHaveBeenCalledWith('Systran/faster-whisper-large-v3')
  })
})
