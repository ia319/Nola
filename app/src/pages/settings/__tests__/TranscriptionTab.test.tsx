// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { buildTranscriptionDefaults } from '@/test-utils/transcription-defaults'
import type { AppConfig } from '@/shared/types'
import { TEST_ENGINE_SCHEMA } from '@/test-utils/engine-schema'

const transcriptionTabMocks = vi.hoisted(() => ({
  fetchEngineDefaultsMock: vi.fn(),
  patchTranscriptionDefaultsMock: vi.fn(),
  deleteTranscriptionDefaultsMock: vi.fn(),
  refreshAppConfigMock: vi.fn(),
  useAppConfigMock: vi.fn(),
  setLanguageMock: vi.fn(),
  setTaskMock: vi.fn(),
  setAdvancedOptionMock: vi.fn(),
  resetAdvancedOptionsMock: vi.fn(),
  resetOptionOverridesMock: vi.fn(),
  setInitialPromptMock: vi.fn(),
  useTranscriptionOptionsMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
  toastWarningMock: vi.fn(),
  loggerErrorMock: vi.fn(),
  loggerWarnMock: vi.fn(),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const messages: Record<string, string> = {
        'settings.transcription.loading': 'Loading transcription defaults...',
        'settings.transcription.unavailable': 'Transcription defaults are not available.',
        'settings.transcription.sections.basic.label': 'Basic Defaults',
        'settings.transcription.sections.advanced.label': 'Advanced Defaults',
        'settings.transcription.sections.engineDefaults.label': 'Engine Defaults',
        'settings.transcription.sections.engineDefaults.show': 'Show Engine Defaults',
        'settings.transcription.sections.engineDefaults.hide': 'Hide Engine Defaults',
        'settings.transcription.sections.engineDefaults.closedNote':
          'Review overridden values against the engine baseline.',
        'settings.transcription.sections.engineDefaults.loading': 'Loading engine defaults...',
        'settings.transcription.sections.engineDefaults.retry': 'Retry',
        'settings.transcription.sections.engineDefaults.noOverrides':
          'Current defaults already match the engine baseline.',
        'settings.transcription.sections.engineDefaults.columns.field': 'Field',
        'settings.transcription.sections.engineDefaults.columns.current': 'Current Default',
        'settings.transcription.sections.engineDefaults.columns.engine': 'Engine Default',
        'settings.transcription.sections.resources.label': 'Resource Allocation',
        'settings.transcription.fields.language.description':
          'Choose the default language for new transcription tasks.',
        'settings.transcription.fields.task.description':
          'Choose the default task mode for new transcription tasks.',
        'settings.transcription.fields.initialPrompt.description':
          'Provide the default prompt context applied before decoding starts.',
        'settings.transcription.resources.modelProfile.label': 'Model Profile',
        'settings.transcription.resources.modelProfile.description':
          'Review the current engine model profile in read-only form.',
        'settings.transcription.resources.device.label': 'Device',
        'settings.transcription.resources.device.description':
          'Review which execution device the engine currently targets.',
        'settings.transcription.resources.computeType.label': 'Compute Type',
        'settings.transcription.resources.computeType.description':
          'Review the active numeric precision for engine execution.',
        'settings.transcription.resources.languageMode.label': 'Language Mode',
        'settings.transcription.resources.languageMode.description':
          'Review whether the current engine build supports multilingual decoding.',
        'settings.transcription.values.enabled': 'Enabled',
        'settings.transcription.values.disabled': 'Disabled',
        'settings.transcription.values.empty': 'Not set',
        'settings.transcription.values.multilingual': 'Multilingual',
        'settings.transcription.values.englishOnly': 'English-only',
        'options.language.label': 'Language',
        'options.language.auto': 'Auto Detect',
        'options.language.en': 'English',
        'options.language.ja': 'Japanese',
        'options.task.label': 'Task',
        'options.task.transcribe': 'Transcribe',
        'options.task.translate': 'Transcribe & Translate to English',
        'options.field.initialPrompt': 'Initial Prompt',
        'options.field.beamSize': 'Beam Size',
        'options.field.vadFilter': 'VAD Filter',
        'options.field.wordTimestamps': 'Word Timestamps',
        'options.defaults.save': 'Save as Defaults',
        'options.defaults.saving': 'Saving...',
        'options.defaults.resetEngine': 'Reset to Engine Defaults',
        'options.defaults.resetting': 'Resetting...',
        'options.defaults.saved': 'Defaults saved',
        'options.defaults.saveRequiresEngineDefaults': 'Load engine defaults and retry saving.',
        'options.defaults.resetDone': 'Defaults reset to engine values',
        'options.defaults.savedRefreshFailed':
          'Defaults saved. Refresh the page to load the latest values.',
        'options.defaults.resetRefreshFailed':
          'Defaults reset. Refresh the page to load the latest values.',
        'error.api.serverError': 'Server error',
      }

      return messages[key] ?? key
    },
  }),
}))

