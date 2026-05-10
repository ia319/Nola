import { useTranslation } from 'react-i18next'

import { Button, EmptyState } from '@/components/ui'
import {
  LiveRealtimeSchemaForm,
  type LiveRealtimeDraft,
  type LiveRealtimeDraftValue,
  type LiveRealtimeRunState,
  type LiveRealtimeDefaultsSource,
  isLiveRealtimeDraftValue,
} from '@/features/realtime'
import { WorkspaceSidePanel } from '@/layouts'
import { getValueByPath, setValueByPath } from '@/shared/lib/object-path'
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
  const runtimeSnapshotForm = buildRuntimeSnapshotForm(schema, resolvedSnapshot)

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
          {runtimeSnapshotForm ? (
            <LiveRealtimeSchemaForm
              schema={runtimeSnapshotForm.schema}
              defaults={runtimeSnapshotForm.defaults}
              draft={{}}
              languages={languages}
              adapter={adapter}
              disabled
              layout="panel"
              valueMode="effective"
              domIdPrefix="live-workbench-settings-snapshot"
              onChange={ignoreRuntimeSnapshotChange}
            />
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
      className="bg-card text-card-foreground"
      footer={footer}
      footerClassName="bg-card"
    >
      {renderBody()}
    </WorkspaceSidePanel>
  )
}

const RUNTIME_SNAPSHOT_GROUP_PATHS: Partial<Record<string, string>> = {
  whisperStreaming: 'whisper_streaming',
  silence: 'silence',
  fasterWhisper: 'faster_whisper',
  vad: 'vad',
  vadAdvanced: 'vad',
}

function ignoreRuntimeSnapshotChange(): void {
  // Read-only snapshot controls keep the shared form contract without mutating state.
}

interface RuntimeSnapshotForm {
  schema: LiveRealtimeOptionGroup[]
  defaults: LiveRealtimeDefaultsSource
}

function buildRuntimeSnapshotForm(
  schema: LiveRealtimeOptionGroup[],
  snapshot: Record<string, unknown> | null | undefined,
): RuntimeSnapshotForm | null {
  if (!snapshot) return null

  const defaults: Record<string, unknown> = {}
  const resolvedSchema: LiveRealtimeOptionGroup[] = []

  for (const group of schema) {
    const fields: LiveRealtimeOptionGroup['fields'] = []

    for (const field of group.fields) {
      const value = getRuntimeSnapshotFieldValue(snapshot, group.group, field.key)
      if (!isLiveRealtimeDraftValue(value)) continue

      setValueByPath(defaults, field.key, value)
      fields.push(field)
    }

    if (fields.length > 0) {
      resolvedSchema.push({ ...group, fields })
    }
  }

  return resolvedSchema.length > 0 ? { schema: resolvedSchema, defaults } : null
}

function getRuntimeSnapshotFieldValue(
  snapshot: Record<string, unknown>,
  group: string,
  fieldKey: string,
): unknown {
  const groupPath = RUNTIME_SNAPSHOT_GROUP_PATHS[group]
  if (groupPath) {
    const groupedValue = getValueByPath(snapshot, `${groupPath}.${fieldKey}`)
    if (groupedValue !== undefined) return groupedValue
  }

  return getValueByPath(snapshot, fieldKey)
}
