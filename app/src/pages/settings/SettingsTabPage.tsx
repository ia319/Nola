import type { ComponentType } from 'react'

import type { SettingsTabKey } from './settings-tabs'
import { ExportTab } from './ExportTab'
import { GeneralTab } from './GeneralTab'
import { ModelStorageTab } from './ModelStorageTab'
import { SystemInfoTab } from './SystemInfoTab'
import { TranscriptionTab } from './TranscriptionTab'

const SETTINGS_TAB_COMPONENTS: Record<SettingsTabKey, ComponentType> = {
  general: GeneralTab,
  transcription: TranscriptionTab,
  export: ExportTab,
  'model-storage': ModelStorageTab,
  'system-info': SystemInfoTab,
}

interface SettingsTabPageProps {
  tab: SettingsTabKey
}

export function SettingsTabPage({ tab }: SettingsTabPageProps) {
  const ActiveTabComponent = SETTINGS_TAB_COMPONENTS[tab]

  return <ActiveTabComponent />
}
