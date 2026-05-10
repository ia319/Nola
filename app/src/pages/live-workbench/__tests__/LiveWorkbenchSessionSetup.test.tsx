// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import {
  LiveWorkbenchSessionSetup,
  type LiveWorkbenchSessionSetupProps,
} from '../LiveWorkbenchSessionSetup'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { percent?: number }) => {
      const messages: Record<string, string> = {
        'live.workbench.sessionSetup.title': 'Session setup',
        'live.workbench.sessionSetup.settings': 'Session settings',
        'live.workbench.sessionSetup.model.label': 'Model',
        'live.workbench.sessionSetup.runtime.label': 'Runtime',
        'live.workbench.sessionSetup.sources.level': `Level ${options?.percent ?? 0}%`,
        'live.workbench.sessionSetup.microphone.title': 'Microphone',
        'live.workbench.sessionSetup.microphone.description': 'Choose an input device.',
        'live.workbench.sessionSetup.microphone.device': 'Input device',
        'live.workbench.sessionSetup.systemAudio.title': 'System audio',
        'live.workbench.sessionSetup.systemAudio.description': 'Capture system audio explicitly.',
        'live.workbench.sessionSetup.systemAudio.captureSource.label': 'Capture source',
      }

      return messages[key] ?? key
    },
  }),
}))

function renderSessionSetup(overrides: Partial<LiveWorkbenchSessionSetupProps> = {}) {
  const props: LiveWorkbenchSessionSetupProps = {
    modelValue: 'small',
    modelOptions: [{ value: 'small', label: 'Small' }],
    taskValue: 'transcribe',
    taskOptions: [{ value: 'transcribe', label: 'Transcribe' }],
    taskLabel: 'Task',
    languageValue: '__auto__',
    languageOptions: [{ value: '__auto__', label: 'Auto detect' }],
    languageLabel: 'Language',
    runtimeSummary: 'auto / default',
    microphoneEnabled: true,
    microphoneValue: '__default_microphone__',
    microphoneOptions: [
      { value: '__default_microphone__', label: 'System default' },
      { value: 'mic-1', label: 'Studio USB microphone' },
    ],
    microphoneStatus: 'Ready',
    microphoneStatusTone: 'success',
    microphoneLevelPercent: 42,
    microphoneActionLabel: 'Test microphone',
    microphoneActionMode: 'test',
    systemAudioEnabled: false,
    systemAudioStatus: 'Browser capture available',
    systemAudioStatusTone: 'warning',
    systemAudioLevelPercent: 0,
    systemAudioCaptureSource: 'Browser capture prompt',
    systemAudioActionLabel: 'Test capture',
    systemAudioActionDisabled: true,
    systemAudioActionMode: 'test',
    settingsOpen: false,
    onModelChange: vi.fn(),
    onTaskChange: vi.fn(),
    onLanguageChange: vi.fn(),
    onMicrophoneEnabledChange: vi.fn(),
    onMicrophoneChange: vi.fn(),
    onMicrophoneAction: vi.fn(),
    onSystemAudioEnabledChange: vi.fn(),
    onSystemAudioAction: vi.fn(),
    onOpenSettings: vi.fn(),
    ...overrides,
  }

  return {
    props,
    ...render(<LiveWorkbenchSessionSetup {...props} />),
  }
}

describe('LiveWorkbenchSessionSetup', () => {
  it('renders the compact startup controls and read-only runtime summary', () => {
    renderSessionSetup()

    expect(screen.getByRole('heading', { level: 2, name: 'Session setup' })).toBeTruthy()
    expect(screen.getByLabelText('Model')).toBeTruthy()
    expect(screen.getByLabelText('Task')).toBeTruthy()
    expect(screen.getByLabelText('Language')).toBeTruthy()
    expect(screen.getByText('Runtime')).toBeTruthy()
    expect(screen.getByText('auto / default')).toBeTruthy()
    expect(screen.getByText('Microphone')).toBeTruthy()
    expect(screen.getByLabelText('Input device')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Test microphone' })).toBeTruthy()
    expect(screen.getByText('System audio')).toBeTruthy()
    expect(screen.getByText('Capture source')).toBeTruthy()
    expect(screen.getByText('Browser capture prompt')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Test capture' })).toBeDisabled()
  })

  it('hides the settings entry while the settings panel is open', () => {
    renderSessionSetup({ settingsOpen: true })

    expect(screen.queryByRole('button', { name: 'Session settings' })).toBeNull()
  })

  it('opens settings from the setup card when closed', () => {
    const onOpenSettings = vi.fn()
    renderSessionSetup({ onOpenSettings })

    fireEvent.click(screen.getByRole('button', { name: 'Session settings' }))

    expect(onOpenSettings).toHaveBeenCalledTimes(1)
  })

  it('disables unavailable setup controls without removing their labels', () => {
    renderSessionSetup({
      modelDisabled: true,
      taskDisabled: true,
      languageDisabled: true,
      microphoneDisabled: true,
      systemAudioDisabled: true,
    })

    expect(screen.getByLabelText('Model')).toBeDisabled()
    expect(screen.getByLabelText('Task')).toBeDisabled()
    expect(screen.getByLabelText('Language')).toBeDisabled()
    expect(screen.getByLabelText('Input device')).toBeDisabled()
    expect(screen.getByRole('switch', { name: 'Microphone' })).toBeDisabled()
    expect(screen.getByRole('switch', { name: 'System audio' })).toBeDisabled()
  })

  it('emits source control actions', () => {
    const onMicrophoneAction = vi.fn()
    const onSystemAudioEnabledChange = vi.fn()
    renderSessionSetup({
      onMicrophoneAction,
      onSystemAudioEnabledChange,
    })

    fireEvent.click(screen.getByRole('button', { name: 'Test microphone' }))
    fireEvent.click(screen.getByRole('switch', { name: 'System audio' }))

    expect(onMicrophoneAction).toHaveBeenCalledTimes(1)
    expect(onSystemAudioEnabledChange).toHaveBeenCalledWith(true)
  })
})