vi.mock('sonner', () => ({
  toast: {
    success: transcriptionTabMocks.toastSuccessMock,
    error: transcriptionTabMocks.toastErrorMock,
    warning: transcriptionTabMocks.toastWarningMock,
  },
}))

vi.mock('@/config/logger', () => ({
  default: {
    error: transcriptionTabMocks.loggerErrorMock,
    warn: transcriptionTabMocks.loggerWarnMock,
  },
}))

vi.mock('@/config/api', () => ({
  fetchEngineDefaults: transcriptionTabMocks.fetchEngineDefaultsMock,
  patchTranscriptionDefaults: transcriptionTabMocks.patchTranscriptionDefaultsMock,
  deleteTranscriptionDefaults: transcriptionTabMocks.deleteTranscriptionDefaultsMock,
}))

vi.mock('@/config/use-app-config', () => ({
  useAppConfig: transcriptionTabMocks.useAppConfigMock,
  refreshAppConfig: transcriptionTabMocks.refreshAppConfigMock,
}))

vi.mock('@/features/transcription-options', () => ({
  AdvancedOptions: () => (
    <div data-testid="settings-transcription-advanced-options">Advanced options</div>
  ),
  useTranscriptionOptions: transcriptionTabMocks.useTranscriptionOptionsMock,
}))

import { TranscriptionTab } from '../TranscriptionTab'

function buildConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  const config: AppConfig = {
    engine: {
      model_size: 'large-v3',
      device: 'cuda',
      compute_type: 'float16',
      is_multilingual: true,
      schema: TEST_ENGINE_SCHEMA,
    },
    transcription: {
      defaults: buildTranscriptionDefaults(),
      schema: [
        {
          group: 'general',
          group_label_key: 'options.group.general',
          fields: [
            {
              type: 'select',
              key: 'language',
              label_key: 'options.language.label',
              options_source: 'effective_languages',
              options: [],
            },
            {
              type: 'select',
              key: 'task',
              label_key: 'options.task.label',
              options: [
                { value: 'transcribe', label_key: 'options.task.transcribe' },
                { value: 'translate', label_key: 'options.task.translate' },
              ],
            },
            {
              type: 'text',
              key: 'initial_prompt',
              label_key: 'options.field.initialPrompt',
            },
          ],
        },
        {
          group: 'decoding',
          group_label_key: 'options.group.decoding',
          fields: [
            {
              type: 'number',
              key: 'beam_size',
              label_key: 'options.field.beamSize',
            },
            {
              type: 'switch',
              key: 'vad_filter',
              label_key: 'options.field.vadFilter',
            },
            {
              type: 'switch',
              key: 'word_timestamps',
              label_key: 'options.field.wordTimestamps',
            },
          ],
        },
      ],
    },
    file: { allowed_extensions: [], allowed_mime_types: [], max_file_size: 0 },
    effective_languages: [
      { code: 'en', label_key: 'options.language.en' },
      { code: 'ja', label_key: 'options.language.ja' },
    ],
  }

  return {
    ...config,
    ...overrides,
  }
}

