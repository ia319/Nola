// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import {
  LiveWorkbenchSessionSetup,
  type LiveWorkbenchSessionSetupProps,
} from '../LiveWorkbenchSessionSetup'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const messages: Record<string, string> = {
        'live.workbench.sessionSetup.title': 'Session setup',
        'live.workbench.sessionSetup.settings': 'Session settings',
        'live.workbench.sessionSetup.model.label': 'Model',
        'live.workbench.sessionSetup.runtime.label': 'Runtime',
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
    settingsOpen: false,
    onModelChange: vi.fn(),
    onTaskChange: vi.fn(),
    onLanguageChange: vi.fn(),
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
    })

    expect(screen.getByLabelText('Model')).toBeDisabled()
    expect(screen.getByLabelText('Task')).toBeDisabled()
    expect(screen.getByLabelText('Language')).toBeDisabled()
  })
})
