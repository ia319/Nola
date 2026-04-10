// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { UseAppConfigReturn } from '@/config/use-app-config'
import type { UseModelsResult } from '@/features/models'
import type { UseTranscriptionOptionsReturn } from '@/features/transcription-options'
import type {
  AdvancedOptionValue,
  AdvancedTranscriptionOptions,
} from '@/features/transcription-options'
import type { AppError, TranscriptionDefaults } from '@/shared/types'
import { buildTranscriptionDefaults } from '@/test-utils/transcription-defaults'
import { TaskWorkbenchSessionConfig } from '../TaskWorkbenchSessionConfig'

const taskWorkbenchSessionConfigMocks = vi.hoisted(() => ({
  useAppConfigMock: vi.fn<() => UseAppConfigReturn>(),
  refreshAppConfigMock: vi.fn(),
  useModelsMock: vi.fn<() => UseModelsResult>(),
  useTranscriptionOptionsMock: vi.fn<() => UseTranscriptionOptionsReturn>(),
  fetchEngineDefaultsMock: vi.fn(),
  patchTranscriptionDefaultsMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
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
        'tasks.workbench.sections.sessionConfig.title': 'Session Configuration',
        'tasks.workbench.sessionConfig.globalSettings': 'Global Settings',
        'tasks.workbench.sessionConfig.executionEngine': 'Execution Engine',
        'tasks.workbench.sessionConfig.sessionOverride': 'Session override',
        'tasks.workbench.sessionConfig.model.label': 'Model',
        'tasks.workbench.sessionConfig.model.badge': 'Coming soon',
        'tasks.workbench.sessionConfig.model.loading': 'Loading models',
        'tasks.workbench.sessionConfig.model.comingSoon': 'Coming soon',
        'tasks.workbench.sessionConfig.device.label': 'Device',
        'tasks.workbench.sessionConfig.computeType.label': 'Compute Type',
        'tasks.workbench.sessionConfig.unavailable': 'Unavailable',
        'tasks.workbench.sessionConfig.advanced.button': 'Advanced Parameters',
        'tasks.workbench.advancedSheet.title': 'Advanced Configuration',
        'tasks.workbench.advancedSheet.description':
          'Fine-tune session overrides and execution settings.',
        'tasks.workbench.advancedSheet.close': 'Close',
        'tasks.workbench.advancedSheet.cancel': 'Cancel',
        'tasks.workbench.advancedSheet.apply': 'Apply Changes',
        'tasks.workbench.advancedSheet.reset': 'Reset to Defaults',
        'tasks.workbench.advancedSheet.saveDefault': 'Save as Default',
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
  },
}))

vi.mock('@/config/logger', () => ({
  default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@/config/api', () => ({
  fetchEngineDefaults: (...args: unknown[]) =>
    taskWorkbenchSessionConfigMocks.fetchEngineDefaultsMock(...(args as [])),
  patchTranscriptionDefaults: (...args: unknown[]) =>
    taskWorkbenchSessionConfigMocks.patchTranscriptionDefaultsMock(...(args as [])),
}))

vi.mock('@/config/use-app-config', () => ({
  useAppConfig: (...args: unknown[]) =>
    taskWorkbenchSessionConfigMocks.useAppConfigMock(...(args as [])),
  refreshAppConfig: (...args: unknown[]) =>
    taskWorkbenchSessionConfigMocks.refreshAppConfigMock(...(args as [])),
}))

vi.mock('@/features/models', () => ({
  useModels: (...args: unknown[]) => taskWorkbenchSessionConfigMocks.useModelsMock(...(args as [])),
}))

