// @vitest-environment jsdom

import type { ReactNode } from 'react'

import { render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  deleteModel,
  getModelSettings,
  ModelListProps,
  ModelListResponse,
  ModelResponse,
  ModelSettingsResponse,
  selectModel,
  UseModelDownloadResult,
  useModelDownload,
  UseModelsResult,
  useModels,
} from '@/features/models'

type UpdateModelsSnapshot = UseModelsResult['updateSnapshot']

const modelsPageMocks = vi.hoisted(() => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
  modelList: vi.fn<(props: ModelListProps) => void>(),
  useModels: vi.fn<typeof useModels>(),
  useModelDownload: vi.fn<typeof useModelDownload>(),
  deleteModel: vi.fn<typeof deleteModel>(),
  getModelSettings: vi.fn<typeof getModelSettings>(),
  selectModel: vi.fn<typeof selectModel>(),
  getModelDetail: vi.fn(),
  getModelActionState: vi.fn(),
  requestModelRefresh: vi.fn(),
  toDownloadState: vi.fn(),
  refreshConfigCaches: vi.fn<() => Promise<void>>(),
  refreshModels: vi.fn(),
  updateSnapshot: vi.fn<UpdateModelsSnapshot>(),
  downloadModel: vi.fn<UseModelDownloadResult['download']>(),
  cancelDownload: vi.fn<UseModelDownloadResult['cancel']>(),
  queryClient: {
    invalidateQueries: vi.fn(),
    setQueryData: vi.fn(),
  },
}))

