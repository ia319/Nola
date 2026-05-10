// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { QueryKey } from '@tanstack/react-query'
import { describe, expect, it, vi, beforeEach } from 'vitest'

import type { UseAppConfigReturn } from '@/config/use-app-config'
import type { UseModelsResult } from '@/features/models'
import type * as RealtimeFeature from '@/features/realtime'
import { useLiveRealtimeStore, type UseLiveDeviceInventoryReturn } from '@/features/realtime'
import type {
  AppConfig,
  LiveRealtimeDefaults,
  LiveRealtimeDefaultsResponse,
  LiveRealtimeOptionGroup,
  LiveRealtimeSchemaResponse,
  LiveSessionDetail,
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
  error?: null
  refetch: () => void
}

type LiveWorkbenchQueryData = LiveRealtimeDefaultsResponse | LiveRealtimeSchemaResponse
type LiveWorkbenchMutationOptions = {
  mutationFn: (payload?: unknown) => Promise<unknown>
  onSuccess?: (data: unknown) => void
  onError?: (error: unknown) => void
}

const liveWorkbenchPageMocks = vi.hoisted(() => ({
  useAppConfigMock: vi.fn<() => UseAppConfigReturn>(),
  useModelsMock: vi.fn<() => UseModelsResult>(),
  useLiveDeviceInventoryMock: vi.fn<() => UseLiveDeviceInventoryReturn>(),
  useQueryMock:
    vi.fn<
      (options: LiveWorkbenchQueryOptions) => LiveWorkbenchQueryResult<LiveWorkbenchQueryData>
    >(),
  useMutationMock: vi.fn<(options: LiveWorkbenchMutationOptions) => unknown>(),
  queryClientMock: {
    setQueryData: vi.fn(),
    invalidateQueries: vi.fn(),
  },
  fetchLiveRealtimeDefaultsMock: vi.fn(),
  fetchLiveRealtimeSchemaMock: vi.fn(),
  patchLiveRealtimeDefaultsMock: vi.fn(),
  deleteLiveRealtimeDefaultsMock: vi.fn(),
  createLiveRealtimeSessionServiceMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastWarningMock: vi.fn(),
  toastErrorMock: vi.fn(),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { percent?: number }) => {
      const messages: Record<string, string> = {
        'live.workbench.title': 'Live',
        'live.workbench.description': 'Real-time transcription',
        'live.workbench.sessionTitle': 'Live transcription',
        'live.workbench.actions.start': 'Start session',
        'live.workbench.actions.starting': 'Starting...',
        'live.workbench.actions.stop': 'Stop session',
        'live.workbench.actions.stopping': 'Stopping...',
        'live.workbench.sources.microphone': 'Microphone',
        'live.workbench.sources.system': 'System audio',
        'live.workbench.runtime.mock': 'Mock',
        'live.workbench.runtime.whisperStreaming': 'WhisperStreaming',
        'live.workbench.statusBar.region': 'Real-time transcription status',
        'live.workbench.statusBar.status': 'Status',
        'live.workbench.statusBar.session': 'Session',
        'live.workbench.statusBar.duration': 'Duration',
        'live.workbench.statusBar.connection': 'Connection',
        'live.workbench.statusBar.tracks': 'Tracks',
        'live.workbench.statusBar.runtime': 'Realtime engine',
        'live.workbench.statusBar.runState.idle': 'Idle',
        'live.workbench.statusBar.runState.starting': 'Starting',
        'live.workbench.statusBar.runState.active': 'Recording',
        'live.workbench.statusBar.runState.finishing': 'Stopping',
        'live.workbench.statusBar.runState.finished': 'Finished',
        'live.workbench.statusBar.runState.failed': 'Failed',
        'live.workbench.statusBar.connectionState.idle': 'Idle',
        'live.workbench.statusBar.connectionState.connecting': 'Connecting',
        'live.workbench.statusBar.connectionState.ready': 'Ready',
        'live.workbench.statusBar.connectionState.streaming': 'Streaming',
        'live.workbench.statusBar.connectionState.finishing': 'Finishing',
        'live.workbench.statusBar.connectionState.closed': 'Closed',
        'live.workbench.statusBar.connectionState.failed': 'Failed',
        'live.workbench.sessionSetup.title': 'Session setup',
        'live.workbench.sessionSetup.settings': 'Session settings',
        'live.workbench.sessionSetup.model.label': 'Model',
        'live.workbench.sessionSetup.model.loading': 'Loading models',
        'live.workbench.sessionSetup.model.noDownloaded': 'No downloaded models',
        'live.workbench.sessionSetup.task.label': 'Task',
        'live.workbench.sessionSetup.language.label': 'Language',
        'live.workbench.sessionSetup.language.auto': 'Auto detect',
        'tasks.workbench.sessionConfig.device.label': 'Device',
        'tasks.workbench.sessionConfig.computeType.label': 'Compute Type',
        'live.workbench.sessionSetup.sources.level': `Level ${options?.percent ?? 0}%`,
        'live.workbench.sessionSetup.microphone.title': 'Microphone',
        'live.workbench.sessionSetup.microphone.description': 'Choose an input device.',
        'live.workbench.sessionSetup.microphone.device': 'Input device',
        'live.workbench.sessionSetup.microphone.defaultDevice': 'System default',
        'live.workbench.sessionSetup.microphone.actions.test': 'Test microphone',
        'live.workbench.sessionSetup.microphone.actions.stop': 'Stop test',
        'live.workbench.sessionSetup.microphone.status.ready': 'Ready',
        'live.workbench.sessionSetup.systemAudio.title': 'System audio',
        'live.workbench.sessionSetup.systemAudio.description': 'Capture system audio explicitly.',
        'live.workbench.sessionSetup.systemAudio.captureSource.label': 'Capture source',
        'live.workbench.sessionSetup.systemAudio.actions.start': 'Start',
        'live.workbench.sessionSetup.systemAudio.actions.test': 'Test capture',
        'live.workbench.sessionSetup.systemAudio.actions.stop': 'Stop capture',
        'live.workbench.sessionSetup.systemAudio.status.limited': 'Browser capture available',
        'live.workbench.transcript.title': 'Live transcript',
        'live.workbench.transcript.kind.final': 'Final',
        'live.workbench.transcript.kind.committed_partial': 'Partial',
        'live.workbench.transcript.kind.preview': 'Preview',
        'live.workbench.transcript.empty.title': 'No transcript yet',
        'live.workbench.transcript.empty.description':
          'Start a live session to stream transcript output here.',
        'live.workbench.transcript.empty.noModelTitle': 'No downloaded model',
        'live.workbench.transcript.empty.noModelDescription':
          'Download a local model before starting a live transcription session.',
        'live.workbench.transcript.empty.configuredModelUnavailableTitle':
          'Default model unavailable',
        'live.workbench.transcript.empty.configuredModelUnavailableDescription':
          'The configured default model is not downloaded. The live session will use the selected downloaded model.',
        'live.workbench.settings.title': 'Runtime configuration',
        'live.workbench.settings.description': 'Review per-session runtime parameters.',
        'live.workbench.settings.state.idle': 'Edit parameters before starting this session.',
        'live.workbench.settings.state.starting': 'Session startup is locking runtime parameters.',
        'live.workbench.settings.state.active':
          'Session is running. Runtime parameters are read-only.',
        'live.workbench.settings.state.finishing':
          'Session shutdown is locking runtime parameters.',
        'live.workbench.settings.state.finished':
          'Session is finished. Runtime parameters are read-only.',
        'live.workbench.settings.state.failed': 'Adjust parameters before retrying this session.',
        'live.workbench.settings.actions.apply': 'Apply',
        'live.workbench.settings.actions.resetDraft': 'Reset draft',
        'live.workbench.settings.actions.saveDefaults': 'Save as defaults',
        'live.workbench.settings.actions.savingDefaults': 'Saving defaults...',
        'live.workbench.settings.actions.resetSavedDefaults': 'Reset saved defaults',
        'live.workbench.settings.actions.resettingDefaults': 'Resetting defaults...',
        'live.workbench.settings.actions.retry': 'Retry',
        'live.workbench.settings.toast.defaultsSaved': 'Live defaults saved',
        'live.workbench.settings.toast.defaultsReset': 'Live defaults reset',
        'live.workbench.settings.toast.refreshWarning': 'Defaults saved, but refresh failed',
        'live.workbench.settings.empty.title': 'No adjustable settings',
        'live.workbench.settings.empty.description':
          'This session currently has no editable runtime settings.',
        'live.workbench.settings.snapshot.empty.title': 'Runtime snapshot unavailable',
        'live.workbench.settings.snapshot.empty.description':
          'The active session has not returned a resolved runtime snapshot yet.',
        'settings.liveRealtime.groups.recognition': 'Recognition',
        'settings.liveRealtime.fields.task.label': 'Task',
        'settings.liveRealtime.fields.task.description': 'Task mode',
        'settings.liveRealtime.fields.language.label': 'Language',
        'settings.liveRealtime.fields.language.description': 'Language hint',
        'settings.liveRealtime.fields.beamSize.label': 'Beam size',
        'settings.liveRealtime.fields.beamSize.description': 'Beam size hint',
        'settings.liveRealtime.values.task.transcribe': 'Transcribe',
        'settings.liveRealtime.values.task.translate': 'Translate',
        'settings.liveRealtime.values.auto': 'Auto detect',
        'settings.liveRealtime.values.empty': 'Not set',
        'options.language.en': 'English',
        'live.workbench.compact.open': 'Open compact view',
        'live.workbench.compact.title': 'Compact live view',
        'live.workbench.compact.expand': 'Expand compact view',
        'live.workbench.compact.close': 'Close compact view',
        'live.workbench.compact.empty': 'No live transcript yet',
        'live.workbench.errors.actions.retry': 'Retry',
        'live.workbench.errors.liveSourceRequired.title': 'No audio source selected',
        'live.workbench.errors.liveSourceRequired.description':
          'Enable Microphone or System audio before starting a live session.',
        'live.workbench.errors.runtimeModelNotDownloaded.title': 'No downloaded model',
        'live.workbench.errors.runtimeModelNotDownloaded.description':
          'Download a local model before starting a live transcription session.',
        'live.workbench.errors.generic.title': 'Live session failed',
        'live.workbench.errors.generic.description':
          'The live session stopped unexpectedly. Check the selected model and audio sources, then try again.',
        'components.workspaceSidePanel.close': 'Close',
      }

      return messages[key] ?? key
    },
  }),
}))