describe('TranscriptionTab', () => {
  beforeEach(() => {
    transcriptionTabMocks.fetchEngineDefaultsMock.mockReset()
    transcriptionTabMocks.patchTranscriptionDefaultsMock.mockReset()
    transcriptionTabMocks.deleteTranscriptionDefaultsMock.mockReset()
    transcriptionTabMocks.refreshAppConfigMock.mockReset()
    transcriptionTabMocks.useAppConfigMock.mockReset()
    transcriptionTabMocks.setLanguageMock.mockReset()
    transcriptionTabMocks.setTaskMock.mockReset()
    transcriptionTabMocks.setAdvancedOptionMock.mockReset()
    transcriptionTabMocks.resetAdvancedOptionsMock.mockReset()
    transcriptionTabMocks.resetOptionOverridesMock.mockReset()
    transcriptionTabMocks.setInitialPromptMock.mockReset()
    transcriptionTabMocks.useTranscriptionOptionsMock.mockReset()
    transcriptionTabMocks.toastSuccessMock.mockReset()
    transcriptionTabMocks.toastErrorMock.mockReset()
    transcriptionTabMocks.toastWarningMock.mockReset()
    transcriptionTabMocks.loggerErrorMock.mockReset()
    transcriptionTabMocks.loggerWarnMock.mockReset()

    transcriptionTabMocks.useAppConfigMock.mockReturnValue({
      config: buildConfig(),
      isLoading: false,
      fileValidationConfig: { allowedExtensions: [], allowedMimeTypes: [], maxFileSize: 0 },
    })
    transcriptionTabMocks.useTranscriptionOptionsMock.mockReturnValue({
      language: 'ja',
      task: 'translate',
      advancedOptions: { beam_size: 9, word_timestamps: true },
      defaults: buildTranscriptionDefaults(),
      setLanguage: transcriptionTabMocks.setLanguageMock,
      setTask: transcriptionTabMocks.setTaskMock,
      setAdvancedOption: transcriptionTabMocks.setAdvancedOptionMock,
      resetAdvancedOptions: transcriptionTabMocks.resetAdvancedOptionsMock,
      resetOptionOverrides: transcriptionTabMocks.resetOptionOverridesMock,
      buildRequest: vi.fn(),
      initialPrompt: 'Use glossary',
      setInitialPrompt: transcriptionTabMocks.setInitialPromptMock,
    })

    transcriptionTabMocks.refreshAppConfigMock.mockResolvedValue(buildConfig())
    transcriptionTabMocks.fetchEngineDefaultsMock.mockResolvedValue({
      defaults: buildTranscriptionDefaults(),
    })
    transcriptionTabMocks.patchTranscriptionDefaultsMock.mockResolvedValue({})
    transcriptionTabMocks.deleteTranscriptionDefaultsMock.mockResolvedValue(undefined)
  })

  it('renders the transcription defaults editor with current config values', () => {
    render(<TranscriptionTab />)

    expect(screen.getByText('Basic Defaults')).toBeTruthy()
    expect(screen.getByText('Advanced Defaults')).toBeTruthy()
    expect(screen.getByText('Resource Allocation')).toBeTruthy()
    expect(screen.getByLabelText('Language')).toHaveValue('ja')
    expect(screen.getByLabelText('Task')).toHaveValue('translate')
    expect(screen.getByLabelText('Initial Prompt')).toHaveValue('Use glossary')
    expect(screen.getByText('Large V3')).toBeTruthy()
    expect(screen.getByTestId('settings-transcription-advanced-options')).toBeTruthy()
  })

  it('saves transcription defaults through the config patch API', async () => {
    render(<TranscriptionTab />)

    fireEvent.click(screen.getByRole('button', { name: 'Save as Defaults' }))

    await waitFor(() => {
      expect(transcriptionTabMocks.patchTranscriptionDefaultsMock).toHaveBeenCalledWith({
        language: 'ja',
        task: 'translate',
        beam_size: 9,
        word_timestamps: true,
        initial_prompt: 'Use glossary',
      })
    })

    expect(transcriptionTabMocks.refreshAppConfigMock).toHaveBeenCalledTimes(1)
    expect(transcriptionTabMocks.resetOptionOverridesMock).toHaveBeenCalledTimes(1)
    expect(transcriptionTabMocks.toastSuccessMock).toHaveBeenCalledWith('Defaults saved')
  })

  it('shows a save-specific error when engine defaults cannot load', async () => {
    transcriptionTabMocks.fetchEngineDefaultsMock.mockRejectedValueOnce(
      new Error('engine defaults unavailable'),
    )

    render(<TranscriptionTab />)

    fireEvent.click(screen.getByRole('button', { name: 'Save as Defaults' }))

    await waitFor(() => {
      expect(transcriptionTabMocks.fetchEngineDefaultsMock).toHaveBeenCalledTimes(1)
    })

    expect(transcriptionTabMocks.patchTranscriptionDefaultsMock).not.toHaveBeenCalled()
    expect(transcriptionTabMocks.toastErrorMock).toHaveBeenCalledWith(
      'Load engine defaults and retry saving.',
    )
  })

  it('warns when saved defaults cannot refresh into the page state', async () => {
    transcriptionTabMocks.refreshAppConfigMock.mockRejectedValueOnce(new Error('refresh failed'))

    render(<TranscriptionTab />)

    fireEvent.click(screen.getByRole('button', { name: 'Save as Defaults' }))

    await waitFor(() => {
      expect(transcriptionTabMocks.patchTranscriptionDefaultsMock).toHaveBeenCalledTimes(1)
    })

    expect(transcriptionTabMocks.resetOptionOverridesMock).not.toHaveBeenCalled()
    expect(transcriptionTabMocks.toastSuccessMock).not.toHaveBeenCalled()
    expect(transcriptionTabMocks.toastWarningMock).toHaveBeenCalledWith(
      'Defaults saved. Refresh the page to load the latest values.',
    )
  })

  it('resets transcription defaults back to engine values', async () => {
    render(<TranscriptionTab />)

    fireEvent.click(screen.getByRole('button', { name: 'Reset to Engine Defaults' }))

    await waitFor(() => {
      expect(transcriptionTabMocks.deleteTranscriptionDefaultsMock).toHaveBeenCalledTimes(1)
    })

    expect(transcriptionTabMocks.refreshAppConfigMock).toHaveBeenCalledTimes(1)
    expect(transcriptionTabMocks.resetOptionOverridesMock).toHaveBeenCalledTimes(1)
    expect(transcriptionTabMocks.toastSuccessMock).toHaveBeenCalledWith(
      'Defaults reset to engine values',
    )
  })

  it('warns when reset defaults cannot refresh into the page state', async () => {
    transcriptionTabMocks.refreshAppConfigMock.mockRejectedValueOnce(new Error('refresh failed'))

    render(<TranscriptionTab />)

    fireEvent.click(screen.getByRole('button', { name: 'Reset to Engine Defaults' }))

    await waitFor(() => {
      expect(transcriptionTabMocks.deleteTranscriptionDefaultsMock).toHaveBeenCalledTimes(1)
    })

    expect(transcriptionTabMocks.resetOptionOverridesMock).not.toHaveBeenCalled()
    expect(transcriptionTabMocks.toastSuccessMock).not.toHaveBeenCalled()
    expect(transcriptionTabMocks.toastWarningMock).toHaveBeenCalledWith(
      'Defaults reset. Refresh the page to load the latest values.',
    )
  })

  it('shows overridden fields against engine defaults when the comparison panel opens', async () => {
    transcriptionTabMocks.useAppConfigMock.mockReturnValue({
      config: buildConfig({
        transcription: {
          defaults: buildTranscriptionDefaults({ language: 'ja', beam_size: 7 }),
          schema: buildConfig().transcription.schema,
        },
      }),
      isLoading: false,
      fileValidationConfig: { allowedExtensions: [], allowedMimeTypes: [], maxFileSize: 0 },
    })
    transcriptionTabMocks.useTranscriptionOptionsMock.mockReturnValue({
      language: 'ja',
      task: 'translate',
      advancedOptions: { beam_size: 9, word_timestamps: true },
      defaults: buildTranscriptionDefaults({ language: 'ja', beam_size: 7 }),
      setLanguage: transcriptionTabMocks.setLanguageMock,
      setTask: transcriptionTabMocks.setTaskMock,
      setAdvancedOption: transcriptionTabMocks.setAdvancedOptionMock,
      resetAdvancedOptions: transcriptionTabMocks.resetAdvancedOptionsMock,
      resetOptionOverrides: transcriptionTabMocks.resetOptionOverridesMock,
      buildRequest: vi.fn(),
      initialPrompt: 'Use glossary',
      setInitialPrompt: transcriptionTabMocks.setInitialPromptMock,
    })

    render(<TranscriptionTab />)

    fireEvent.click(screen.getByRole('button', { name: 'Show Engine Defaults' }))

    await waitFor(() => {
      expect(transcriptionTabMocks.fetchEngineDefaultsMock).toHaveBeenCalledTimes(1)
    })

    expect(screen.getByText('Beam Size')).toBeTruthy()
    expect(screen.getAllByText('Japanese').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Auto Detect').length).toBeGreaterThan(0)
    expect(screen.getByText('7')).toBeTruthy()
    expect(screen.getByText('5')).toBeTruthy()
  })

  it('renders engine defaults load failures instead of the no-overrides state', async () => {
    transcriptionTabMocks.fetchEngineDefaultsMock.mockRejectedValueOnce(
      new Error('engine defaults unavailable'),
    )

    render(<TranscriptionTab />)

    fireEvent.click(screen.getByRole('button', { name: 'Show Engine Defaults' }))

    await waitFor(() => {
      expect(transcriptionTabMocks.fetchEngineDefaultsMock).toHaveBeenCalledTimes(1)
    })

    expect(screen.getByText('Server error')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
    expect(screen.queryByText('Current defaults already match the engine baseline.')).toBeNull()
  })
})
