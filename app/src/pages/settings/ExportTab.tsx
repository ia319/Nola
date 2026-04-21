import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import logger from '@/config/logger'
import { deleteExportDefaults, fetchExportConfig, patchExportDefaults } from '@/features/export/api'
import { FormRow } from '@/layouts'
import { isAppError } from '@/shared/lib/error-factory'
import { queryKeys } from '@/shared/lib/query-keys'
import type {
  AppError,
  ExportConfig,
  ExportDefaults,
  ExportDefaultsUpdateRequest,
  ExportFormat,
} from '@/shared/types'

const EXPORT_FORMAT_OPTIONS = [
  {
    value: 'srt',
    labelKey: 'settings.export.formats.srt.label',
    detailKey: 'settings.export.formats.srt.detail',
  },
  {
    value: 'vtt',
    labelKey: 'settings.export.formats.vtt.label',
    detailKey: 'settings.export.formats.vtt.detail',
  },
  {
    value: 'txt',
    labelKey: 'settings.export.formats.txt.label',
    detailKey: 'settings.export.formats.txt.detail',
  },
  {
    value: 'ass',
    labelKey: 'settings.export.formats.ass.label',
    detailKey: 'settings.export.formats.ass.detail',
  },
] as const satisfies ReadonlyArray<{
  value: ExportFormat
  labelKey: string
  detailKey: string
}>

const FUTURE_FORMATS = ['JSON', 'TSV'] as const

function toAppError(error: unknown): AppError {
  if (isAppError(error)) return error
  return {
    code: 'API_SERVER_UNKNOWN',
    i18nKey: 'error.api.serverError',
    retriable: true,
  }
}

function isExportFormat(value: string): value is ExportFormat {
  return EXPORT_FORMAT_OPTIONS.some((option) => option.value === value)
}

function buildExportDefaultsPatch(
  defaults: ExportDefaults,
  format: ExportFormat,
  includeTimestamps: boolean,
): ExportDefaultsUpdateRequest {
  const payload: ExportDefaultsUpdateRequest = {}

  if (format !== defaults.format) {
    payload.format = format
  }

  if (includeTimestamps !== defaults.include_timestamps) {
    payload.include_timestamps = includeTimestamps
  }

  return payload
}

function hasPatchValues(payload: ExportDefaultsUpdateRequest): boolean {
  return payload.format !== undefined || payload.include_timestamps !== undefined
}

