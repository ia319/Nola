import { useTranslation } from 'react-i18next'

import { Button, EmptyState } from '@/components/ui'
import {
  LiveRealtimeSchemaForm,
  type LiveRealtimeDraft,
  type LiveRealtimeDraftValue,
  type LiveRealtimeRunState,
} from '@/features/realtime'
import { WorkspaceSidePanel } from '@/layouts'
import { getValueByPath } from '@/shared/lib/object-path'
import type {
  LanguageOption,
  LiveRealtimeAdapter,
  LiveRealtimeDefaults,
  LiveRealtimeOptionGroup,
} from '@/shared/types'

export interface LiveWorkbenchSettingsPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  runState: LiveRealtimeRunState
  resolvedSnapshot?: Record<string, unknown> | null
  defaults: LiveRealtimeDefaults | null
  schema: LiveRealtimeOptionGroup[]
  adapter: LiveRealtimeAdapter
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
  resolvedSnapshot,
  defaults,
  schema,
  adapter,
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
  const editable = runState === 'idle' || runState === 'failed'
  const snapshotEntries = buildRuntimeSnapshotEntries(schema, resolvedSnapshot, t)

  const footer =
    canRenderControls && editable ? (
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

    if (!editable) {
      return (
        <div className="space-y-5">
          <p className="text-muted-foreground text-xs leading-5">
            {t(`live.workbench.settings.state.${runState}`)}
          </p>
          {snapshotEntries.length > 0 ? (
            <dl className="space-y-3 rounded-md border p-4">
              {snapshotEntries.map((entry) => (
                <div key={entry.key} className="grid gap-1">
                  <dt className="text-foreground text-sm font-medium">{t(entry.labelKey)}</dt>
                  <dd className="text-muted-foreground text-sm break-words">{entry.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <EmptyState
              title={t('live.workbench.settings.snapshot.empty.title')}
              description={t('live.workbench.settings.snapshot.empty.description')}
              className="border-0 bg-transparent px-0 py-6"
            />
          )}
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
          adapter={adapter}
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

function buildRuntimeSnapshotEntries(
  schema: LiveRealtimeOptionGroup[],
  snapshot: Record<string, unknown> | null | undefined,
  t: (key: string) => string,
): { key: string; labelKey: string; value: string }[] {
  if (!snapshot) return []

  return schema.flatMap((group) =>
    group.fields.flatMap((field) => {
      const value = getValueByPath(snapshot, field.key)
      if (value === undefined) return []

      return [
        {
          key: field.key,
          labelKey: field.label_key,
          value: formatRuntimeSnapshotValue(value, t),
        },
      ]
    }),
  )
}

function formatRuntimeSnapshotValue(value: unknown, t: (key: string) => string): string {
  if (value === null) return t('settings.liveRealtime.values.empty')
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'boolean') {
    return value
      ? t('settings.liveRealtime.values.enabled')
      : t('settings.liveRealtime.values.disabled')
  }
  if (typeof value === 'string' || typeof value === 'number') return String(value)

  return JSON.stringify(value)
}
