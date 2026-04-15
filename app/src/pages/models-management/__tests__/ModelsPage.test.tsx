// @vitest-environment jsdom

import type { ReactNode } from 'react'

import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { DownloadState } from '@/features/models'

const modelsPageMocks = vi.hoisted(() => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
  modelList: vi.fn(),
  useModels: vi.fn(),
  useModelDownload: vi.fn(),
  deleteModel: vi.fn(),
  selectModel: vi.fn(),
  toDownloadState: vi.fn(),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const messages: Record<string, string> = {
        'models.title': 'Models',
        'models.description': 'Manage local transcription models, downloads, and defaults.',
        'models.loading': 'Loading models...',
        'models.overview.region': 'Models overview',
        'models.overview.activeEngine.title': 'Active Engine',
        'models.overview.activeEngine.empty': 'No active engine',
        'models.overview.activeEngine.emptyDescription': 'No model has been loaded yet.',
        'models.overview.defaultModel.title': 'Default Model',
        'models.overview.defaultModel.empty': 'No default model',
        'models.overview.defaultModel.emptyDescription':
          'Select a downloaded model as the default.',
        'models.overview.storagePath.title': 'Storage Path',
        'models.overview.storagePath.empty': 'Path unavailable',
        'models.overview.storagePath.placeholder': 'Hidden for now',
        'models.overview.storagePath.meta': 'Path display is temporarily hidden.',
        'models.toast.actionFailed': 'Model action failed, please retry',
        'error.api.serverError': 'Server error',
      }

      if (key === 'models.toast.downloadStarted') {
        return `Download started: ${String(params?.modelId)}`
      }

      if (key === 'models.toast.downloadCancelled') {
        return `Download cancelled: ${String(params?.modelId)}`
      }

      if (key === 'models.toast.deleted') {
        return `Model deleted: ${String(params?.modelId)}`
      }

      if (key === 'models.toast.selected') {
        return `Default model set to ${String(params?.modelId)}`
      }

      if (key === 'models.overview.activeEngine.meta') {
        return `Current runtime: ${String(params?.modelId)}`
      }

      if (key === 'models.overview.defaultModel.meta') {
        return `Configured as ${String(params?.modelId)}`
      }

      return messages[key] ?? key
    },
  }),
}))

vi.mock('sonner', () => ({
  toast: modelsPageMocks.toast,
}))

vi.mock('@/components/common', () => ({
  ErrorBoundary: ({ children }: { children: ReactNode }) => children,
}))

vi.mock('@/features/models', () => ({
  deleteModel: modelsPageMocks.deleteModel,
  ModelList: (props: {
    models: Array<{ model_id: string }>
    downloads: Map<string, DownloadState>
  }) => {
    modelsPageMocks.modelList(props)
    return (
      <div
        data-slot="mock-model-list"
        data-count={String(props.models.length)}
        data-downloads={String(props.downloads.size)}
      >
        model list
      </div>
    )
  },
  selectModel: modelsPageMocks.selectModel,
  toDownloadState: modelsPageMocks.toDownloadState,
  useModelDownload: modelsPageMocks.useModelDownload,
  useModels: modelsPageMocks.useModels,
}))

import { ModelsPage } from '../ModelsPage'

function getCardFromHeading(text: string): HTMLElement {
  const card = screen.getByText(text).closest('[data-slot="card"]')
  if (!(card instanceof HTMLElement)) {
    throw new Error(`${text} card not found`)
  }
  return card
}

describe('ModelsPage', () => {
  beforeEach(() => {
    modelsPageMocks.toast.success.mockReset()
    modelsPageMocks.toast.error.mockReset()
    modelsPageMocks.toast.warning.mockReset()
    modelsPageMocks.modelList.mockReset()
    modelsPageMocks.useModels.mockReset()
    modelsPageMocks.useModelDownload.mockReset()
    modelsPageMocks.deleteModel.mockReset()
    modelsPageMocks.selectModel.mockReset()
    modelsPageMocks.toDownloadState.mockReset()

    modelsPageMocks.useModels.mockReturnValue({
      models: [
        {
          model_id: 'nola-large-v3',
          name: 'Nola Large V3',
          description: 'Large multilingual engine',
          repo_id: 'nola/large-v3',
          size_bytes: 3_100_000_000,
          disk_usage: 3_100_000_000,
          status: 'downloaded',
          accuracy_rank: 5,
          speed_rank: 2,
          languages: ['en'],
          is_configured: true,
          is_last_loaded: true,
          download_progress: null,
        },
      ],
      configuredModelId: 'nola-large-v3',
      lastLoadedModelId: 'nola-large-v3',
      effectiveModelDir: '/models',
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    })

    modelsPageMocks.useModelDownload.mockReturnValue({
      downloads: new Map(),
      download: vi.fn(),
      cancel: vi.fn(),
    })
  })

  it('renders the models page inside the shared workspace layout', () => {
    render(<ModelsPage />)

    const page = screen.getByRole('main')
    expect(page.getAttribute('data-slot')).toBe('models-page')
    expect(page.className).toContain('max-w-none')
    expect(page.className).toContain('flex-1')

    expect(screen.getByRole('heading', { level: 1, name: 'Models' })).toBeTruthy()
    expect(
      screen.getByText('Manage local transcription models, downloads, and defaults.'),
    ).toBeTruthy()

    const activeEngineCard = getCardFromHeading('Active Engine')
    expect(within(activeEngineCard).getByText('Nola Large V3')).toBeTruthy()
    expect(within(activeEngineCard).getByText('Current runtime: nola-large-v3')).toBeTruthy()

    const defaultModelCard = getCardFromHeading('Default Model')
    expect(within(defaultModelCard).getByText('Nola Large V3')).toBeTruthy()
    expect(within(defaultModelCard).getByText('Configured as nola-large-v3')).toBeTruthy()

    const storagePathCard = getCardFromHeading('Storage Path')
    expect(within(storagePathCard).getByText('Hidden for now')).toBeTruthy()
    expect(within(storagePathCard).getByText('Path display is temporarily hidden.')).toBeTruthy()
    expect(screen.getByText('model list')).toBeTruthy()
  })

  it('shows the loading state before models are ready', () => {
    modelsPageMocks.useModels.mockReturnValue({
      models: [],
      configuredModelId: null,
      lastLoadedModelId: null,
      effectiveModelDir: '',
      isLoading: true,
      error: null,
      refresh: vi.fn(),
    })

    render(<ModelsPage />)

    expect(screen.getByText('Loading models...')).toBeTruthy()
  })

  it('shows the translated error state when model loading fails', () => {
    modelsPageMocks.useModels.mockReturnValue({
      models: [],
      configuredModelId: null,
      lastLoadedModelId: null,
      effectiveModelDir: '',
      isLoading: false,
      error: {
        code: 'API_SERVER_UNKNOWN',
        i18nKey: 'error.api.serverError',
        retriable: true,
      },
      refresh: vi.fn(),
    })

    render(<ModelsPage />)

    expect(screen.getByText('Server error')).toBeTruthy()
  })
})
