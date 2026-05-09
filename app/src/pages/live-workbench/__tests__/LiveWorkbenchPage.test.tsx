// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import type { QueryKey } from '@tanstack/react-query'
import { describe, expect, it, vi, beforeEach } from 'vitest'

import type { UseAppConfigReturn } from '@/config/use-app-config'
import type { UseModelsResult } from '@/features/models'
import type {
  AppConfig,
  LiveRealtimeDefaults,
  LiveRealtimeDefaultsResponse,
  LiveRealtimeOptionGroup,
  LiveRealtimeSchemaResponse,
  ModelResponse,
} from '@/shared/types'
import { buildTranscriptionDefaults } from '@/test-utils/transcription-defaults'
import { LiveWorkbenchPage } from '../LiveWorkbenchPage'

type LiveWorkbenchQueryOptions = {
  queryKey: QueryKey
}

type LiveWorkbenchQueryResult<TData> = {
  data: TData
  isPending: false
}

type LiveWorkbenchQueryData = LiveRealtimeDefaultsResponse | LiveRealtimeSchemaResponse

const liveWorkbenchPageMocks = vi.hoisted(() => ({
  useAppConfigMock: vi.fn<() => UseAppConfigReturn>(),
  useModelsMock: vi.fn<() => UseModelsResult>(),
  useQueryMock:
    vi.fn<
      (options: LiveWorkbenchQueryOptions) => LiveWorkbenchQueryResult<LiveWorkbenchQueryData>
    >(),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const messages: Record<string, string> = {
        'live.workbench.title': 'Live',
        'live.workbench.description': 'Real-time transcription',
        'live.workbench.statusBar.region': 'Real-time transcription status',
        'live.workbench.statusBar.session': 'Session',
        'live.workbench.statusBar.duration': 'Duration',
        'live.workbench.statusBar.connection': 'Connection',
        'live.workbench.statusBar.tracks': 'Tracks',
        'live.workbench.statusBar.runtime': 'Runtime',
        'live.workbench.sessionSetup.title': 'Session setup',
        'live.workbench.sessionSetup.settings': 'Session settings',
        'live.workbench.sessionSetup.model.label': 'Model',
        'live.workbench.sessionSetup.model.loading': 'Loading models',
        'live.workbench.sessionSetup.model.noDownloaded': 'No downloaded models',
        'live.workbench.sessionSetup.task.label': 'Task',
        'live.workbench.sessionSetup.language.label': 'Language',
        'live.workbench.sessionSetup.language.auto': 'Auto detect',
        'live.workbench.sessionSetup.runtime.label': 'Runtime',
        'live.workbench.transcript.title': 'Live transcript',
        'live.workbench.transcript.empty': 'No transcript yet',
        'live.workbench.settings.eyebrow': 'Session settings',
        'live.workbench.settings.title': 'Runtime configuration',
        'live.workbench.settings.description': 'Review per-session runtime parameters.',
        'live.workbench.settings.empty.title': 'No adjustable settings',
        'live.workbench.settings.empty.description':
          'This session currently has no editable runtime settings.',
        'settings.liveRealtime.fields.task.label': 'Task',
        'settings.liveRealtime.fields.language.label': 'Language',
        'settings.liveRealtime.values.task.transcribe': 'Transcribe',
        'settings.liveRealtime.values.task.translate': 'Translate',
        'options.language.en': 'English',
        'components.workspaceSidePanel.close': 'Close',
      }

      return messages[key] ?? key
    },
  }),
}))

vi.mock('@tanstack/react-query', () => ({
  useQuery: liveWorkbenchPageMocks.useQueryMock,
}))

vi.mock('@/config/use-app-config', () => ({
  useAppConfig: liveWorkbenchPageMocks.useAppConfigMock,
}))

vi.mock('@/features/models', () => ({
  DEFAULT_MODEL_LIST_QUERY: {
    q: '',
    status: 'all',
    sort_by: null,
    order: 'asc',
  },
  useModels: liveWorkbenchPageMocks.useModelsMock,
}))

function buildLiveRealtimeDefaults(
  overrides: Partial<LiveRealtimeDefaults> = {},
): LiveRealtimeDefaults {
  return {
    language: null,
    task: 'transcribe',
    context_prompt: null,
    min_chunk_ms: 700,
    buffer_trimming_ms: 15_000,
    prompt_max_chars: 1600,
    timestamp_tolerance_ms: 80,
    max_duplicate_ngram: 5,
    silence_rms_threshold: 0.015,
    segment_close_silence_ms: 800,
    context_reset_silence_ms: 4000,
    beam_size: 5,
    best_of: 5,
    temperature: 0,
    compression_ratio_threshold: 2.4,
    log_prob_threshold: -1,
    no_speech_threshold: 0.6,
    condition_on_previous_text: true,
    vad_filter: true,
    vad_parameters: {
      threshold: 0.5,
      neg_threshold: null,
      min_speech_duration_ms: 250,
      max_speech_duration_s: 'inf',
      min_silence_duration_ms: 2000,
      speech_pad_ms: 400,
    },
    ...overrides,
  }
}

