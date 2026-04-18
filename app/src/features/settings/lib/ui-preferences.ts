export {
  DEFAULT_UI_LANGUAGE,
  DEFAULT_UI_PREFERENCES,
  DEFAULT_UI_THEME,
  DEFAULT_UI_UNITS,
  isUiLanguage,
  isUiTheme,
  isUiUnits,
  normalizeUiLanguage,
  normalizeUiPreferences,
  type UiLanguage,
  type UiPreferences,
  type UiTheme,
  type UiUnits,
  UI_LANGUAGES,
  UI_THEMES,
  UI_UNITS,
} from '@/config/ui-preferences'

export function formatUtcOffset(offsetMinutes: number): string {
  const sign = offsetMinutes >= 0 ? '+' : '-'
  const absoluteMinutes = Math.abs(offsetMinutes)
  const hours = String(Math.floor(absoluteMinutes / 60)).padStart(2, '0')
  const minutes = String(absoluteMinutes % 60).padStart(2, '0')

  return `UTC${sign}${hours}:${minutes}`
}

export function buildTimezoneLabel(timeZone: string, offsetMinutes: number): string {
  return `${formatUtcOffset(offsetMinutes)} (${timeZone})`
}

export function getLocalTimezoneLabel(now: Date = new Date()): string {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  const offsetMinutes = -now.getTimezoneOffset()

  return buildTimezoneLabel(timeZone, offsetMinutes)
}
