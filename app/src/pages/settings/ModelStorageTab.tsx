import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getModelSettings } from '@/features/models/api'
import { FormRow } from '@/layouts'
import { queryKeys } from '@/shared/lib/query-keys'
import type { ModelDirSource } from '@/shared/types'

type TranslationParams = Record<string, string | number | boolean | null | undefined>
type Translate = (key: string, options?: TranslationParams) => string

function formatNullableValue(value: string | null | undefined, fallback: string): string {
  return value && value.trim() !== '' ? value : fallback
}

function isAbsolutePath(value: string): boolean {
  return /^[a-zA-Z]:[\\/]/.test(value) || value.startsWith('/') || value.startsWith('\\\\')
}

function formatDirectoryValue(value: string | null | undefined, fallback: string): string {
  if (!value || value.trim() === '') return fallback

  // TODO(backend): Return a safe model directory display value instead of absolute paths. [2026-04-19]
  if (isAbsolutePath(value)) return fallback

  return value
}

function formatOverrideSource(source: ModelDirSource, t: Translate): string {
  return t(`settings.modelStorage.values.overrideSource.${source}`)
}

function formatRestartStatus(restartRequired: boolean, t: Translate): string {
  return restartRequired
    ? t('settings.modelStorage.values.restartRequired')
    : t('settings.modelStorage.values.restartNotRequired')
}

function ReadOnlyValue({ value, mono = false }: { value: string; mono?: boolean }) {
  return (
    <span
      className={
        mono
          ? 'bg-surface-container-high text-foreground inline-flex min-h-10 max-w-full items-center rounded-md px-3 font-mono text-sm break-all'
          : 'bg-surface-container-high text-foreground inline-flex min-h-10 max-w-full items-center rounded-md px-3 text-sm'
      }
    >
      {value}
    </span>
  )
}

export function ModelStorageTab() {
  const { t } = useTranslation()

  const modelSettingsQuery = useQuery({
    queryKey: queryKeys.models.settings(),
    queryFn: ({ signal }) => getModelSettings(signal),
  })

  const settings = modelSettingsQuery.data ?? null

  if (modelSettingsQuery.isPending) {
    return <div className="text-muted-foreground text-sm">{t('settings.modelStorage.loading')}</div>
  }

  if (modelSettingsQuery.error || !settings) {
    return (
      <div className="space-y-3">
        <p className="text-muted-foreground text-sm">{t('settings.modelStorage.unavailable')}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void modelSettingsQuery.refetch()}
        >
          {t('settings.modelStorage.actions.retry')}
        </Button>
      </div>
    )
  }

  const emptyValue = t('settings.modelStorage.values.empty')
  const directoryUnavailableValue = t('settings.modelStorage.values.directoryUnavailable')
  const configuredModelId = formatNullableValue(settings.configured_model_id, emptyValue)
  const lastLoadedModelId = formatNullableValue(settings.last_loaded_model_id, emptyValue)
  const configuredModelDir = formatDirectoryValue(
    settings.configured_model_dir,
    directoryUnavailableValue,
  )
  const effectiveModelDir = formatDirectoryValue(
    settings.effective_model_dir,
    directoryUnavailableValue,
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-8">
      <section className="space-y-3">
        <p className="text-foreground text-[15px] leading-none font-medium">
          {t('settings.modelStorage.sections.current.label')}
        </p>

        <div className="border-y">
          <FormRow
            label={t('settings.modelStorage.fields.configuredModel.label')}
            description={t('settings.modelStorage.fields.configuredModel.description')}
            align="center"
          >
            <ReadOnlyValue value={configuredModelId} />
          </FormRow>

          <FormRow
            label={t('settings.modelStorage.fields.lastLoadedModel.label')}
            description={t('settings.modelStorage.fields.lastLoadedModel.description')}
            align="center"
          >
            <ReadOnlyValue value={lastLoadedModelId} />
          </FormRow>

          <FormRow
            label={t('settings.modelStorage.fields.effectiveDirectory.label')}
            description={t('settings.modelStorage.fields.effectiveDirectory.description')}
            align="center"
          >
            <ReadOnlyValue value={effectiveModelDir} mono />
          </FormRow>

          <FormRow
            label={t('settings.modelStorage.fields.overrideSource.label')}
            description={t('settings.modelStorage.fields.overrideSource.description')}
            align="center"
          >
            <ReadOnlyValue value={formatOverrideSource(settings.override_source, t)} />
          </FormRow>

          <FormRow
            label={t('settings.modelStorage.fields.restartStatus.label')}
            description={t('settings.modelStorage.fields.restartStatus.description')}
            align="center"
            className="border-b-0"
          >
            <span
              className={
                settings.restart_required
                  ? 'border-warning/15 bg-warning-container text-on-warning-container inline-flex min-h-10 items-center rounded-md border px-3 text-sm font-medium'
                  : 'border-success/15 bg-success-container text-on-success-container inline-flex min-h-10 items-center rounded-md border px-3 text-sm font-medium'
              }
            >
              {formatRestartStatus(settings.restart_required, t)}
            </span>
          </FormRow>
        </div>
      </section>

      <section className="space-y-3">
        <p className="text-foreground text-[15px] leading-none font-medium">
          {t('settings.modelStorage.sections.directory.label')}
        </p>

        <div className="border-y">
          <FormRow
            label={t('settings.modelStorage.fields.configuredDirectory.label')}
            description={t('settings.modelStorage.fields.configuredDirectory.description')}
            htmlFor="settings-model-storage-configured-directory"
            align="center"
            controlClassName="space-y-2"
          >
            {/* TODO(backend): Return a safe editable model directory value, then enable this control. [2026-04-19] */}
            <Input
              id="settings-model-storage-configured-directory"
              value={configuredModelDir}
              disabled
              readOnly
              className="font-mono text-sm"
            />
            <p className="text-muted-foreground text-xs leading-5">
              {t('settings.modelStorage.fields.configuredDirectory.current', {
                path: configuredModelDir,
              })}
            </p>
          </FormRow>

          {settings.override_source === 'environment' ? (
            <FormRow
              label={t('settings.modelStorage.fields.environmentOverride.label')}
              description={t('settings.modelStorage.fields.environmentOverride.description')}
              align="center"
            >
              <span className="border-warning/15 bg-warning-container text-on-warning-container inline-flex min-h-10 items-center rounded-md border px-3 text-sm font-medium">
                {t('settings.modelStorage.values.environmentOverrideActive')}
              </span>
            </FormRow>
          ) : null}

          {settings.restart_required ? (
            <FormRow
              label={t('settings.modelStorage.fields.restartRequired.label')}
              description={t('settings.modelStorage.fields.restartRequired.description')}
              align="center"
              className="border-b-0"
            >
              <span className="border-warning/15 bg-warning-container text-on-warning-container inline-flex min-h-10 items-center rounded-md border px-3 text-sm font-medium">
                {t('settings.modelStorage.values.restartRequired')}
              </span>
            </FormRow>
          ) : null}
        </div>
      </section>

      <section className="flex flex-wrap justify-end gap-2 border-t pt-3">
        <Button type="button" disabled>
          {t('settings.modelStorage.actions.save')}
        </Button>
      </section>
    </div>
  )
}
