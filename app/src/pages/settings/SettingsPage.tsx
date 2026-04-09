import type { ComponentType } from 'react'

import { useParams } from '@tanstack/react-router'

import { SettingsLayout, type SettingsTabKey } from '@/layouts'

import { ExportTab } from './ExportTab'
import { GeneralTab } from './GeneralTab'
import { ModelStorageTab } from './ModelStorageTab'
import { isSettingsTabKey } from './settings-tabs'
import { SystemInfoTab } from './SystemInfoTab'
import { TranscriptionTab } from './TranscriptionTab'

const SETTINGS_TAB_COMPONENTS: Record<SettingsTabKey, ComponentType> = {
  general: GeneralTab,
  transcription: TranscriptionTab,
  export: ExportTab,
  'model-storage': ModelStorageTab,
  'system-info': SystemInfoTab,
}

export function SettingsPage() {
  const { tab } = useParams({ from: '/settings/$tab' })
  const activeTab = isSettingsTabKey(tab) ? tab : 'general'
  const ActiveTabComponent = SETTINGS_TAB_COMPONENTS[activeTab]

  return (
    <SettingsLayout activeTab={activeTab}>
      <ActiveTabComponent />
    </SettingsLayout>
  )
}
