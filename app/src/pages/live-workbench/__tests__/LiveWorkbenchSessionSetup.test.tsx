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
        'live.workbench.sessionSetup.sources.level': `Level ${options?.percent ?? 0}%`,
        'live.workbench.sessionSetup.microphone.title': 'Microphone',
        'live.workbench.sessionSetup.microphone.description': 'Choose an input device.',
        'live.workbench.sessionSetup.microphone.device': 'Input device',
        'live.workbench.sessionSetup.systemAudio.title': 'System audio',
        'live.workbench.sessionSetup.systemAudio.description': 'Capture system audio explicitly.',
        'live.workbench.sessionSetup.systemAudio.captureSource.label': 'Capture source',
        'live.workbench.sessionSetup.systemAudio.actions.start': 'Start',
        'live.workbench.sessionSetup.systemAudio.actions.test': 'Test capture',
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
    engineDeviceValue: 'auto',
    engineDeviceOptions: [{ value: 'auto', label: 'Auto' }],
    engineDeviceLabel: 'Device',
    engineComputeTypeValue: 'default',
    engineComputeTypeOptions: [{ value: 'default', label: 'Default' }],
    engineComputeTypeLabel: 'Compute Type',
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
    systemAudioCaptureSourceActionLabel: 'Start',
    systemAudioActionLabel: 'Test capture',
    systemAudioActionDisabled: true,
    systemAudioActionMode: 'test',
    settingsOpen: false,
    onModelChange: vi.fn(),
    onTaskChange: vi.fn(),
    onLanguageChange: vi.fn(),
    onEngineDeviceChange: vi.fn(),
    onEngineComputeTypeChange: vi.fn(),
    onMicrophoneEnabledChange: vi.fn(),
    onMicrophoneChange: vi.fn(),
    onMicrophoneAction: vi.fn(),
    onSystemAudioEnabledChange: vi.fn(),
    onSystemAudioAction: vi.fn(),
    onSettingsToggle: vi.fn(),
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
    expect(screen.getByLabelText('Device')).toBeTruthy()
    expect(screen.getByText('Auto')).toBeTruthy()
    expect(screen.getByLabelText('Compute Type')).toBeTruthy()
    expect(screen.getByText('Default')).toBeTruthy()
    expect(screen.getByText('Microphone')).toBeTruthy()
    expect(screen.getByLabelText('Input device')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Test microphone' })).toBeTruthy()
    expect(screen.getByText('System audio')).toBeTruthy()
    expect(screen.getByText('Capture source')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Start' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Test capture' })).toBeDisabled()
  })

  it('keeps the settings entry visible while the settings panel is open', () => {
    renderSessionSetup({ settingsOpen: true })

    expect(screen.getByRole('button', { name: 'Session settings' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
  })

  it('toggles settings from the setup card', () => {
    const onSettingsToggle = vi.fn()
    renderSessionSetup({ onSettingsToggle })

    fireEvent.click(screen.getByRole('button', { name: 'Session settings' }))

    expect(onSettingsToggle).toHaveBeenCalledTimes(1)
  })

  it('disables unavailable setup controls without removing their labels', () => {
    renderSessionSetup({
      modelDisabled: true,
      taskDisabled: true,
      languageDisabled: true,
      engineDeviceDisabled: true,
      engineComputeTypeDisabled: true,
      microphoneDisabled: true,
      systemAudioDisabled: true,
    })

    expect(screen.getByLabelText('Model')).toBeDisabled()
    expect(screen.getByLabelText('Task')).toBeDisabled()
    expect(screen.getByLabelText('Language')).toBeDisabled()
    expect(screen.getByLabelText('Device')).toBeDisabled()
    expect(screen.getByLabelText('Compute Type')).toBeDisabled()
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
