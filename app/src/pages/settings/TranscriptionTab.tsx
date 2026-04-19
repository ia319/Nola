import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  deleteTranscriptionDefaults,
  fetchEngineDefaults,
  patchTranscriptionDefaults,
} from '@/config/api'
import logger from '@/config/logger'
import { refreshAppConfig, useAppConfig } from '@/config/use-app-config'
import { AdvancedOptions, useTranscriptionOptions } from '@/features/transcription-options'
import {
  buildDefaultsPatchPayload,
  buildEffectiveDefaults,
} from '@/features/transcription-options/lib/defaults-patch'
import { getValueByPath } from '@/features/transcription-options/lib/object-path'
import {
  AUTO_DETECT_LANGUAGE_VALUE,
  buildTranscriptionSchemaUiModel,
} from '@/features/transcription-options/lib/schema-adapter'
import { FormRow } from '@/layouts'
import { isAppError } from '@/shared/lib/error-factory'
import type { AppError, EngineDefaults, TranscriptionDefaults } from '@/shared/types'

type TranslationParams = Record<string, string | number | boolean | null | undefined>
type Translate = (key: string, options?: TranslationParams) => string

interface ComparisonFieldDescriptor {
  key: string
  labelKey: string
  emptyLabelKey?: string
  valueLabels?: ReadonlyMap<string, string>
}

interface ComparisonRow {
  key: string
  label: string
  currentValue: string
  engineValue: string
}

function toAppError(error: unknown): AppError {
  if (isAppError(error)) return error
  return {
    code: 'API_SERVER_UNKNOWN',
    i18nKey: 'error.api.serverError',
    retriable: true,
  }
}

function formatTechnicalValue(value: string | null | undefined, emptyValue: string): string {
  if (!value) return emptyValue

  const normalized = value.replace(/[_-]+/g, ' ').trim()
  if (normalized === '') return emptyValue

  return normalized
    .split(/\s+/)
    .map((segment) => {
      const lower = segment.toLowerCase()

      if (lower === 'cpu' || lower === 'gpu' || lower === 'cuda') {
        return lower.toUpperCase()
      }

      if (lower === 'fp16') return 'FP16'
      if (lower === 'fp32') return 'FP32'

      return /^[a-z]/.test(segment)
        ? `${segment.charAt(0).toUpperCase()}${segment.slice(1)}`
        : segment
    })
    .join(' ')
}

function resolveInitialPromptValue(
  value: string | null | undefined,
  defaults: TranscriptionDefaults | null,
): string {
  if (value !== undefined) return value ?? ''
  return defaults?.initial_prompt ?? ''
}

function areValuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true
  return JSON.stringify(left) === JSON.stringify(right)
}

function formatComparisonValue(
  descriptor: ComparisonFieldDescriptor,
  value: unknown,
  t: Translate,
): string {
  if (value === null || value === undefined || value === '') {
    return descriptor.emptyLabelKey
      ? t(descriptor.emptyLabelKey)
      : t('settings.transcription.values.empty')
  }

  if (typeof value === 'string') {
    const valueLabelKey = descriptor.valueLabels?.get(value)
    if (valueLabelKey) return t(valueLabelKey)
  }

  if (typeof value === 'boolean') {
    return value
      ? t('settings.transcription.values.enabled')
      : t('settings.transcription.values.disabled')
  }

  if (Array.isArray(value)) {
    return value.map(String).join(', ')
  }

  if (typeof value === 'object') {
    return JSON.stringify(value)
  }

  return String(value)
}

function buildComparisonFields(
  defaults: TranscriptionDefaults,
  engineDefaults: EngineDefaults['defaults'],
  descriptors: ComparisonFieldDescriptor[],
  t: Translate,
): ComparisonRow[] {
  return descriptors
    .map((descriptor) => {
      const current = getValueByPath(defaults, descriptor.key)
      const engine = getValueByPath(engineDefaults, descriptor.key)

      if (areValuesEqual(current, engine)) {
        return null
      }

      return {
        key: descriptor.key,
        label: t(descriptor.labelKey),
        currentValue: formatComparisonValue(descriptor, current, t),
        engineValue: formatComparisonValue(descriptor, engine, t),
      }
    })
    .filter((row): row is ComparisonRow => row !== null)
}

