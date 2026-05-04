export const UI_PREFERENCES_STORAGE_KEY = 'nola-ui-preferences'

export const UI_LANGUAGES = ['en', 'zh'] as const
export const UI_UNITS = ['metric', 'imperial'] as const
export const UI_THEMES = ['system', 'light', 'dark'] as const

export type UiLanguage = (typeof UI_LANGUAGES)[number]
export type UiUnits = (typeof UI_UNITS)[number]
export type UiTheme = (typeof UI_THEMES)[number]

export interface UiPreferences {
  version: 1
  language: UiLanguage
  hasExplicitLanguagePreference: boolean
  theme: UiTheme
  units: UiUnits
}

export const DEFAULT_UI_LANGUAGE: UiLanguage = 'en'
export const DEFAULT_UI_UNITS: UiUnits = 'metric'
export const DEFAULT_UI_THEME: UiTheme = 'system'

export const DEFAULT_UI_PREFERENCES: UiPreferences = {
  version: 1,
  language: DEFAULT_UI_LANGUAGE,
  hasExplicitLanguagePreference: false,
  theme: DEFAULT_UI_THEME,
  units: DEFAULT_UI_UNITS,
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function isUiLanguage(value: unknown): value is UiLanguage {
  return typeof value === 'string' && UI_LANGUAGES.some((language) => language === value)
}

export function isUiUnits(value: unknown): value is UiUnits {
  return typeof value === 'string' && UI_UNITS.some((units) => units === value)
}

export function isUiTheme(value: unknown): value is UiTheme {
  return typeof value === 'string' && UI_THEMES.some((theme) => theme === value)
}

export function normalizeUiLanguage(value: unknown): UiLanguage | null {
  if (typeof value !== 'string' || value.trim() === '') {
    return null
  }

  const normalized = value.trim().toLowerCase().split(/[-_]/, 1)[0]

  return isUiLanguage(normalized) ? normalized : null
}

export function normalizeUiPreferences(value: unknown): UiPreferences {
  const preferences = isRecord(value) ? value : {}
  const normalizedLanguage = normalizeUiLanguage(preferences.language)
  const normalizedTheme = isUiTheme(preferences.theme) ? preferences.theme : DEFAULT_UI_THEME
  const normalizedUnits = isUiUnits(preferences.units) ? preferences.units : DEFAULT_UI_UNITS

  return {
    version: 1,
    language: normalizedLanguage ?? DEFAULT_UI_LANGUAGE,
    hasExplicitLanguagePreference:
      normalizedLanguage !== null && preferences.hasExplicitLanguagePreference === true,
    theme: normalizedTheme,
    units: normalizedUnits,
  }
}
