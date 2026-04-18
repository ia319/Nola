import {
  DEFAULT_UI_PREFERENCES,
  isTauriRuntime,
  isUiTheme,
  isUiUnits,
  normalizeUiLanguage,
  normalizeUiPreferences,
  type UiPreferences,
  UI_PREFERENCES_STORAGE_KEY,
} from './ui-preferences'

const LEGACY_LANGUAGE_STORAGE_KEY = 'nola-language'
const LEGACY_THEME_STORAGE_KEY = 'nola-theme'
const LEGACY_UNITS_STORAGE_KEY = 'nola-units'

export interface UiPreferencesRepository {
  load(): Promise<UiPreferences>
  save(next: UiPreferences): Promise<void>
}

function getBrowserStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.localStorage
  } catch {
    return null
  }
}

function readLegacyUiPreferences(storage: Storage): UiPreferences {
  const language = normalizeUiLanguage(storage.getItem(LEGACY_LANGUAGE_STORAGE_KEY))
  const theme = storage.getItem(LEGACY_THEME_STORAGE_KEY)
  const units = storage.getItem(LEGACY_UNITS_STORAGE_KEY)

  return normalizeUiPreferences({
    language: language ?? DEFAULT_UI_PREFERENCES.language,
    hasExplicitLanguagePreference: Boolean(language),
    theme: theme && isUiTheme(theme) ? theme : DEFAULT_UI_PREFERENCES.theme,
    units: units && isUiUnits(units) ? units : DEFAULT_UI_PREFERENCES.units,
  })
}

function parseStoredUiPreferences(rawValue: string | null): UiPreferences | null {
  if (!rawValue) {
    return null
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<UiPreferences>
    return normalizeUiPreferences(parsed)
  } catch {
    return null
  }
}

class BrowserUiPreferencesRepository implements UiPreferencesRepository {
  async load(): Promise<UiPreferences> {
    const storage = getBrowserStorage()

    if (!storage) {
      return DEFAULT_UI_PREFERENCES
    }

    const storedPreferences = parseStoredUiPreferences(storage.getItem(UI_PREFERENCES_STORAGE_KEY))
    if (storedPreferences) {
      return storedPreferences
    }

    return readLegacyUiPreferences(storage)
  }

  async save(next: UiPreferences): Promise<void> {
    const storage = getBrowserStorage()
    if (!storage) {
      return
    }

    const normalized = normalizeUiPreferences(next)
    storage.setItem(UI_PREFERENCES_STORAGE_KEY, JSON.stringify(normalized))
    storage.removeItem(LEGACY_LANGUAGE_STORAGE_KEY)
    storage.removeItem(LEGACY_THEME_STORAGE_KEY)
    storage.removeItem(LEGACY_UNITS_STORAGE_KEY)
  }
}

class DesktopUiPreferencesRepository implements UiPreferencesRepository {
  // Replace this adapter with Tauri store I/O before enabling desktop persistence.
  private readonly fallback = new BrowserUiPreferencesRepository()

  async load(): Promise<UiPreferences> {
    return this.fallback.load()
  }

  async save(next: UiPreferences): Promise<void> {
    await this.fallback.save(next)
  }
}

export function createUiPreferencesRepository(): UiPreferencesRepository {
  return isTauriRuntime()
    ? new DesktopUiPreferencesRepository()
    : new BrowserUiPreferencesRepository()
}
