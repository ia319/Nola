// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { UseAppConfigReturn } from '@/config/use-app-config'
import type { UseModelsResult } from '@/features/models'
import type { UseTranscriptionOptionsReturn } from '@/features/transcription-options'
import type {
  AdvancedOptionValue,
  AdvancedTranscriptionOptions,
} from '@/features/transcription-options'
import type {
  AppConfig,
  AppError,
  EngineDefaults,
  SessionDefaults,
  SessionDefaultsUpdateRequest,
  TranscriptionDefaults,
} from '@/shared/types'
import { TEST_ENGINE_SCHEMA } from '@/test-utils/engine-schema'
import { buildTranscriptionDefaults } from '@/test-utils/transcription-defaults'
import { TaskWorkbenchSessionConfig } from '../TaskWorkbenchSessionConfig'

const taskWorkbenchSessionConfigMocks = vi.hoisted(() => ({
  useAppConfigMock: vi.fn<() => UseAppConfigReturn>(),
  refreshConfigCachesMock: vi.fn<() => Promise<AppConfig>>(),
  useModelsMock: vi.fn<() => UseModelsResult>(),
  useTranscriptionOptionsMock: vi.fn<() => UseTranscriptionOptionsReturn>(),
  fetchEngineDefaultsMock: vi.fn<() => Promise<EngineDefaults>>(),
  fetchSessionDefaultsMock: vi.fn<(signal?: AbortSignal) => Promise<SessionDefaults>>(),
  patchSessionDefaultsMock:
    vi.fn<(payload: SessionDefaultsUpdateRequest) => Promise<SessionDefaults>>(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
  toastWarningMock: vi.fn(),
  onCreateTaskMock: vi.fn(),
  onTasksCreatedMock: vi.fn(),
  buildRequestMock: vi.fn(),
  setLanguageMock: vi.fn(),
  setTaskMock: vi.fn(),
  setAdvancedOptionMock: vi.fn(),
  resetAdvancedOptionsMock: vi.fn(),
  resetOptionOverridesMock: vi.fn(),
  setInitialPromptMock: vi.fn(),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const messages: Record<string, string> = {
        'options.language.label': 'Language',
        'options.language.auto': 'Auto Detect',
        'options.language.en': 'English',
        'options.task.label': 'Task',
        'options.task.transcribe': 'Transcribe',
        'options.task.translate': 'Translate',
        'options.field.initialPrompt': 'Initial Prompt',
        'options.creating': 'Creating',
        'options.startDisabled': 'Start Transcription',
        'options.defaults.saved': 'Defaults saved',
        'options.defaults.savedRefreshFailed':
          'Defaults saved. Refresh the page to load the latest values.',
        'tasks.workbench.sections.sessionConfig.title': 'Session Configuration',
        'tasks.workbench.sessionConfig.globalSettings': 'Global Settings',
        'tasks.workbench.sessionConfig.executionEngine': 'Execution Engine',
        'tasks.workbench.sessionConfig.sessionOverride': 'Task execution',
        'tasks.workbench.sessionConfig.model.label': 'Model',
        'tasks.workbench.sessionConfig.model.badge': 'Task model',
        'tasks.workbench.sessionConfig.model.loading': 'Loading models',
        'tasks.workbench.sessionConfig.model.placeholder': 'Select a downloaded model',
        'tasks.workbench.sessionConfig.model.noDownloaded': 'No downloaded models',
        'tasks.workbench.sessionConfig.device.label': 'Device',
        'tasks.workbench.sessionConfig.device.options.auto': 'Auto',
        'tasks.workbench.sessionConfig.device.options.cpu': 'CPU',
        'tasks.workbench.sessionConfig.device.options.cuda': 'CUDA',
        'tasks.workbench.sessionConfig.computeType.label': 'Compute Type',
        'tasks.workbench.sessionConfig.computeType.options.default': 'Default',
        'tasks.workbench.sessionConfig.computeType.options.float16': 'Float16',
        'tasks.workbench.sessionConfig.computeType.options.int8': 'Int8',
        'tasks.workbench.sessionConfig.unavailable': 'Unavailable',
        'tasks.workbench.sessionConfig.advanced.button': 'Advanced Parameters',
        'tasks.workbench.advancedSheet.title': 'Advanced Configuration',
        'tasks.workbench.advancedSheet.description':
          'Fine-tune session overrides and execution settings.',
        'tasks.workbench.advancedSheet.close': 'Close',
        'tasks.workbench.advancedSheet.cancel': 'Cancel',
        'tasks.workbench.advancedSheet.apply': 'Apply Changes',
        'tasks.workbench.advancedSheet.reset': 'Reset to Defaults',
        'tasks.workbench.advancedSheet.saveDefault': 'Save as Task Defaults',
        'tasks.workbench.advancedSheet.savingDefault': 'Saving...',
      }

      if (key === 'options.start') {
        return `Start ${String(params?.count)} Selected Tasks`
      }

      if (key === 'tasks.workbench.sessionConfig.advanced.overrides') {
        return `${String(params?.count)} overrides`
      }

      return messages[key] ?? key
    },
  }),
}))

