export const SETTINGS_TABS = [
  {
    key: 'general',
    href: '/settings/general',
    labelKey: 'settings.tabs.general',
  },
  {
    key: 'transcription',
    href: '/settings/transcription',
    labelKey: 'settings.tabs.transcription',
  },
  {
    key: 'export',
    href: '/settings/export',
    labelKey: 'settings.tabs.export',
  },
  {
    key: 'model-storage',
    href: '/settings/model-storage',
    labelKey: 'settings.tabs.modelStorage',
  },
  {
    key: 'system-info',
    href: '/settings/system-info',
    labelKey: 'settings.tabs.systemInfo',
  },
] as const

export type SettingsTabKey = (typeof SETTINGS_TABS)[number]['key']
export type SettingsTabDefinition = (typeof SETTINGS_TABS)[number]

const VALID_SETTINGS_TAB_KEYS = new Set<SettingsTabKey>(SETTINGS_TABS.map((tab) => tab.key))

export const DEFAULT_SETTINGS_TAB = SETTINGS_TABS[0].key

export function isSettingsTabKey(value: string): value is SettingsTabKey {
  return VALID_SETTINGS_TAB_KEYS.has(value as SettingsTabKey)
}
