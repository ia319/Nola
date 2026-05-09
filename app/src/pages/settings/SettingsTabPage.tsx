import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from 'react'
import { useTranslation } from 'react-i18next'

import type { SettingsTabKey } from './settings-tabs'

const GeneralTab = lazy(async () => {
  const module = await import('./GeneralTab')
  return { default: module.GeneralTab }
})
const TranscriptionTab = lazy(async () => {
  const module = await import('./TranscriptionTab')
  return { default: module.TranscriptionTab }
})
const LiveRealtimeTab = lazy(async () => {
  const module = await import('./LiveRealtimeTab')
  return { default: module.LiveRealtimeTab }
})
const ExportTab = lazy(async () => {
  const module = await import('./ExportTab')
  return { default: module.ExportTab }
})
const ModelStorageTab = lazy(async () => {
  const module = await import('./ModelStorageTab')
  return { default: module.ModelStorageTab }
})
const SystemInfoTab = lazy(async () => {
  const module = await import('./SystemInfoTab')
  return { default: module.SystemInfoTab }
})

type SettingsTabComponent = LazyExoticComponent<ComponentType>

const SETTINGS_TAB_COMPONENTS = {
  general: GeneralTab,
  transcription: TranscriptionTab,
  'live-realtime': LiveRealtimeTab,
  export: ExportTab,
  'model-storage': ModelStorageTab,
  'system-info': SystemInfoTab,
} satisfies Record<SettingsTabKey, SettingsTabComponent>

interface SettingsTabPageProps {
  tab: SettingsTabKey
}

export function SettingsTabPage({ tab }: SettingsTabPageProps) {
  const { t } = useTranslation()
  const ActiveTabComponent = SETTINGS_TAB_COMPONENTS[tab]

  return (
    <Suspense
      fallback={
        <div
          role="status"
          aria-live="polite"
          className="text-muted-foreground flex min-h-64 items-center justify-center text-sm"
        >
          {t('routes.loading.settings')}
        </div>
      }
    >
      <ActiveTabComponent />
    </Suspense>
  )
}