vi.mock('sonner', () => ({
  toast: {
    success: taskWorkbenchSessionConfigMocks.toastSuccessMock,
    error: taskWorkbenchSessionConfigMocks.toastErrorMock,
    warning: taskWorkbenchSessionConfigMocks.toastWarningMock,
  },
}))

vi.mock('@/config/logger', () => ({
  default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@/config/api', () => ({
  fetchEngineDefaults: taskWorkbenchSessionConfigMocks.fetchEngineDefaultsMock,
  fetchSessionDefaults: taskWorkbenchSessionConfigMocks.fetchSessionDefaultsMock,
  patchSessionDefaults: taskWorkbenchSessionConfigMocks.patchSessionDefaultsMock,
}))

vi.mock('@/config/cache-invalidation', () => ({
  refreshConfigCaches: () => taskWorkbenchSessionConfigMocks.refreshConfigCachesMock(),
}))

vi.mock('@/config/use-app-config', () => ({
  useAppConfig: taskWorkbenchSessionConfigMocks.useAppConfigMock,
}))

vi.mock('@/features/models', () => ({
  useModels: taskWorkbenchSessionConfigMocks.useModelsMock,
}))

vi.mock('@/features/transcription-options', () => ({
  useTranscriptionOptions: taskWorkbenchSessionConfigMocks.useTranscriptionOptionsMock,
  AdvancedOptions: ({
    advancedOptions,
    onOptionChange,
  }: {
    advancedOptions: AdvancedTranscriptionOptions
    onOptionChange: (key: string, value: AdvancedOptionValue | undefined) => void
  }) => (
    <div data-testid="advanced-options" data-beam-size={String(advancedOptions.beam_size ?? '')}>
      <button type="button" onClick={() => onOptionChange('beam_size', 9)}>
        Change Beam Size
      </button>
    </div>
  ),
}))

function buildDefaults(overrides: Partial<TranscriptionDefaults> = {}): TranscriptionDefaults {
  return buildTranscriptionDefaults(overrides)
}

function buildAppConfigReturn(
  overrides: Partial<AppConfig> = {},
): UseAppConfigReturn & { config: AppConfig } {
  return {
    config: {
      engine: {
        model_size: 'large-v3',
        device: 'cuda',
        compute_type: 'float16',
        is_multilingual: true,
        schema: TEST_ENGINE_SCHEMA,
      },
      transcription: { defaults: buildDefaults(), schema: [] },
      file: { allowed_extensions: [], allowed_mime_types: [], max_file_size: 0 },
      effective_languages: [{ code: 'en', label_key: 'options.language.en' }],
      ...overrides,
      live_realtime: overrides.live_realtime ?? {
        runtime_adapter: 'whisper_streaming',
        supports_runtime_overrides: true,
      },
    },
    fileValidationConfig: { allowedExtensions: [], allowedMimeTypes: [], maxFileSize: 0 },
    isLoading: false,
  }
}

function buildModelsReturn(): UseModelsResult {
  return {
    models: [
      {
        model_id: 'large-v3',
        name: 'Large V3',
        size_bytes: 1,
        repo_id: 'repo',
        languages: 'multilingual',
        speed_rank: 5,
        accuracy_rank: 9,
        description: 'desc',
        description_key: 'models.catalog.largeV3.description',
        status: 'downloaded',
        disk_usage: 1,
        is_configured: true,
        is_last_loaded: true,
        download_progress: null,
      },
    ],
    configuredModelId: 'large-v3',
    lastLoadedModelId: 'large-v3',
    effectiveModelDir: 'D:/models',
    isLoading: false,
    isRefreshing: false,
    hasLoaded: true,
    error: null,
    refresh: vi.fn(),
    updateSnapshot: vi.fn(),
  }
}

