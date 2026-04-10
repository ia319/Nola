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
import { TaskWorkbenchSessionConfig } from '../TaskWorkbenchSessionConfig'

const taskWorkbenchSessionConfigMocks = vi.hoisted(() => ({
  useAppConfigMock: vi.fn<() => UseAppConfigReturn>(),
  useModelsMock: vi.fn<() => UseModelsResult>(),
  useTranscriptionOptionsMock: vi.fn<() => UseTranscriptionOptionsReturn>(),
  onCreateTaskMock: vi.fn(),
  onTasksCreatedMock: vi.fn(),
  buildRequestMock: vi.fn(),
  setLanguageMock: vi.fn(),
  setTaskMock: vi.fn(),
  setAdvancedOptionMock: vi.fn(),
  resetAdvancedOptionsMock: vi.fn(),
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
        'options.creating': 'Creating',
        'options.startDisabled': 'Start Transcription',
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

vi.mock('@/config/use-app-config', () => ({
  useAppConfig: (...args: unknown[]) =>
    taskWorkbenchSessionConfigMocks.useAppConfigMock(...(args as [])),
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
  return {
    language: null,
    task: 'transcribe',
    beam_size: 5,
    best_of: 5,
    patience: 1,
    length_penalty: 1,
    repetition_penalty: 1,
    no_repeat_ngram_size: 0,
    temperature: [0, 0.2, 0.4, 0.6, 0.8, 1],
    compression_ratio_threshold: 2.4,
    log_prob_threshold: -1,
    no_speech_threshold: 0.6,
    condition_on_previous_text: true,
    prompt_reset_on_temperature: 0.5,
    initial_prompt: null,
    prefix: null,
    hotwords: null,
    suppress_blank: true,
    suppress_tokens: [-1],
    max_new_tokens: null,
    without_timestamps: false,
    max_initial_timestamp: 1,
    word_timestamps: false,
    prepend_punctuations: `"'“¿([{-`,
    append_punctuations: `"'.。,，!！?？:：”)]}、`,
    vad_filter: false,
    vad_parameters: {
      threshold: 0.5,
      neg_threshold: null,
      min_speech_duration_ms: 0,
      max_speech_duration_s: 'inf',
      min_silence_duration_ms: 2000,
      speech_pad_ms: 400,
      min_silence_at_max_speech: 98,
      use_max_poss_sil_at_max_speech: true,
    },
    multilingual: false,
    chunk_length: null,
    clip_timestamps: '0',
    hallucination_silence_threshold: null,
    language_detection_threshold: 0.5,
    language_detection_segments: 1,
    ...overrides,
  }
}

function buildAppConfigReturn(): UseAppConfigReturn {
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
    resetOptionOverrides: vi.fn(),
    buildRequest: taskWorkbenchSessionConfigMocks.buildRequestMock,
    initialPrompt: undefined,
    setInitialPrompt: vi.fn(),
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

  it('applies advanced draft changes through the shared transcription option state', async () => {
    render(
      <TaskWorkbenchSessionConfig
        fileIds={['file-1']}
        onCreateTask={taskWorkbenchSessionConfigMocks.onCreateTaskMock}
        onTasksCreated={taskWorkbenchSessionConfigMocks.onTasksCreatedMock}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Advanced Parameters' }))

    expect(screen.getByText('Advanced Configuration')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Change Beam Size' }))
    fireEvent.click(screen.getByRole('button', { name: 'Apply Changes' }))

    await waitFor(() => {
      expect(taskWorkbenchSessionConfigMocks.resetAdvancedOptionsMock).toHaveBeenCalledTimes(1)
      expect(taskWorkbenchSessionConfigMocks.setAdvancedOptionMock).toHaveBeenCalledWith(
        'beam_size',
        9,
      )
    })
  })
})