vi.mock('@/features/transcription-options', () => ({
  useTranscriptionOptions: (...args: unknown[]) =>
    taskWorkbenchSessionConfigMocks.useTranscriptionOptionsMock(...(args as [])),
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
  overrides: Partial<UseAppConfigReturn['config']> = {},
): UseAppConfigReturn {
  return {
    config: {
      engine: {
        model_size: 'large-v3',
        device: 'cuda',
        compute_type: 'float16',
        is_multilingual: true,
      },
      transcription: { defaults: buildDefaults(), schema: [] },
      file: { allowed_extensions: [], allowed_mime_types: [], max_file_size: 0 },
      effective_languages: [{ code: 'en', label_key: 'options.language.en' }],
      ...overrides,
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
    error: null,
    refresh: vi.fn(),
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
    taskWorkbenchSessionConfigMocks.patchTranscriptionDefaultsMock.mockResolvedValue({
      defaults: buildDefaults(),
    })
    taskWorkbenchSessionConfigMocks.refreshAppConfigMock.mockResolvedValue(
      buildAppConfigReturn().config,
    )
  })

  it('renders the planned session config layout and current execution engine values', () => {
    render(
      <TaskWorkbenchSessionConfig
        fileIds={['file-1', 'file-2']}
        onCreateTask={taskWorkbenchSessionConfigMocks.onCreateTaskMock}
        onTasksCreated={taskWorkbenchSessionConfigMocks.onTasksCreatedMock}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Session Configuration', level: 2 })).toBeTruthy()
    expect(screen.getByText('Global Settings')).toBeTruthy()
    expect(screen.getByText('Execution Engine')).toBeTruthy()
    expect(screen.getByText('Large V3')).toBeTruthy()
    expect(screen.getByText('CUDA')).toBeTruthy()
    expect(screen.getByText('Float16')).toBeTruthy()
    expect(screen.getByText('1 overrides')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Start 2 Selected Tasks' })).toBeTruthy()
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

    render(
      <TaskWorkbenchSessionConfig
        fileIds={['file-1', 'file-2']}
        onCreateTask={taskWorkbenchSessionConfigMocks.onCreateTaskMock}
        onTasksCreated={taskWorkbenchSessionConfigMocks.onTasksCreatedMock}
      />,
    )

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
  })

  it('applies advanced draft changes and the initial prompt through the shared session state', async () => {
    render(
      <TaskWorkbenchSessionConfig
        fileIds={['file-1']}
        onCreateTask={taskWorkbenchSessionConfigMocks.onCreateTaskMock}
        onTasksCreated={taskWorkbenchSessionConfigMocks.onTasksCreatedMock}
      />,
    )

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

    render(
      <TaskWorkbenchSessionConfig
        fileIds={['file-1']}
        onCreateTask={taskWorkbenchSessionConfigMocks.onCreateTaskMock}
        onTasksCreated={taskWorkbenchSessionConfigMocks.onTasksCreatedMock}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Advanced Parameters' }))

    const initialPromptInput = screen.getByLabelText('Initial Prompt') as HTMLTextAreaElement
    expect(initialPromptInput.value).toBe('Session prompt')

    fireEvent.change(initialPromptInput, { target: { value: 'Temporary prompt' } })
    fireEvent.click(screen.getByRole('button', { name: 'Change Beam Size' }))

    expect(screen.getByTestId('advanced-options').getAttribute('data-beam-size')).toBe('9')

    fireEvent.click(screen.getByRole('button', { name: 'Reset to Defaults' }))

    await waitFor(() => {
      expect((screen.getByLabelText('Initial Prompt') as HTMLTextAreaElement).value).toBe(
        'Default prompt',
      )
      expect(screen.getByTestId('advanced-options').getAttribute('data-beam-size')).toBe('')
    })
  })

  it('saves the current session draft as transcription defaults and refreshes shared config', async () => {
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

    render(
      <TaskWorkbenchSessionConfig
        fileIds={['file-1']}
        onCreateTask={taskWorkbenchSessionConfigMocks.onCreateTaskMock}
        onTasksCreated={taskWorkbenchSessionConfigMocks.onTasksCreatedMock}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Advanced Parameters' }))
    fireEvent.change(screen.getByLabelText('Initial Prompt'), {
      target: { value: 'Keep names consistent' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Change Beam Size' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save as Default' }))

    await waitFor(() => {
      expect(taskWorkbenchSessionConfigMocks.fetchEngineDefaultsMock).toHaveBeenCalledTimes(1)
      expect(taskWorkbenchSessionConfigMocks.patchTranscriptionDefaultsMock).toHaveBeenCalledWith({
        language: 'en',
        task: 'translate',
        beam_size: 9,
        initial_prompt: 'Keep names consistent',
      })
      expect(taskWorkbenchSessionConfigMocks.refreshAppConfigMock).toHaveBeenCalledTimes(1)
      expect(taskWorkbenchSessionConfigMocks.resetOptionOverridesMock).toHaveBeenCalledTimes(1)
      expect(taskWorkbenchSessionConfigMocks.toastSuccessMock).toHaveBeenCalledWith(
        'Defaults saved',
      )
    })
  })
})
