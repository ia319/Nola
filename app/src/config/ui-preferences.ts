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

export function isUiLanguage(value: string): value is UiLanguage {
  return UI_LANGUAGES.includes(value as UiLanguage)
}

export function isUiUnits(value: string): value is UiUnits {
  return UI_UNITS.includes(value as UiUnits)
}

export function isUiTheme(value: string): value is UiTheme {
  return UI_THEMES.includes(value as UiTheme)
}

export function normalizeUiLanguage(value: string | null | undefined): UiLanguage | null {
  if (!value) {
    return null
  }

  const normalized = value.trim().toLowerCase().split(/[-_]/, 1)[0]

  return isUiLanguage(normalized) ? normalized : null
}

export function normalizeUiPreferences(
  value: Partial<UiPreferences> | null | undefined,
): UiPreferences {
  const normalizedLanguage = normalizeUiLanguage(value?.language)
  const normalizedTheme = value?.theme && isUiTheme(value.theme) ? value.theme : DEFAULT_UI_THEME
  const normalizedUnits = value?.units && isUiUnits(value.units) ? value.units : DEFAULT_UI_UNITS

  return {
    version: 1,
    language: normalizedLanguage ?? DEFAULT_UI_LANGUAGE,
    hasExplicitLanguagePreference: Boolean(value?.hasExplicitLanguagePreference),
    theme: normalizedTheme,
    units: normalizedUnits,
  }
}

export function isTauriRuntime(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  return '__TAURI__' in window || '__TAURI_INTERNALS__' in window
}