function buildLiveRealtimeSchema(): LiveRealtimeOptionGroup[] {
  return [
    {
      group: 'recognition',
      group_label_key: 'settings.liveRealtime.groups.recognition',
      fields: [
        {
          key: 'task',
          label_key: 'settings.liveRealtime.fields.task.label',
          description_key: 'settings.liveRealtime.fields.task.description',
          default_value: 'transcribe',
          supported_adapters: ['whisper_streaming'],
          depends_on: null,
          type: 'select',
          options: [
            {
              value: 'transcribe',
              label_key: 'settings.liveRealtime.values.task.transcribe',
            },
            {
              value: 'translate',
              label_key: 'settings.liveRealtime.values.task.translate',
            },
          ],
          options_source: null,
        },
        {
          key: 'language',
          label_key: 'settings.liveRealtime.fields.language.label',
          description_key: 'settings.liveRealtime.fields.language.description',
          default_value: null,
          supported_adapters: ['whisper_streaming'],
          depends_on: null,
          type: 'select',
          options: null,
          options_source: 'effective_languages',
        },
      ],
    },
  ]
}

function buildModel(overrides: Partial<ModelResponse> = {}): ModelResponse {
  return {
    model_id: 'small',
    name: 'Small',
    size_bytes: 1,
    repo_id: 'repo',
    languages: 'multilingual',
    speed_rank: 1,
    accuracy_rank: 1,
    description: 'desc',
    description_key: 'models.catalog.small.description',
    status: 'downloaded',
    disk_usage: 1,
    is_configured: true,
    is_last_loaded: false,
    download_progress: null,
    ...overrides,
  }
}

function buildAppConfigReturn(
  overrides: Partial<AppConfig> = {},
): UseAppConfigReturn & { config: AppConfig } {
  return {
    config: {
      engine: {
        model_size: 'small',
        device: 'auto',
        compute_type: 'default',
        is_multilingual: true,
        schema: [],
      },
      transcription: {
        defaults: buildTranscriptionDefaults(),
        schema: [],
      },
      file: { allowed_extensions: [], allowed_mime_types: [], max_file_size: 0 },
      effective_languages: [{ code: 'en', label_key: 'options.language.en' }],
      model: null,
      ...overrides,
    },
    fileValidationConfig: { allowedExtensions: [], allowedMimeTypes: [], maxFileSize: 0 },
    isLoading: false,
  }
}

function buildModelsReturn(overrides: Partial<UseModelsResult> = {}): UseModelsResult {
  return {
    models: [buildModel()],
    configuredModelId: 'small',
    lastLoadedModelId: null,
    effectiveModelDir: 'D:/models',
    isLoading: false,
    isRefreshing: false,
    hasLoaded: true,
    error: null,
    refresh: vi.fn(),
    updateSnapshot: vi.fn(),
    ...overrides,
  }
}

function buildQueryResult<TData>(data: TData): LiveWorkbenchQueryResult<TData> {
  return {
    data,
    isPending: false,
  }
}

describe('LiveWorkbenchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    liveWorkbenchPageMocks.useAppConfigMock.mockReturnValue(buildAppConfigReturn())
    liveWorkbenchPageMocks.useModelsMock.mockReturnValue(buildModelsReturn())
    liveWorkbenchPageMocks.useQueryMock.mockImplementation(({ queryKey }) => {
      if (queryKey.includes('defaults')) {
        return buildQueryResult<LiveRealtimeDefaultsResponse>({
          defaults: buildLiveRealtimeDefaults(),
        })
      }

      return buildQueryResult<LiveRealtimeSchemaResponse>({
        schema: buildLiveRealtimeSchema(),
      })
    })
  })

  it('renders the live workbench scaffold and setup controls', async () => {
    render(<LiveWorkbenchPage />)

    expect(screen.getByRole('heading', { level: 1, name: 'Live' })).toBeTruthy()
    expect(screen.getByText('Real-time transcription')).toBeTruthy()
    expect(screen.getByText('Session')).toBeTruthy()
    expect(screen.getByText('Duration')).toBeTruthy()
    expect(screen.getByText('Connection')).toBeTruthy()
    expect(screen.getByText('Tracks')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: 'Session setup' })).toBeTruthy()
    expect(screen.getByLabelText('Model')).toBeTruthy()
    expect(await screen.findByText('Small')).toBeTruthy()
    expect(screen.getByLabelText('Task')).toBeTruthy()
    expect(screen.getByText('Transcribe')).toBeTruthy()
    expect(screen.getByLabelText('Language')).toBeTruthy()
    expect(screen.getByText('Auto detect')).toBeTruthy()
    expect(screen.getByText('auto / default')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: 'Live transcript' })).toBeTruthy()
    expect(screen.getByText('No transcript yet')).toBeTruthy()
    expect(
      screen.getByText('Live transcript').closest('[data-slot="live-workbench-page"]'),
    ).toBeTruthy()
  })

  it('opens the settings side panel from session setup and hides the duplicate entry', () => {
    render(<LiveWorkbenchPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Session settings' }))

    expect(screen.getByRole('heading', { level: 2, name: 'Runtime configuration' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Session settings' })).toBeNull()
  })
})