vi.mock('@tanstack/react-query', () => ({
  useQuery: liveWorkbenchPageMocks.useQueryMock,
  useMutation: liveWorkbenchPageMocks.useMutationMock,
  useQueryClient: () => liveWorkbenchPageMocks.queryClientMock,
}))

vi.mock('@/config/api', () => ({
  fetchLiveRealtimeDefaults: liveWorkbenchPageMocks.fetchLiveRealtimeDefaultsMock,
  fetchLiveRealtimeSchema: liveWorkbenchPageMocks.fetchLiveRealtimeSchemaMock,
  patchLiveRealtimeDefaults: liveWorkbenchPageMocks.patchLiveRealtimeDefaultsMock,
  deleteLiveRealtimeDefaults: liveWorkbenchPageMocks.deleteLiveRealtimeDefaultsMock,
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

vi.mock('@/features/realtime', async (importActual) => {
  const actual = await importActual<typeof RealtimeFeature>()

  return {
    ...actual,
    useLiveDeviceInventory: liveWorkbenchPageMocks.useLiveDeviceInventoryMock,
    createLiveRealtimeSessionService: liveWorkbenchPageMocks.createLiveRealtimeSessionServiceMock,
  }
})

vi.mock('sonner', () => ({
  toast: {
    success: liveWorkbenchPageMocks.toastSuccessMock,
    warning: liveWorkbenchPageMocks.toastWarningMock,
    error: liveWorkbenchPageMocks.toastErrorMock,
  },
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
        {
          key: 'beam_size',
          label_key: 'settings.liveRealtime.fields.beamSize.label',
          description_key: 'settings.liveRealtime.fields.beamSize.description',
          default_value: 5,
          supported_adapters: ['whisper_streaming'],
          depends_on: null,
          type: 'number',
          min: 1,
          max: 10,
          step: 1,
          special_values: null,
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

function buildLiveSessionDetail(overrides: Partial<LiveSessionDetail> = {}): LiveSessionDetail {
  return {
    session_id: 'session-123456789',
    title: 'Live transcription',
    mode: 'streaming',
    status: 'active',
    language_hint: null,
    model_id: 'small',
    runtime: 'WhisperStreaming',
    audio_format: 'pcm_s16le',
    started_at: '2026-05-10T00:00:00.000Z',
    ended_at: null,
    error: null,
    created_at: '2026-05-10T00:00:00.000Z',
    updated_at: '2026-05-10T00:00:00.000Z',
    runtime_config: {
      beam_size: 5,
    },
    tracks: [],
    segments: [],
    segment_total: 0,
    segment_limit: 100,
    segment_offset: 0,
    ...overrides,
  }
}

function createMockLiveSessionService() {
  let state: RealtimeFeature.LiveRealtimeRunState = 'idle'
  const session = buildLiveSessionDetail()
  const start = vi.fn(async () => {
    state = 'active'
    useLiveRealtimeStore.getState().setLiveRealtimeStarting()
    useLiveRealtimeStore.getState().setLiveRealtimeSession(session)
    useLiveRealtimeStore.getState().setLiveRealtimeActive()
    return session
  })
  const stop = vi.fn(async () => {
    state = 'finished'
    useLiveRealtimeStore.getState().setLiveRealtimeFinished({
      ...session,
      status: 'finished',
      ended_at: '2026-05-10T00:00:03.000Z',
    })
  })

  return {
    get state() {
      return state
    },
    start,
    stop,
  }
}

function getCreatedSessionService(): ReturnType<typeof createMockLiveSessionService> {
  const result = liveWorkbenchPageMocks.createLiveRealtimeSessionServiceMock.mock.results[0]
  if (!result || result.type !== 'return') {
    throw new Error('Live session service was not created')
  }

  return result.value as ReturnType<typeof createMockLiveSessionService>
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
      live_realtime: {
        runtime_adapter: 'whisper_streaming',
        supports_runtime_overrides: true,
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

function buildLiveDeviceInventoryReturn(
  overrides: Partial<UseLiveDeviceInventoryReturn> = {},
): UseLiveDeviceInventoryReturn {
  return {
    inventory: {
      microphones: [
        {
          id: 'mic-1',
          kind: 'microphone',
          label: 'Studio USB microphone',
          groupId: null,
          isTemporary: false,
          isDefault: false,
          isSelected: true,
          isActive: false,
        },
      ],
      speakers: [],
      current: {
        microphone: {
          selectedDeviceId: 'mic-1',
          activeDeviceId: null,
        },
        speaker: {
          selectedDeviceId: null,
          activeDeviceId: null,
        },
      },
      permissions: {
        microphone: 'prompt',
        speakerSelection: 'unsupported',
      },
      capabilities: {
        microphoneCapture: 'available',
        speakerSelection: 'unsupported',
        systemAudioCapture: 'limited',
      },
      warnings: ['system_audio_capture_limited'],
    },
    inventoryStatus: 'ready',
    inventoryError: null,
    lastMicrophonePermission: null,
    selectedMicrophoneId: 'mic-1',
    selectedSpeakerId: null,
    activeMicrophoneId: null,
    activeSpeakerId: null,
    microphoneCapture: {
      sessionId: null,
      sourceKind: 'microphone',
      deviceId: null,
      state: 'idle',
      errorCode: null,
      level: {
        level: 0.42,
        peak: 0.5,
        isMutedLike: false,
        measuredAt: 1,
      },
      startedAt: null,
    },
    systemAudioCapture: {
      sessionId: null,
      sourceKind: 'system',
      deviceId: null,
      state: 'idle',
      errorCode: null,
      level: null,
      startedAt: null,
    },
    selectMicrophone: vi.fn(),
    selectSpeaker: vi.fn(),
    setActiveSpeaker: vi.fn(),
    refreshDevices: vi.fn().mockResolvedValue(null),
    requestMicrophonePermission: vi.fn().mockResolvedValue({
      state: 'granted',
      granted: true,
      warning: null,
    }),
    startMicrophoneCapture: vi.fn().mockResolvedValue(undefined),
    stopMicrophoneCapture: vi.fn().mockResolvedValue(undefined),
    pauseMicrophoneCapture: vi.fn().mockResolvedValue(undefined),
    resumeMicrophoneCapture: vi.fn().mockResolvedValue(undefined),
    startSystemAudioCapture: vi.fn().mockResolvedValue(undefined),
    stopSystemAudioCapture: vi.fn().mockResolvedValue(undefined),
    pauseSystemAudioCapture: vi.fn().mockResolvedValue(undefined),
    resumeSystemAudioCapture: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

function buildQueryResult<TData>(data: TData): LiveWorkbenchQueryResult<TData> {
  return {
    data,
    isPending: false,
    error: null,
    refetch: vi.fn(),
  }
}

function queryPanelTaskSelect(): HTMLSelectElement | undefined {
  return screen
    .getAllByLabelText('Task')
    .find((element): element is HTMLSelectElement => element instanceof HTMLSelectElement)
}

function getPanelBeamSizeInput(): HTMLInputElement {
  const input = screen.getByLabelText('Beam size')

  if (!(input instanceof HTMLInputElement)) {
    throw new Error('Panel beam size input was not found')
  }

  return input
}

describe('LiveWorkbenchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useLiveRealtimeStore.getState().resetLiveRealtimeRuntimeState()
    liveWorkbenchPageMocks.queryClientMock.invalidateQueries.mockResolvedValue(undefined)
    liveWorkbenchPageMocks.patchLiveRealtimeDefaultsMock.mockResolvedValue({
      defaults: buildLiveRealtimeDefaults({ task: 'translate' }),
    })
    liveWorkbenchPageMocks.deleteLiveRealtimeDefaultsMock.mockResolvedValue(undefined)
    liveWorkbenchPageMocks.fetchLiveRealtimeDefaultsMock.mockResolvedValue({
      defaults: buildLiveRealtimeDefaults(),
    })
    liveWorkbenchPageMocks.useMutationMock.mockImplementation((options) => ({
      isPending: false,
      mutate: (payload?: unknown) => {
        void options
          .mutationFn(payload)
          .then((data) => options.onSuccess?.(data))
          .catch((error: unknown) => options.onError?.(error))
      },
    }))
    liveWorkbenchPageMocks.useAppConfigMock.mockReturnValue(buildAppConfigReturn())
    liveWorkbenchPageMocks.useModelsMock.mockReturnValue(buildModelsReturn())
    liveWorkbenchPageMocks.useLiveDeviceInventoryMock.mockReturnValue(
      buildLiveDeviceInventoryReturn(),
    )
    liveWorkbenchPageMocks.createLiveRealtimeSessionServiceMock.mockImplementation(() =>
      createMockLiveSessionService(),
    )
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
    const { container } = render(<LiveWorkbenchPage />)

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
    expect(screen.getByLabelText('Device')).toBeTruthy()
    expect(screen.getByText('auto')).toBeTruthy()
    expect(screen.getByLabelText('Compute Type')).toBeTruthy()
    expect(screen.getByText('default')).toBeTruthy()
    expect(screen.getByText('WhisperStreaming')).toBeTruthy()
    expect(screen.getByText('Microphone')).toBeTruthy()
    expect(screen.getByText('Studio USB microphone')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Test microphone' })).toBeTruthy()
    expect(screen.getByText('System audio')).toBeTruthy()
    expect(screen.getByText('Capture source')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Start' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Test capture' })).toBeDisabled()
    expect(screen.getByText('Browser capture available')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: 'Live transcript' })).toBeTruthy()
    expect(screen.getByText('No transcript yet')).toBeTruthy()
    expect(
      screen.getByText('Live transcript').closest('[data-slot="live-workbench-page"]'),
    ).toBeTruthy()
    expect(container.querySelector('[data-slot="live-workbench-page"]')).toHaveClass(
      'overflow-hidden',
    )
    expect(container.querySelector('[data-slot="live-workbench-body"]')).toHaveClass(
      'overflow-hidden',
    )
    expect(container.querySelector('[data-slot="live-workbench-work-area"]')).toHaveClass(
      'grid-rows-[auto_minmax(0,1fr)]',
      'overflow-hidden',
    )
  })

  it('toggles the settings side panel from session setup', () => {
    render(<LiveWorkbenchPage />)

    const settingsButton = screen.getByRole('button', { name: 'Session settings' })
    fireEvent.click(settingsButton)

    expect(screen.getByRole('heading', { level: 2, name: 'Runtime configuration' })).toBeTruthy()
    expect(settingsButton).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getAllByText('Session settings')).toHaveLength(1)

    fireEvent.click(settingsButton)

    expect(screen.queryByRole('heading', { level: 2, name: 'Runtime configuration' })).toBeNull()
    expect(settingsButton).toHaveAttribute('aria-expanded', 'false')
  })

  it('reflects mock runtime and disables per-session runtime overrides', async () => {
    liveWorkbenchPageMocks.useAppConfigMock.mockReturnValue(
      buildAppConfigReturn({
        live_realtime: {
          runtime_adapter: 'mock',
          supports_runtime_overrides: false,
        },
      }),
    )

    render(<LiveWorkbenchPage />)

    expect(screen.getByText('Mock')).toBeTruthy()
    expect(screen.getByLabelText('Task')).toBeDisabled()
    expect(screen.getByLabelText('Language')).toBeDisabled()
    expect(screen.getByLabelText('Device')).toBeDisabled()
    expect(screen.getByLabelText('Compute Type')).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Start session' }))

    await waitFor(() => {
      expect(liveWorkbenchPageMocks.createLiveRealtimeSessionServiceMock).toHaveBeenCalledTimes(1)
    })
    expect(getCreatedSessionService().start).toHaveBeenCalledWith(
      expect.objectContaining({ runtimeOverrides: undefined }),
    )
  })

  it('applies settings panel draft only after explicit apply', () => {
    render(<LiveWorkbenchPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Session settings' }))
    expect(queryPanelTaskSelect()).toBeUndefined()

    const beamSizeInput = getPanelBeamSizeInput()
    expect(beamSizeInput).toHaveValue(null)
    expect(beamSizeInput).toHaveAttribute('placeholder', '5')

    fireEvent.change(beamSizeInput, { target: { value: '7' } })
    fireEvent.blur(beamSizeInput)

    const applyButton = screen.getByRole('button', { name: 'Apply' })
    expect(applyButton).not.toBeDisabled()

    fireEvent.click(applyButton)

    expect(applyButton).toBeDisabled()
  })

  it('saves settings panel draft as future Live defaults', async () => {
    render(<LiveWorkbenchPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Session settings' }))
    fireEvent.change(getPanelBeamSizeInput(), { target: { value: '7' } })
    fireEvent.blur(getPanelBeamSizeInput())
    fireEvent.click(screen.getByRole('button', { name: 'Save as defaults' }))

    await waitFor(() => {
      expect(liveWorkbenchPageMocks.patchLiveRealtimeDefaultsMock).toHaveBeenCalledWith({
        beam_size: 7,
      })
    })
  })

  it('resets saved Live defaults from the settings panel', async () => {
    render(<LiveWorkbenchPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Session settings' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reset saved defaults' }))

    await waitFor(() => {
      expect(liveWorkbenchPageMocks.deleteLiveRealtimeDefaultsMock).toHaveBeenCalledTimes(1)
      expect(liveWorkbenchPageMocks.fetchLiveRealtimeDefaultsMock).toHaveBeenCalledTimes(1)
    })
  })

  it('starts and stops a live session through the shared service', async () => {
    render(<LiveWorkbenchPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Start session' }))

    await waitFor(() => {
      expect(liveWorkbenchPageMocks.createLiveRealtimeSessionServiceMock).toHaveBeenCalledTimes(1)
    })
    const service = getCreatedSessionService()
    expect(service.start).toHaveBeenCalledWith({
      title: 'Live transcription',
      modelId: 'small',
      languageHint: null,
      runtimeOverrides: undefined,
      sources: ['microphone'],
      microphoneCapture: {
        deviceId: 'mic-1',
      },
    })
    expect(await screen.findByText('Recording')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Stop session' }))

    await waitFor(() => {
      expect(service.stop).toHaveBeenCalledTimes(1)
    })
  })

  it('shows a readable validation error when no source is selected', async () => {
    render(<LiveWorkbenchPage />)

    fireEvent.click(screen.getByRole('switch', { name: 'Microphone' }))
    fireEvent.click(screen.getByRole('button', { name: 'Start session' }))

    expect(await screen.findByText('No audio source selected')).toBeTruthy()
    expect(
      screen.getByText('Enable Microphone or System audio before starting a live session.'),
    ).toBeTruthy()
    expect(liveWorkbenchPageMocks.createLiveRealtimeSessionServiceMock).not.toHaveBeenCalled()
  })

  it('shows when the configured default model is not downloaded', () => {
    liveWorkbenchPageMocks.useModelsMock.mockReturnValue(
      buildModelsReturn({
        configuredModelId: 'large-v3',
        models: [buildModel({ model_id: 'small', is_configured: false })],
      }),
    )

    render(<LiveWorkbenchPage />)

    expect(screen.getByText('Default model unavailable')).toBeTruthy()
    expect(
      screen.getByText(
        'The configured default model is not downloaded. The live session will use the selected downloaded model.',
      ),
    ).toBeTruthy()
  })

  it('starts source test capture only from explicit user actions', () => {
    const liveDevices = buildLiveDeviceInventoryReturn()
    liveWorkbenchPageMocks.useLiveDeviceInventoryMock.mockReturnValue(liveDevices)
    render(<LiveWorkbenchPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Test microphone' }))
    fireEvent.click(screen.getByRole('switch', { name: 'System audio' }))
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    fireEvent.click(screen.getByRole('button', { name: 'Test capture' }))

    expect(liveDevices.startMicrophoneCapture).toHaveBeenCalledWith({ deviceId: 'mic-1' })
    expect(liveDevices.startSystemAudioCapture).toHaveBeenCalledTimes(2)
  })

  it('does not stop or refresh idle sources when their setup toggles turn off', () => {
    const liveDevices = buildLiveDeviceInventoryReturn()
    liveWorkbenchPageMocks.useLiveDeviceInventoryMock.mockReturnValue(liveDevices)
    render(<LiveWorkbenchPage />)

    fireEvent.click(screen.getByRole('switch', { name: 'Microphone' }))
    fireEvent.click(screen.getByRole('switch', { name: 'System audio' }))
    fireEvent.click(screen.getByRole('switch', { name: 'System audio' }))

    expect(liveDevices.stopMicrophoneCapture).not.toHaveBeenCalled()
    expect(liveDevices.stopSystemAudioCapture).not.toHaveBeenCalled()
    expect(liveDevices.refreshDevices).not.toHaveBeenCalled()
  })
})
