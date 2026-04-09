import { SETTINGS_TABS, type SettingsTabKey } from '@/layouts'

const VALID_SETTINGS_TAB_KEYS = new Set<SettingsTabKey>(SETTINGS_TABS.map((tab) => tab.key))

export const DEFAULT_SETTINGS_TAB = SETTINGS_TABS[0].key

export function isSettingsTabKey(value: string): value is SettingsTabKey {
  return VALID_SETTINGS_TAB_KEYS.has(value as SettingsTabKey)
}
