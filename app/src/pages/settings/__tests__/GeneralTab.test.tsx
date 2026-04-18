// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useUiPreferencesStore } from '@/app/locale/ui-preferences-store'
import { UI_PREFERENCES_STORAGE_KEY } from '@/config/ui-preferences'
import { DEFAULT_UI_PREFERENCES } from '@/config/ui-preferences'

const translationMocks = vi.hoisted(() => ({
  changeLanguage: vi.fn<(language: string) => Promise<void>>().mockResolvedValue(),
  language: 'en',
  resolvedLanguage: 'en',
}))

const themeMocks = vi.hoisted(() => ({
  setTheme: vi.fn<(theme: string) => void>(),
  theme: 'system' as 'system' | 'light' | 'dark',
}))

const routerMocks = vi.hoisted(() => ({
  navigate: vi.fn<(options: Record<string, unknown>) => void>(),
  pathname: '/settings/general',
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const messages: Record<string, string> = {
        'settings.general.sections.interface.label': 'Interface',
        'settings.general.sections.regional.label': 'Regional & Time',
        'settings.general.fields.language.label': 'Interface Language',
        'settings.general.fields.language.description':
          'Select the default language for application menus and notifications.',
        'settings.general.fields.appearance.label': 'Appearance',
        'settings.general.fields.appearance.description':
          'Choose how Nola appears on this screen. System follows the operating system theme.',
        'settings.general.fields.appearance.system': 'System',
        'settings.general.fields.appearance.light': 'Light',
        'settings.general.fields.appearance.dark': 'Dark',
        'settings.general.fields.timezone.label': 'Timezone',
        'settings.general.fields.timezone.description':
          'Read the local timezone from the current browser environment.',
        'settings.general.fields.units.label': 'Measurement Units',
        'settings.general.fields.units.description':
          'Display file sizes and processing speeds in metric or imperial units.',
        'settings.general.fields.units.metric': 'Metric',
        'settings.general.fields.units.imperial': 'Imperial',
        'settings.general.localOnly.title': 'Keep these preferences local',
        'settings.general.localOnly.description':
          'Store language, appearance, and units in this browser only.',
        'settings.general.localOnly.detail':
          'Configure the same preferences again when you switch to another browser profile or machine.',
        'options.language.en': 'English',
        'options.language.zh': 'Chinese',
      }

      return messages[key] ?? key
    },
    i18n: translationMocks,
  }),
}))

vi.mock('@/components/use-theme', () => ({
  useTheme: () => themeMocks,
}))

vi.mock('@tanstack/react-router', () => ({
  useLocation: ({ select }: { select?: (location: { pathname: string }) => string } = {}) =>
    select ? select({ pathname: routerMocks.pathname }) : { pathname: routerMocks.pathname },
  useNavigate: () => routerMocks.navigate,
}))

import { GeneralTab } from '../GeneralTab'

describe('GeneralTab', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useUiPreferencesStore.setState({
      preferences: DEFAULT_UI_PREFERENCES,
      isHydrated: true,
    })
    translationMocks.changeLanguage.mockClear()
    translationMocks.language = 'en'
    translationMocks.resolvedLanguage = 'en'
    themeMocks.setTheme.mockReset()
    themeMocks.theme = 'system'
    routerMocks.navigate.mockReset()
    routerMocks.pathname = '/settings/general'
  })

  afterEach(() => {
    window.localStorage.clear()
  })

  it('renders the planned General settings sections and browser-local note', () => {
    render(<GeneralTab />)

    expect(screen.getByText('Interface')).toBeTruthy()
    expect(screen.getByText('Regional & Time')).toBeTruthy()
    expect(screen.getByText('Keep these preferences local')).toBeTruthy()
    expect(screen.getByLabelText('Interface Language')).toHaveValue('en')
    expect(screen.getByLabelText('Appearance')).toHaveValue('system')
  })

  it('persists language, theme, and units changes from the General settings page', () => {
    render(<GeneralTab />)

    fireEvent.change(screen.getByLabelText('Interface Language'), {
      target: { value: 'zh' },
    })

    expect(window.localStorage.getItem(UI_PREFERENCES_STORAGE_KEY)).toBe(
      JSON.stringify({
        version: 1,
        language: 'zh',
        hasExplicitLanguagePreference: true,
        theme: 'system',
        units: 'metric',
      }),
    )
    expect(translationMocks.changeLanguage).toHaveBeenCalledTimes(1)
    expect(translationMocks.changeLanguage).toHaveBeenCalledWith('zh')
    expect(routerMocks.navigate).toHaveBeenCalledWith({
      to: '/zh/settings/general',
      replace: true,
      search: true,
      hash: true,
    })

    fireEvent.change(screen.getByLabelText('Appearance'), {
      target: { value: 'dark' },
    })

    expect(themeMocks.setTheme).toHaveBeenCalledTimes(1)
    expect(themeMocks.setTheme).toHaveBeenCalledWith('dark')

    fireEvent.click(screen.getByLabelText('Imperial'))

    expect(window.localStorage.getItem(UI_PREFERENCES_STORAGE_KEY)).toBe(
      JSON.stringify({
        version: 1,
        language: 'zh',
        hasExplicitLanguagePreference: true,
        theme: 'system',
        units: 'imperial',
      }),
    )
    expect(screen.getByLabelText('Imperial')).toBeChecked()
  })
})