export function TranscriptionTab() {
  const { t } = useTranslation()
  const { config, isLoading } = useAppConfig()
  const {
    language,
    task,
    advancedOptions,
    defaults,
    setLanguage,
    setTask,
    setAdvancedOption,
    resetAdvancedOptions,
    resetOptionOverrides,
    initialPrompt,
    setInitialPrompt,
  } = useTranscriptionOptions()
  const [isSaving, setIsSaving] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [isCompareOpen, setIsCompareOpen] = useState(false)
  const [isLoadingEngineDefaults, setIsLoadingEngineDefaults] = useState(false)
  const [engineDefaults, setEngineDefaults] = useState<EngineDefaults['defaults'] | null>(null)

  const schemaUiModel = useMemo(
    () =>
      buildTranscriptionSchemaUiModel({
        schema: config?.transcription.schema ?? [],
        effectiveLanguages: config?.effective_languages ?? [],
      }),
    [config?.effective_languages, config?.transcription.schema],
  )

  const supportedTaskValues = useMemo(
    () => new Set(schemaUiModel.taskControl.options.map((option) => option.value)),
    [schemaUiModel.taskControl.options],
  )

  const comparisonDescriptors = useMemo<ComparisonFieldDescriptor[]>(() => {
    const languageValueLabels = new Map(
      schemaUiModel.languageControl.options.map((option) => [option.value, option.labelKey]),
    )
    const taskValueLabels = new Map(
      schemaUiModel.taskControl.options.map((option) => [option.value, option.labelKey]),
    )

    return [
      {
        key: schemaUiModel.languageControl.key,
        labelKey: schemaUiModel.languageControl.labelKey,
        emptyLabelKey: 'options.language.auto',
        valueLabels: languageValueLabels,
      },
      {
        key: schemaUiModel.taskControl.key,
        labelKey: schemaUiModel.taskControl.labelKey,
        valueLabels: taskValueLabels,
      },
      {
        key: schemaUiModel.initialPromptControl.key,
        labelKey: schemaUiModel.initialPromptControl.labelKey,
      },
      ...schemaUiModel.advancedSchema.flatMap((group) =>
        group.fields.map((field) => ({
          key: field.key,
          labelKey: field.label_key,
        })),
      ),
    ]
  }, [
    schemaUiModel.advancedSchema,
    schemaUiModel.initialPromptControl,
    schemaUiModel.languageControl,
    schemaUiModel.taskControl,
  ])

  const comparisonRows = useMemo(
    () =>
      defaults && engineDefaults
        ? buildComparisonFields(defaults, engineDefaults, comparisonDescriptors, t)
        : [],
    [comparisonDescriptors, defaults, engineDefaults, t],
  )

  const controlsDisabled = isLoading || defaults === null || isSaving || isResetting
  const initialPromptValue = resolveInitialPromptValue(initialPrompt, defaults)

  async function refreshDefaultsView(context: 'save' | 'reset'): Promise<boolean> {
    try {
      await refreshAppConfig()
      return true
    } catch (error: unknown) {
      logger.error('settings.transcription.refreshFailed', { context, error })
      return false
    }
  }

  async function ensureEngineDefaultsLoaded(): Promise<EngineDefaults['defaults'] | null> {
    if (engineDefaults) return engineDefaults

    setIsLoadingEngineDefaults(true)

    try {
      const response = await fetchEngineDefaults()
      setEngineDefaults(response.defaults)
      return response.defaults
    } catch (error: unknown) {
      logger.error('settings.transcription.engineDefaultsFailed', { error })
      const appError = toAppError(error)
      toast.error(t(appError.i18nKey, appError.params ?? {}))
      return null
    } finally {
      setIsLoadingEngineDefaults(false)
    }
  }

  async function handleSave(): Promise<void> {
    if (!defaults || isSaving || isResetting) return

    setIsSaving(true)

    try {
      const loadedEngineDefaults = await ensureEngineDefaultsLoaded()
      if (!loadedEngineDefaults) return

      const nextEffectiveDefaults = buildEffectiveDefaults({
        defaults,
        language,
        task,
        initialPrompt,
        advancedOptions,
      })

      const payload = buildDefaultsPatchPayload({
        engineDefaults: loadedEngineDefaults,
        previousEffectiveDefaults: defaults,
        nextEffectiveDefaults,
      })

      await patchTranscriptionDefaults(payload)

      const refreshed = await refreshDefaultsView('save')
      if (refreshed) {
        resetOptionOverrides()
      }

      toast.success(t('options.defaults.saved'))
    } catch (error: unknown) {
      logger.error('settings.transcription.saveFailed', { error })
      const appError = toAppError(error)
      toast.error(t(appError.i18nKey, appError.params ?? {}))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleReset(): Promise<void> {
    if (isSaving || isResetting) return

    setIsResetting(true)

    try {
      await deleteTranscriptionDefaults()

      const refreshed = await refreshDefaultsView('reset')
      if (refreshed) {
        resetOptionOverrides()
      }

      toast.success(t('options.defaults.resetDone'))
    } catch (error: unknown) {
      logger.error('settings.transcription.resetFailed', { error })
      const appError = toAppError(error)
      toast.error(t(appError.i18nKey, appError.params ?? {}))
    } finally {
      setIsResetting(false)
    }
  }

  async function handleToggleEngineDefaults(): Promise<void> {
    const nextOpen = !isCompareOpen
    setIsCompareOpen(nextOpen)

    if (nextOpen) {
      await ensureEngineDefaultsLoaded()
    }
  }

  function handleTaskChange(nextTask: string): void {
    if (!supportedTaskValues.has(nextTask)) {
      logger.warn('settings.transcription.unsupportedTaskOption', { nextTask })
      return
    }

    setTask(nextTask)
  }

  function handleInitialPromptChange(nextValue: string): void {
    const normalized = nextValue === '' ? null : nextValue
    const defaultValue = defaults?.initial_prompt ?? null
    setInitialPrompt(normalized === defaultValue ? undefined : normalized)
  }

  if (isLoading && !config) {
    return (
      <div className="text-muted-foreground text-sm">{t('settings.transcription.loading')}</div>
    )
  }

  if (!config || defaults === null) {
    return (
      <div className="text-muted-foreground text-sm">{t('settings.transcription.unavailable')}</div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-8">
      <section className="space-y-3">
        <p className="text-foreground text-[15px] leading-none font-medium">
          {t('settings.transcription.sections.basic.label')}
        </p>

        <div className="border-y">
          <FormRow
            label={t(schemaUiModel.languageControl.labelKey)}
            description={t('settings.transcription.fields.language.description')}
            htmlFor="settings-transcription-language"
            align="center"
          >
            <select
              id="settings-transcription-language"
              value={language ?? AUTO_DETECT_LANGUAGE_VALUE}
              onChange={(event) =>
                setLanguage(
                  event.target.value === AUTO_DETECT_LANGUAGE_VALUE
                    ? undefined
                    : event.target.value,
                )
              }
              disabled={controlsDisabled}
              className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-10 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] sm:max-w-52"
            >
              {schemaUiModel.languageControl.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </option>
              ))}
            </select>
          </FormRow>

          <FormRow
            label={t(schemaUiModel.taskControl.labelKey)}
            description={t('settings.transcription.fields.task.description')}
            htmlFor="settings-transcription-task"
            align="center"
          >
            <select
              id="settings-transcription-task"
              value={task}
              onChange={(event) => handleTaskChange(event.target.value)}
              disabled={controlsDisabled}
              className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-10 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] sm:max-w-60"
            >
              {schemaUiModel.taskControl.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </option>
              ))}
            </select>
          </FormRow>

          <FormRow
            label={t(schemaUiModel.initialPromptControl.labelKey)}
            description={t('settings.transcription.fields.initialPrompt.description')}
            htmlFor="settings-transcription-initial-prompt"
          >
            <Textarea
              id="settings-transcription-initial-prompt"
              value={initialPromptValue}
              disabled={controlsDisabled}
              onChange={(event) => handleInitialPromptChange(event.target.value)}
            />
          </FormRow>
        </div>
      </section>

      <section className="space-y-3">
        <p className="text-foreground text-[15px] leading-none font-medium">
          {t('settings.transcription.sections.advanced.label')}
        </p>

        <div className="border-y py-5">
          <AdvancedOptions
            schema={schemaUiModel.advancedSchema}
            advancedOptions={advancedOptions}
            defaults={defaults}
            onOptionChange={setAdvancedOption}
            onReset={resetAdvancedOptions}
            disabled={controlsDisabled}
            showToggle={false}
            containerClassName="rounded-none border-0 p-0"
            groupLabelClassName="text-foreground mb-3 text-sm font-medium tracking-normal normal-case"
          />
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-foreground text-[15px] leading-none font-medium">
            {t('settings.transcription.sections.engineDefaults.label')}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handleToggleEngineDefaults()}
            disabled={isLoadingEngineDefaults}
          >
            {isCompareOpen
              ? t('settings.transcription.sections.engineDefaults.hide')
              : t('settings.transcription.sections.engineDefaults.show')}
          </Button>
        </div>

        <div className="border-y">
          {!isCompareOpen ? (
            <div className="text-muted-foreground py-4 text-sm">
              {t('settings.transcription.sections.engineDefaults.closedNote')}
            </div>
          ) : isLoadingEngineDefaults && engineDefaults === null ? (
            <div className="text-muted-foreground py-4 text-sm">
              {t('settings.transcription.sections.engineDefaults.loading')}
            </div>
          ) : comparisonRows.length === 0 ? (
            <div className="text-muted-foreground py-4 text-sm">
              {t('settings.transcription.sections.engineDefaults.noOverrides')}
            </div>
          ) : (
            <div className="py-2">
              <div className="text-muted-foreground grid gap-3 px-3 py-2 text-xs font-medium md:grid-cols-[minmax(0,1fr)_minmax(0,180px)_minmax(0,180px)]">
                <span>{t('settings.transcription.sections.engineDefaults.columns.field')}</span>
                <span>{t('settings.transcription.sections.engineDefaults.columns.current')}</span>
                <span>{t('settings.transcription.sections.engineDefaults.columns.engine')}</span>
              </div>
              {comparisonRows.map((row) => (
                <div
                  key={row.key}
                  className="grid gap-3 border-t px-3 py-3 md:grid-cols-[minmax(0,1fr)_minmax(0,180px)_minmax(0,180px)]"
                >
                  <span className="text-foreground text-sm font-medium">{row.label}</span>
                  <span className="text-muted-foreground text-sm">{row.currentValue}</span>
                  <span className="text-muted-foreground text-sm">{row.engineValue}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <p className="text-foreground text-[15px] leading-none font-medium">
          {t('settings.transcription.sections.resources.label')}
        </p>

        <div className="border-y">
          <FormRow
            label={t('settings.transcription.resources.modelProfile.label')}
            description={t('settings.transcription.resources.modelProfile.description')}
            align="center"
          >
            <div className="bg-surface-container-high text-foreground inline-flex min-h-10 items-center rounded-md px-3 text-sm">
              {formatTechnicalValue(
                config.engine.model_size,
                t('settings.transcription.values.empty'),
              )}
            </div>
          </FormRow>

          <FormRow
            label={t('settings.transcription.resources.device.label')}
            description={t('settings.transcription.resources.device.description')}
            align="center"
          >
            <div className="bg-surface-container-high text-foreground inline-flex min-h-10 items-center rounded-md px-3 text-sm">
              {formatTechnicalValue(config.engine.device, t('settings.transcription.values.empty'))}
            </div>
          </FormRow>

          <FormRow
            label={t('settings.transcription.resources.computeType.label')}
            description={t('settings.transcription.resources.computeType.description')}
            align="center"
          >
            <div className="bg-surface-container-high text-foreground inline-flex min-h-10 items-center rounded-md px-3 text-sm">
              {formatTechnicalValue(
                config.engine.compute_type,
                t('settings.transcription.values.empty'),
              )}
            </div>
          </FormRow>

          <FormRow
            label={t('settings.transcription.resources.languageMode.label')}
            description={t('settings.transcription.resources.languageMode.description')}
            align="center"
            className="border-b-0"
          >
            <div className="bg-surface-container-high text-foreground inline-flex min-h-10 items-center rounded-md px-3 text-sm">
              {config.engine.is_multilingual
                ? t('settings.transcription.values.multilingual')
                : t('settings.transcription.values.englishOnly')}
            </div>
          </FormRow>
        </div>
      </section>

      <section className="flex flex-wrap justify-end gap-2 border-t pt-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => void handleReset()}
          disabled={isSaving || isResetting}
        >
          {isResetting ? t('options.defaults.resetting') : t('options.defaults.resetEngine')}
        </Button>
        <Button type="button" onClick={() => void handleSave()} disabled={isSaving || isResetting}>
          {isSaving ? t('options.defaults.saving') : t('options.defaults.save')}
        </Button>
      </section>
    </div>
  )
}