export function ExportTab() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [draftDefaults, setDraftDefaults] = useState<ExportDefaultsUpdateRequest>({})

  const exportConfigQuery = useQuery({
    queryKey: queryKeys.config.export(),
    queryFn: ({ signal }) => fetchExportConfig(signal),
  })

  const defaults = exportConfigQuery.data?.defaults ?? null
  const format = draftDefaults.format ?? defaults?.format ?? EXPORT_FORMAT_OPTIONS[0].value
  const includeTimestamps = draftDefaults.include_timestamps ?? defaults?.include_timestamps ?? true

  const selectedFormatDetails = useMemo(
    () =>
      EXPORT_FORMAT_OPTIONS.find((option) => option.value === format) ?? EXPORT_FORMAT_OPTIONS[0],
    [format],
  )

  const saveMutation = useMutation({
    mutationFn: (payload: ExportDefaultsUpdateRequest) => patchExportDefaults(payload),
    onSuccess: (response) => {
      queryClient.setQueryData<ExportConfig>(queryKeys.config.export(), response)
      void queryClient.invalidateQueries({ queryKey: queryKeys.config.export() })
      setDraftDefaults({})
      toast.success(t('settings.export.toast.saved'))
    },
    onError: (error) => {
      logger.error('settings.export.saveFailed', { error })
      const appError = toAppError(error)
      toast.error(t(appError.i18nKey, appError.params ?? {}))
    },
  })

  const resetMutation = useMutation({
    mutationFn: async () => {
      await deleteExportDefaults()
      return fetchExportConfig()
    },
    onSuccess: (response) => {
      queryClient.setQueryData<ExportConfig>(queryKeys.config.export(), response)
      void queryClient.invalidateQueries({ queryKey: queryKeys.config.export() })
      setDraftDefaults({})
      toast.success(t('settings.export.toast.reset'))
    },
    onError: (error) => {
      logger.error('settings.export.resetFailed', { error })
      const appError = toAppError(error)
      toast.error(t(appError.i18nKey, appError.params ?? {}))
    },
  })

  const draftPayload = defaults
    ? buildExportDefaultsPatch(defaults, format, includeTimestamps)
    : null
  const hasChanges = draftPayload ? hasPatchValues(draftPayload) : false
  const controlsDisabled =
    exportConfigQuery.isPending || saveMutation.isPending || resetMutation.isPending

  function handleFormatChange(nextFormat: string): void {
    if (!isExportFormat(nextFormat)) {
      logger.warn('settings.export.unsupportedFormatOption', { nextFormat })
      return
    }

    setDraftDefaults((current) => ({
      ...current,
      format: nextFormat,
    }))
  }

  function handleSave(): void {
    if (!draftPayload || !hasPatchValues(draftPayload)) return
    saveMutation.mutate(draftPayload)
  }

  function handleReset(): void {
    resetMutation.mutate()
  }

  if (exportConfigQuery.isPending) {
    return <div className="text-muted-foreground text-sm">{t('settings.export.loading')}</div>
  }

  if (exportConfigQuery.error || !defaults) {
    return (
      <div className="space-y-3">
        <p className="text-muted-foreground text-sm">{t('settings.export.unavailable')}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void exportConfigQuery.refetch()}
        >
          {t('settings.export.actions.retry')}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-8">
      <section className="space-y-3">
        <p className="text-foreground text-[15px] leading-none font-medium">
          {t('settings.export.sections.defaults.label')}
        </p>

        <div className="border-y">
          <FormRow
            label={t('settings.export.fields.format.label')}
            description={t('settings.export.fields.format.description')}
            htmlFor="settings-export-format"
            align="center"
          >
            <div className="space-y-2">
              <select
                id="settings-export-format"
                value={format}
                onChange={(event) => handleFormatChange(event.target.value)}
                disabled={controlsDisabled}
                className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-10 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] sm:max-w-52"
              >
                {EXPORT_FORMAT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(option.labelKey)}
                  </option>
                ))}
              </select>
              <p className="text-muted-foreground text-xs leading-5">
                {t(selectedFormatDetails.detailKey)}
              </p>
            </div>
          </FormRow>

          <FormRow
            label={t('settings.export.fields.includeTimestamps.label')}
            description={t('settings.export.fields.includeTimestamps.description')}
            align="center"
            className="border-b-0"
          >
            <Switch
              checked={includeTimestamps}
              onCheckedChange={(checked) =>
                setDraftDefaults((current) => ({
                  ...current,
                  include_timestamps: checked,
                }))
              }
              disabled={controlsDisabled}
              aria-label={t('settings.export.fields.includeTimestamps.label')}
            />
          </FormRow>
        </div>
      </section>

      <section className="space-y-3">
        <p className="text-foreground text-[15px] leading-none font-medium">
          {t('settings.export.sections.future.label')}
        </p>

        <div className="border-y">
          <FormRow
            label={t('settings.export.fields.futureFormats.label')}
            description={t('settings.export.fields.futureFormats.description')}
            align="center"
          >
            {/* TODO(Backend): Enable JSON and TSV after export defaults support lands. [2026-04-19] */}
            <div className="flex flex-wrap gap-2">
              {FUTURE_FORMATS.map((futureFormat) => (
                <span
                  key={futureFormat}
                  className="border-outline-variant text-muted-foreground inline-flex min-h-8 items-center rounded-md border px-2.5 text-xs font-medium"
                >
                  {t('settings.export.values.futureFormat', { format: futureFormat })}
                </span>
              ))}
            </div>
          </FormRow>

          <FormRow
            label={t('settings.export.fields.metadata.label')}
            description={t('settings.export.fields.metadata.description')}
            align="center"
          >
            {/* TODO(Backend): Wire metadata defaults after the config API exposes metadata. [2026-04-19] */}
            <span className="bg-surface-container-high text-muted-foreground inline-flex min-h-10 items-center rounded-md px-3 text-sm">
              {t('settings.export.values.comingSoon')}
            </span>
          </FormRow>

          <FormRow
            label={t('settings.export.fields.archivePath.label')}
            description={t('settings.export.fields.archivePath.description')}
            align="center"
            className="border-b-0"
          >
            <span className="bg-surface-container-high text-muted-foreground inline-flex min-h-10 items-center rounded-md px-3 font-mono text-sm">
              {t('settings.export.values.unavailable')}
            </span>
          </FormRow>
        </div>
      </section>

      <section className="flex flex-wrap justify-end gap-2 border-t pt-3">
        <Button
          type="button"
          variant="outline"
          onClick={handleReset}
          disabled={saveMutation.isPending || resetMutation.isPending}
        >
          {resetMutation.isPending
            ? t('settings.export.actions.resetting')
            : t('settings.export.actions.reset')}
        </Button>
        <Button
          type="button"
          onClick={handleSave}
          disabled={!hasChanges || saveMutation.isPending || resetMutation.isPending}
        >
          {saveMutation.isPending
            ? t('settings.export.actions.saving')
            : t('settings.export.actions.save')}
        </Button>
      </section>
    </div>
  )
}