function buildTranscriptionOptionsReturn(
  overrides: Partial<UseTranscriptionOptionsReturn> = {},
): UseTranscriptionOptionsReturn {
  return {
    language: 'en',
    task: 'transcribe',
    advancedOptions: { beam_size: 7 },
    defaults: buildDefaults(),
    setLanguage: taskWorkbenchSessionConfigMocks.setLanguageMock,
    setTask: taskWorkbenchSessionConfigMocks.setTaskMock,
    setAdvancedOption: taskWorkbenchSessionConfigMocks.setAdvancedOptionMock,
    resetAdvancedOptions: taskWorkbenchSessionConfigMocks.resetAdvancedOptionsMock,
    resetOptionOverrides: taskWorkbenchSessionConfigMocks.resetOptionOverridesMock,
    buildRequest: taskWorkbenchSessionConfigMocks.buildRequestMock,
    initialPrompt: undefined,
    setInitialPrompt: taskWorkbenchSessionConfigMocks.setInitialPromptMock,
    ...overrides,
  }
}

function requireTextAreaElement(value: HTMLElement, label: string): HTMLTextAreaElement {
  if (value instanceof HTMLTextAreaElement) return value
  throw new Error(`Expected ${label} to be a textarea`)
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
}

function renderSessionConfig(props: {
  fileIds: string[]
  onCreateTask?: typeof taskWorkbenchSessionConfigMocks.onCreateTaskMock
  onTasksCreated?: typeof taskWorkbenchSessionConfigMocks.onTasksCreatedMock
  disabled?: boolean
}) {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <TaskWorkbenchSessionConfig
        fileIds={props.fileIds}
        onCreateTask={props.onCreateTask ?? taskWorkbenchSessionConfigMocks.onCreateTaskMock}
        onTasksCreated={props.onTasksCreated ?? taskWorkbenchSessionConfigMocks.onTasksCreatedMock}
        disabled={props.disabled}
      />
    </QueryClientProvider>,
  )
}

describe('TaskWorkbenchSessionConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    taskWorkbenchSessionConfigMocks.useAppConfigMock.mockReturnValue(buildAppConfigReturn())
    taskWorkbenchSessionConfigMocks.useModelsMock.mockReturnValue(buildModelsReturn())
    taskWorkbenchSessionConfigMocks.useTranscriptionOptionsMock.mockReturnValue(
      buildTranscriptionOptionsReturn(),
    )
    taskWorkbenchSessionConfigMocks.buildRequestMock.mockImplementation((fileId: string) => ({
      file_id: fileId,
    }))
    taskWorkbenchSessionConfigMocks.fetchEngineDefaultsMock.mockResolvedValue({
      defaults: buildDefaults(),
    })
    taskWorkbenchSessionConfigMocks.fetchSessionDefaultsMock.mockResolvedValue({
      execution: {
        model_id: 'large-v3',
        device: 'auto',
        compute_type: 'default',
      },
      transcription: buildDefaults(),
    })
    taskWorkbenchSessionConfigMocks.patchSessionDefaultsMock.mockResolvedValue({
      execution: {
        model_id: 'large-v3',
        device: 'auto',
        compute_type: 'default',
      },
      transcription: buildDefaults(),
    })
    taskWorkbenchSessionConfigMocks.refreshConfigCachesMock.mockResolvedValue(
      buildAppConfigReturn().config,
    )
  })

  it('renders the planned session config layout and current execution engine values', async () => {
    renderSessionConfig({ fileIds: ['file-1', 'file-2'] })

    expect(screen.getByRole('heading', { name: 'Session Configuration', level: 2 })).toBeTruthy()
    expect(screen.getByText('Global Settings')).toBeTruthy()
    expect(screen.getByText('Execution Engine')).toBeTruthy()
    expect(screen.getByLabelText('Language')).toBeTruthy()
    expect(screen.getByLabelText('Task')).toBeTruthy()
    expect(screen.getByLabelText('Model')).toBeTruthy()
    await waitFor(() => {
      expect(screen.getByText('Large V3')).toBeTruthy()
    })
    expect(screen.getByText('Auto')).toBeTruthy()
    expect(screen.getByText('Default')).toBeTruthy()
    expect(screen.getByText('1 overrides')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Start 2 Selected Tasks' })).toBeTruthy()
  })

  it('counts only effective advanced overrides in the summary badge', () => {
    const defaults = buildDefaults({
      initial_prompt: null,
      without_timestamps: false,
    })
    taskWorkbenchSessionConfigMocks.useTranscriptionOptionsMock.mockReturnValue(
      buildTranscriptionOptionsReturn({
        defaults,
        advancedOptions: { without_timestamps: false },
        initialPrompt: null,
      }),
    )

    renderSessionConfig({ fileIds: ['file-1'] })

    expect(screen.getByText('0 overrides')).toBeTruthy()
  })

  it('does not display the first downloaded model when default and runtime ids are unavailable', async () => {
    taskWorkbenchSessionConfigMocks.useAppConfigMock.mockReturnValue(
      buildAppConfigReturn({
        engine: {
          model_size: 'tiny',
          device: 'cuda',
          compute_type: 'float16',
          is_multilingual: true,
          schema: TEST_ENGINE_SCHEMA,
        },
      }),
    )
    taskWorkbenchSessionConfigMocks.fetchSessionDefaultsMock.mockResolvedValue({
      execution: {
        model_id: 'missing-session-default',
        device: 'auto',
        compute_type: 'default',
      },
      transcription: buildDefaults(),
    })
    taskWorkbenchSessionConfigMocks.useModelsMock.mockReturnValue({
      ...buildModelsReturn(),
      configuredModelId: 'missing-default',
      lastLoadedModelId: 'missing-runtime',
    })

    renderSessionConfig({ fileIds: ['file-1'] })

    await waitFor(() => {
      expect(screen.getByText('Select a downloaded model')).toBeTruthy()
    })
    expect(screen.queryByText('Large V3')).toBeNull()
    expect(screen.getByRole('button', { name: 'Start 1 Selected Tasks' })).toBeDisabled()
  })

  it('creates tasks for all selected files and reports per-file outcomes', async () => {
    const appError: AppError = {
      code: 'API_CLIENT_409',
      i18nKey: 'error.api.clientError',
      retriable: false,
    }

    taskWorkbenchSessionConfigMocks.onCreateTaskMock
      .mockResolvedValueOnce({
        task_id: 'task-1',
        file_id: 'file-1',
        filename: 'sample-a.wav',
        status: 'pending',
        options: null,
      })
      .mockRejectedValueOnce(appError)

    renderSessionConfig({ fileIds: ['file-1', 'file-2'] })

    await waitFor(() => {
      expect(screen.getByText('Large V3')).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Start 2 Selected Tasks' }))

    await waitFor(() => {
      expect(taskWorkbenchSessionConfigMocks.onTasksCreatedMock).toHaveBeenCalledWith([
        {
          fileId: 'file-1',
          taskId: 'task-1',
          filename: 'sample-a.wav',
          ok: true,
        },
        {
          fileId: 'file-2',
          ok: false,
          error: appError,
        },
      ])
    })

    expect(taskWorkbenchSessionConfigMocks.buildRequestMock).toHaveBeenNthCalledWith(1, 'file-1')
    expect(taskWorkbenchSessionConfigMocks.buildRequestMock).toHaveBeenNthCalledWith(2, 'file-2')
    expect(taskWorkbenchSessionConfigMocks.onCreateTaskMock).toHaveBeenNthCalledWith(1, {
      file_id: 'file-1',
      model_id: 'large-v3',
      engine: {
        device: 'auto',
        compute_type: 'default',
      },
    })
  })

  it('applies advanced draft changes and the initial prompt through the shared session state', async () => {
    renderSessionConfig({ fileIds: ['file-1'] })

    fireEvent.click(screen.getByRole('button', { name: 'Advanced Parameters' }))

    fireEvent.change(screen.getByLabelText('Initial Prompt'), {
      target: { value: 'Prompt for this batch' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Change Beam Size' }))
    fireEvent.click(screen.getByRole('button', { name: 'Apply Changes' }))

    await waitFor(() => {
      expect(taskWorkbenchSessionConfigMocks.resetAdvancedOptionsMock).toHaveBeenCalledTimes(1)
      expect(taskWorkbenchSessionConfigMocks.setAdvancedOptionMock).toHaveBeenCalledWith(
        'beam_size',
        9,
      )
      expect(taskWorkbenchSessionConfigMocks.setInitialPromptMock).toHaveBeenCalledWith(
        'Prompt for this batch',
      )
    })
  })

  it('resets the advanced draft back to the current effective defaults', async () => {
    taskWorkbenchSessionConfigMocks.useAppConfigMock.mockReturnValue(
      buildAppConfigReturn({
        transcription: {
          defaults: buildDefaults({ initial_prompt: 'Default prompt' }),
          schema: [],
        },
      }),
    )
    taskWorkbenchSessionConfigMocks.useTranscriptionOptionsMock.mockReturnValue(
      buildTranscriptionOptionsReturn({
        defaults: buildDefaults({ initial_prompt: 'Default prompt' }),
        advancedOptions: { beam_size: 7 },
        initialPrompt: 'Session prompt',
      }),
    )

    renderSessionConfig({ fileIds: ['file-1'] })

    fireEvent.click(screen.getByRole('button', { name: 'Advanced Parameters' }))

    const initialPromptInput = requireTextAreaElement(
      screen.getByLabelText('Initial Prompt'),
      'initial prompt input',
    )
    expect(initialPromptInput.value).toBe('Session prompt')

    fireEvent.change(initialPromptInput, { target: { value: 'Temporary prompt' } })
    fireEvent.click(screen.getByRole('button', { name: 'Change Beam Size' }))

    expect(screen.getByTestId('advanced-options').getAttribute('data-beam-size')).toBe('9')

    fireEvent.click(screen.getByRole('button', { name: 'Reset to Defaults' }))

    await waitFor(() => {
      expect(
        requireTextAreaElement(screen.getByLabelText('Initial Prompt'), 'initial prompt input')
          .value,
      ).toBe('Default prompt')
      expect(screen.getByTestId('advanced-options').getAttribute('data-beam-size')).toBe('')
    })
  })

  it('saves the current session draft as session defaults and refreshes shared config', async () => {
    const defaults = buildDefaults({
      language: null,
      task: 'transcribe',
      beam_size: 3,
      initial_prompt: null,
    })

    taskWorkbenchSessionConfigMocks.useAppConfigMock.mockReturnValue(
      buildAppConfigReturn({
        transcription: { defaults, schema: [] },
      }),
    )
    taskWorkbenchSessionConfigMocks.useTranscriptionOptionsMock.mockReturnValue(
      buildTranscriptionOptionsReturn({
        defaults,
        language: 'en',
        task: 'translate',
        advancedOptions: { beam_size: 7 },
      }),
    )
    taskWorkbenchSessionConfigMocks.fetchEngineDefaultsMock.mockResolvedValue({
      defaults: buildDefaults({
        language: null,
        task: 'transcribe',
        beam_size: 5,
        initial_prompt: null,
      }),
    })

    renderSessionConfig({ fileIds: ['file-1'] })

    await waitFor(() => {
      expect(screen.getByText('Large V3')).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Advanced Parameters' }))
    fireEvent.change(screen.getByLabelText('Initial Prompt'), {
      target: { value: 'Keep names consistent' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Change Beam Size' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save as Task Defaults' }))

    await waitFor(() => {
      expect(taskWorkbenchSessionConfigMocks.fetchEngineDefaultsMock).toHaveBeenCalledTimes(1)
      expect(taskWorkbenchSessionConfigMocks.patchSessionDefaultsMock).toHaveBeenCalledWith({
        execution: {
          model_id: 'large-v3',
          device: 'auto',
          compute_type: 'default',
        },
        transcription: {
          language: 'en',
          task: 'translate',
          beam_size: 9,
          initial_prompt: 'Keep names consistent',
        },
      })
      expect(taskWorkbenchSessionConfigMocks.refreshConfigCachesMock).toHaveBeenCalledTimes(1)
      expect(taskWorkbenchSessionConfigMocks.resetOptionOverridesMock).toHaveBeenCalledTimes(1)
      expect(taskWorkbenchSessionConfigMocks.toastSuccessMock).toHaveBeenCalledWith(
        'Defaults saved',
      )
    })
  })

  it('warns when defaults save succeeds but shared config refresh fails', async () => {
    taskWorkbenchSessionConfigMocks.refreshConfigCachesMock.mockRejectedValueOnce(
      new Error('refresh failed'),
    )

    renderSessionConfig({ fileIds: ['file-1'] })

    await waitFor(() => {
      expect(screen.getByText('Large V3')).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Advanced Parameters' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save as Task Defaults' }))

    await waitFor(() => {
      expect(taskWorkbenchSessionConfigMocks.patchSessionDefaultsMock).toHaveBeenCalledTimes(1)
      expect(taskWorkbenchSessionConfigMocks.resetOptionOverridesMock).not.toHaveBeenCalled()
      expect(taskWorkbenchSessionConfigMocks.toastSuccessMock).not.toHaveBeenCalled()
      expect(taskWorkbenchSessionConfigMocks.toastWarningMock).toHaveBeenCalledWith(
        'Defaults saved. Refresh the page to load the latest values.',
      )
    })
  })
})