type TranslationParams = Record<string, string | number | boolean | null | undefined>

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: TranslationParams) => {
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
        'error.generic': 'An error occurred',
        'error.boundary.retry': 'Try Again',
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

vi.mock('@/config/cache-invalidation', () => ({
  refreshConfigCaches: modelsPageMocks.refreshConfigCaches,
}))

vi.mock('@/features/models', () => ({
  DEFAULT_MODEL_LIST_QUERY: {
    q: '',
    status: 'all',
    sort_by: null,
    order: 'asc',
  },
  deleteModel: modelsPageMocks.deleteModel,
  getModelSettings: modelsPageMocks.getModelSettings,
  ModelList: (props: ModelListProps) => {
    modelsPageMocks.modelList(props)
    return (
      <div
        data-slot="mock-model-list"
        data-count={String(props.models.length)}
        data-downloads={String(props.downloads.size)}
        data-loading={String(Boolean(props.isLoading))}
      >
        {props.errorMessage ?? (props.isLoading ? 'Loading models...' : 'model list')}
      </div>
    )
  },
  requestModelRefresh: modelsPageMocks.requestModelRefresh,
  selectModel: modelsPageMocks.selectModel,
  getModelDetail: modelsPageMocks.getModelDetail,
  getModelActionState: modelsPageMocks.getModelActionState,
  ModelDetailContent: () => <div>model detail</div>,
  toDownloadState: modelsPageMocks.toDownloadState,
  useModelDownload: modelsPageMocks.useModelDownload,
  useModels: modelsPageMocks.useModels,
}))

vi.mock('@/shared/lib/query-client', () => ({
  queryClient: modelsPageMocks.queryClient,
}))

import { ModelsPage } from '../ModelsPage'

function createModel(overrides: Partial<ModelResponse> = {}): ModelResponse {
  return {
    model_id: 'nola-large-v3',
    name: 'Nola Large V3',
    description: 'Large multilingual engine',
    description_key: 'models.catalog.largeV3.description',
    repo_id: 'nola/large-v3',
    size_bytes: 3_100_000_000,
    disk_usage: 3_100_000_000,
    status: 'downloaded',
    accuracy_rank: 5,
    speed_rank: 2,
    languages: 'en',
    is_configured: true,
    is_last_loaded: true,
    download_progress: null,
    ...overrides,
  }
}

function createModelListResponse(overrides: Partial<ModelListResponse> = {}): ModelListResponse {
  return {
    models: [createModel()],
    configured_model_id: 'nola-large-v3',
    last_loaded_model_id: 'nola-large-v3',
    effective_model_dir: '/models',
    ...overrides,
  }
}

function createModelSettingsResponse(
  overrides: Partial<ModelSettingsResponse> = {},
): ModelSettingsResponse {
  return {
    configured_model_id: 'nola-base-v3',
    last_loaded_model_id: 'nola-large-v3',
    configured_model_dir: null,
    effective_model_dir: '/models',
    override_source: 'default',
    restart_required: false,
    ...overrides,
  }
}

function getCardFromHeading(text: string): HTMLElement {
  const card = screen.getByText(text).closest('[data-slot="card"]')
  if (!(card instanceof HTMLElement)) {
    throw new Error(`${text} card not found`)
  }
  return card
}

function getModelListProps(): ModelListProps {
  const props = modelsPageMocks.modelList.mock.calls.at(-1)?.[0]
  if (!props) {
    throw new Error('Expected ModelList props to be captured')
  }
  return props
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
    modelsPageMocks.getModelSettings.mockReset()
    modelsPageMocks.selectModel.mockReset()
    modelsPageMocks.getModelDetail.mockReset()
    modelsPageMocks.getModelActionState.mockReset()
    modelsPageMocks.requestModelRefresh.mockReset()
    modelsPageMocks.toDownloadState.mockReset()
    modelsPageMocks.refreshConfigCaches.mockReset()
    modelsPageMocks.refreshModels.mockReset()
    modelsPageMocks.updateSnapshot.mockReset()
    modelsPageMocks.downloadModel.mockReset()
    modelsPageMocks.cancelDownload.mockReset()
    modelsPageMocks.queryClient.invalidateQueries.mockReset()
    modelsPageMocks.queryClient.setQueryData.mockReset()

    modelsPageMocks.useModels.mockReturnValue({
      models: [createModel()],
      configuredModelId: 'nola-large-v3',
      lastLoadedModelId: 'nola-large-v3',
      effectiveModelDir: '/models',
      isLoading: false,
      isRefreshing: false,
      hasLoaded: true,
      error: null,
      refresh: modelsPageMocks.refreshModels,
      updateSnapshot: modelsPageMocks.updateSnapshot,
    })

    modelsPageMocks.downloadModel.mockResolvedValue(undefined)
    modelsPageMocks.cancelDownload.mockResolvedValue(undefined)
    modelsPageMocks.deleteModel.mockResolvedValue({
      model_id: 'nola-large-v3',
      message: 'deleted',
    })
    modelsPageMocks.selectModel.mockResolvedValue({
      configured_model_id: 'nola-base-v3',
      restart_required: false,
      message: 'selected',
    })
    modelsPageMocks.getModelSettings.mockResolvedValue(createModelSettingsResponse())
    modelsPageMocks.refreshConfigCaches.mockResolvedValue(undefined)
    modelsPageMocks.useModelDownload.mockReturnValue({
      downloads: new Map(),
      download: modelsPageMocks.downloadModel,
      cancel: modelsPageMocks.cancelDownload,
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
      isRefreshing: false,
      hasLoaded: false,
      error: null,
      refresh: modelsPageMocks.refreshModels,
      updateSnapshot: modelsPageMocks.updateSnapshot,
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
      isRefreshing: false,
      hasLoaded: false,
      error: {
        code: 'API_SERVER_UNKNOWN',
        i18nKey: 'error.api.serverError',
        retriable: true,
      },
      refresh: modelsPageMocks.refreshModels,
      updateSnapshot: modelsPageMocks.updateSnapshot,
    })

    render(<ModelsPage />)

    expect(screen.getByText('Server error')).toBeTruthy()
  })

  it('wires download and cancel actions through ModelList', async () => {
    render(<ModelsPage />)

    const modelListProps = getModelListProps()
    await modelListProps.onDownload('nola-large-v3')
    await modelListProps.onCancel('nola-large-v3')

    expect(modelsPageMocks.downloadModel).toHaveBeenCalledWith('nola-large-v3')
    expect(modelsPageMocks.cancelDownload).toHaveBeenCalledWith('nola-large-v3')
    expect(modelsPageMocks.toast.success).toHaveBeenCalledWith('Download started: nola-large-v3')
    expect(modelsPageMocks.queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['models', 'downloads'],
    })
  })

  it('ignores duplicate model actions while the first request is pending', async () => {
    let resolveDownload: () => void = () => {
      throw new Error('Expected download promise resolver to be assigned')
    }
    modelsPageMocks.downloadModel.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveDownload = () => resolve()
      }),
    )

    render(<ModelsPage />)

    const modelListProps = getModelListProps()
    const firstDownload = modelListProps.onDownload('nola-large-v3')
    const secondDownload = modelListProps.onDownload('nola-large-v3')

    expect(modelsPageMocks.downloadModel).toHaveBeenCalledTimes(1)

    resolveDownload()
    await firstDownload
    await secondDownload
  })

  it('wires model deletion through snapshot updates and refresh notifications', async () => {
    render(<ModelsPage />)

    await getModelListProps().onDelete('nola-large-v3')

    expect(modelsPageMocks.deleteModel).toHaveBeenCalledWith('nola-large-v3')
    expect(modelsPageMocks.updateSnapshot).toHaveBeenCalledTimes(2)

    const updateSnapshot = modelsPageMocks.updateSnapshot.mock.calls[0]?.[0]
    if (typeof updateSnapshot !== 'function') {
      throw new Error('Expected updateSnapshot to receive an updater')
    }

    const nextSnapshot = updateSnapshot(
      createModelListResponse({
        models: [
          createModel({ model_id: 'nola-large-v3' }),
          createModel({ model_id: 'nola-base-v3', is_configured: false }),
        ],
      }),
    )
    expect(nextSnapshot.models.map((model) => model.model_id)).toEqual(['nola-base-v3'])
    expect(modelsPageMocks.toast.success).toHaveBeenCalledWith('Model deleted: nola-large-v3')
    expect(modelsPageMocks.requestModelRefresh).toHaveBeenCalledTimes(1)
  })

  it('wires model selection through snapshot updates and settings cache refresh', async () => {
    const settings = createModelSettingsResponse({ restart_required: false })
    modelsPageMocks.selectModel.mockResolvedValueOnce({
      configured_model_id: 'nola-base-v3',
      restart_required: false,
      message: 'selected',
    })
    modelsPageMocks.getModelSettings.mockResolvedValueOnce(settings)

    render(<ModelsPage />)

    await getModelListProps().onSelect('base')

    expect(modelsPageMocks.selectModel).toHaveBeenCalledWith('base')
    expect(modelsPageMocks.updateSnapshot).toHaveBeenCalledTimes(2)

    const updateSnapshot = modelsPageMocks.updateSnapshot.mock.calls[0]?.[0]
    if (typeof updateSnapshot !== 'function') {
      throw new Error('Expected updateSnapshot to receive an updater')
    }

    const nextSnapshot = updateSnapshot(
      createModelListResponse({
        models: [
          createModel({ model_id: 'nola-large-v3', is_configured: true }),
          createModel({ model_id: 'nola-base-v3', is_configured: false }),
        ],
      }),
    )

    expect(nextSnapshot.configured_model_id).toBe('nola-base-v3')
    expect(
      nextSnapshot.models.find((model) => model.model_id === 'nola-base-v3')?.is_configured,
    ).toBe(true)
    expect(
      nextSnapshot.models.find((model) => model.model_id === 'nola-large-v3')?.is_configured,
    ).toBe(false)

    await waitFor(() => {
      expect(modelsPageMocks.queryClient.setQueryData).toHaveBeenCalledWith(
        ['models', 'settings'],
        settings,
      )
    })
    expect(modelsPageMocks.toast.success).toHaveBeenCalledWith('Default model set to nola-base-v3')
    expect(modelsPageMocks.toast.warning).not.toHaveBeenCalled()
    expect(modelsPageMocks.requestModelRefresh).toHaveBeenCalledTimes(1)
    expect(modelsPageMocks.refreshConfigCaches).toHaveBeenCalledTimes(1)
    expect(modelsPageMocks.queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['models', 'detail', 'base'],
    })
    expect(modelsPageMocks.queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['models', 'detail', 'nola-base-v3'],
    })
  })
})
