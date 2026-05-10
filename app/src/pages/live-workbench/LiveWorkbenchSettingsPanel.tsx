import { useTranslation } from 'react-i18next'

import { Button, EmptyState } from '@/components/ui'
import {
  LiveRealtimeSchemaForm,
  type LiveRealtimeDraft,
  type LiveRealtimeDraftValue,
  type LiveRealtimeRunState,
} from '@/features/realtime'
import { WorkspaceSidePanel } from '@/layouts'
import type { LanguageOption, LiveRealtimeDefaults, LiveRealtimeOptionGroup } from '@/shared/types'

export interface LiveWorkbenchSettingsPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  runState: LiveRealtimeRunState
  defaults: LiveRealtimeDefaults | null
  schema: LiveRealtimeOptionGroup[]
  draft: LiveRealtimeDraft
  languages: LanguageOption[]
  loading: boolean
  unavailable: boolean
  controlsDisabled: boolean
  applyDisabled: boolean
  resetDraftDisabled: boolean
  saveDefaultsDisabled: boolean
  resetSavedDefaultsDisabled: boolean
  savingDefaults: boolean
  resettingDefaults: boolean
  onDraftChange: (key: string, value: LiveRealtimeDraftValue | undefined) => void
  onApplyDraft: () => void
  onResetDraft: () => void
  onSaveDefaults: () => void
  onResetSavedDefaults: () => void
  onRetry: () => void
}

export function LiveWorkbenchSettingsPanel({
  open,
  onOpenChange,
  runState,
  defaults,
  schema,
  draft,
  languages,
  loading,
  unavailable,
  controlsDisabled,
  applyDisabled,
  resetDraftDisabled,
  saveDefaultsDisabled,
  resetSavedDefaultsDisabled,
  savingDefaults,
  resettingDefaults,
  onDraftChange,
  onApplyDraft,
  onResetDraft,
  onSaveDefaults,
  onResetSavedDefaults,
  onRetry,
}: LiveWorkbenchSettingsPanelProps) {
  const { t } = useTranslation()
  const canRenderControls = !loading && !unavailable && defaults !== null && schema.length > 0

  const footer = canRenderControls ? (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={resetDraftDisabled}
          onClick={onResetDraft}
        >
          {t('live.workbench.settings.actions.resetDraft')}
        </Button>
        <Button type="button" size="sm" disabled={applyDisabled} onClick={onApplyDraft}>
          {t('live.workbench.settings.actions.apply')}
        </Button>
      </div>

      <div className="flex flex-wrap justify-between gap-2 border-t pt-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={resetSavedDefaultsDisabled}
          onClick={onResetSavedDefaults}
        >
          {resettingDefaults
            ? t('live.workbench.settings.actions.resettingDefaults')
            : t('live.workbench.settings.actions.resetSavedDefaults')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={saveDefaultsDisabled}
          onClick={onSaveDefaults}
        >
          {savingDefaults
            ? t('live.workbench.settings.actions.savingDefaults')
            : t('live.workbench.settings.actions.saveDefaults')}
        </Button>
      </div>
    </div>
  ) : undefined

  function renderBody() {
    if (loading) {
      return <p className="text-muted-foreground text-sm">{t('settings.liveRealtime.loading')}</p>
    }

    if (unavailable || !defaults || schema.length === 0) {
      return (
        <div className="space-y-3">
          <EmptyState
            title={t('live.workbench.settings.empty.title')}
            description={t('live.workbench.settings.empty.description')}
            className="border-0 bg-transparent px-0 py-6"
          />
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            {t('live.workbench.settings.actions.retry')}
          </Button>
        </div>
      )
    }

    return (
      <div className="space-y-5">
        <p className="text-muted-foreground text-xs leading-5">
          {t(`live.workbench.settings.state.${runState}`)}
        </p>
        <LiveRealtimeSchemaForm
          schema={schema}
          defaults={defaults}
          draft={draft}
          languages={languages}
          disabled={controlsDisabled}
          layout="panel"
          valueMode="override"
          domIdPrefix="live-workbench-settings"
          onChange={onDraftChange}
        />
      </div>
    )
  }

  return (
    <WorkspaceSidePanel
      open={open}
      onOpenChange={onOpenChange}
      title={t('live.workbench.settings.title')}
      description={t('live.workbench.settings.description')}
      footer={footer}
    >
      {renderBody()}
    </WorkspaceSidePanel>
  )
}
