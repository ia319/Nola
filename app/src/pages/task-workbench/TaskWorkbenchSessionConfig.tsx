import { useMemo, useRef, useState } from 'react'
import { Play, RotateCcw, SlidersHorizontal } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DetailSheet } from '@/components/ui/DetailSheet'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { fetchEngineDefaults, patchTranscriptionDefaults } from '@/config/api'
import logger from '@/config/logger'
import { refreshAppConfig, useAppConfig } from '@/config/use-app-config'
import { AdvancedOptions, useTranscriptionOptions } from '@/features/transcription-options'
import type { TaskCreateResult } from '@/features/transcription-options'
import type {
  AdvancedOptionValue,
  AdvancedTranscriptionOptions,
} from '@/features/transcription-options'
import {
  buildDefaultsPatchPayload,
  buildEffectiveDefaults,
} from '@/features/transcription-options/lib/defaults-patch'
import { getValueByPath } from '@/features/transcription-options/lib/object-path'
import { buildTranscriptionSchemaUiModel } from '@/features/transcription-options/lib/schema-adapter'
import { useModels } from '@/features/models'
import { cn } from '@/lib/utils'
import { isAppError } from '@/shared/lib/error-factory'
import type {
  AppError,
  CreateTaskPayload,
  CreateTaskResponse,
  TranscriptionDefaults,
} from '@/shared/types'

const MODEL_LOADING_VALUE = '__loading__'
const MODEL_EMPTY_VALUE = '__empty__'

export interface TaskWorkbenchSessionConfigProps {
  fileIds: string[]
  onCreateTask: (payload: CreateTaskPayload) => Promise<CreateTaskResponse>
  onTasksCreated: (results: TaskCreateResult[]) => void
  disabled?: boolean
}

interface ModelSelectOption {
  value: string
  label: string
}

function toAppError(error: unknown): AppError {
  if (isAppError(error)) return error
  return {
    code: 'API_SERVER_UNKNOWN',
    i18nKey: 'error.api.serverError',
    retriable: true,
  }
}

function formatEngineValue(value: string | null | undefined): string {
  if (!value) return ''

  const normalized = value.replace(/[_-]+/g, ' ').trim()
  if (normalized === '') return ''

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

function applyAdvancedDraftChange(
  previous: AdvancedTranscriptionOptions,
  key: string,
  value: AdvancedOptionValue | undefined,
): AdvancedTranscriptionOptions {
  const next: AdvancedTranscriptionOptions = { ...previous, [key]: value }

  if (key === 'word_timestamps' && value === true) {
    next.without_timestamps = false
  }

  if (key === 'without_timestamps' && value === true) {
    next.word_timestamps = false
  }

  return next
}

function resolveInitialPromptValue(initialPrompt: string | null | undefined): string {
  if (typeof initialPrompt === 'string') return initialPrompt
  if (initialPrompt === null) return ''
  return ''
}

function isSameAdvancedValue(left: AdvancedOptionValue, right: unknown): boolean {
  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) return false

    return left.every((value, index) => Object.is(value, right[index]))
  }

  return Object.is(left, right)
}

function buildAppliedAdvancedOptions(
  draft: AdvancedTranscriptionOptions,
  defaults: TranscriptionDefaults | null,
): AdvancedTranscriptionOptions {
  const next: AdvancedTranscriptionOptions = {}

  for (const [key, value] of Object.entries(draft)) {
    if (value === undefined) continue

    const defaultValue = getValueByPath(defaults, key)
    if (isSameAdvancedValue(value, defaultValue)) continue

    next[key] = value
  }

  return next
}

export function TaskWorkbenchSessionConfig({
  fileIds,
  onCreateTask,
  onTasksCreated,
  disabled,
}: TaskWorkbenchSessionConfigProps) {
  const { t } = useTranslation()
  const creatingRef = useRef(false)
  const [isCreating, setIsCreating] = useState(false)
  const [isSavingDefaults, setIsSavingDefaults] = useState(false)
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false)
  const [draftAdvancedOptions, setDraftAdvancedOptions] = useState<AdvancedTranscriptionOptions>({})
  const [draftInitialPrompt, setDraftInitialPrompt] = useState<string | null | undefined>(undefined)

  const { config } = useAppConfig()
  const { models, configuredModelId, lastLoadedModelId, isLoading: isModelsLoading } = useModels()
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
    buildRequest,
    initialPrompt,
    setInitialPrompt,
  } = useTranscriptionOptions()

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

  const advancedOverrideCount = useMemo(
    () =>
      Object.values(advancedOptions).filter((value) => value !== undefined).length +
      (initialPrompt !== undefined ? 1 : 0),
    [advancedOptions, initialPrompt],
  )

  const modelOptions = useMemo<ModelSelectOption[]>(() => {
    const downloadedModels = models
      .filter((model) => model.status === 'downloaded')
      .map((model) => ({
        value: model.model_id,
        label: model.name,
      }))

    if (downloadedModels.length > 0) {
      return downloadedModels
    }

    if (isModelsLoading) {
      return [
        {
          value: MODEL_LOADING_VALUE,
          label: t('tasks.workbench.sessionConfig.model.loading'),
        },
      ]
    }

    const engineModelSize = formatEngineValue(config?.engine.model_size)
    if (engineModelSize) {
      return [
        {
          value: MODEL_EMPTY_VALUE,
          label: engineModelSize,
        },
      ]
    }

    return [
      {
        value: MODEL_EMPTY_VALUE,
        label: t('tasks.workbench.sessionConfig.model.comingSoon'),
      },
    ]
  }, [config?.engine.model_size, isModelsLoading, models, t])

  const selectedModelValue = useMemo(() => {
    if (modelOptions.some((option) => option.value === configuredModelId)) {
      return configuredModelId as string
    }

    if (modelOptions.some((option) => option.value === lastLoadedModelId)) {
      return lastLoadedModelId as string
    }

    return modelOptions[0]?.value ?? MODEL_EMPTY_VALUE
  }, [configuredModelId, lastLoadedModelId, modelOptions])

  const controlsDisabled = disabled || isCreating || isSavingDefaults
  const startDisabled = controlsDisabled || fileIds.length === 0

  async function handleStart() {
    if (creatingRef.current || fileIds.length === 0) return

    creatingRef.current = true
    setIsCreating(true)

    try {
      const results: TaskCreateResult[] = []

      for (const fileId of fileIds) {
        try {
          const response = await onCreateTask(buildRequest(fileId))
          results.push({
            fileId,
            taskId: response.task_id,
            filename: response.filename,
            ok: true,
          })
        } catch (error: unknown) {
          results.push({
            fileId,
            ok: false,
            error: toAppError(error),
          })
        }
      }

      onTasksCreated(results)
    } finally {
      creatingRef.current = false
      setIsCreating(false)
    }
  }

  function handleOpenAdvanced(): void {
    setDraftAdvancedOptions({ ...advancedOptions })
    setDraftInitialPrompt(
      initialPrompt === undefined ? (defaults?.initial_prompt ?? null) : initialPrompt,
    )
    setIsAdvancedOpen(true)
  }

  function handleApplyAdvancedChanges(): void {
    const nextAdvancedOptions = buildAppliedAdvancedOptions(draftAdvancedOptions, defaults)

    resetAdvancedOptions()

    for (const [key, value] of Object.entries(nextAdvancedOptions)) {
      if (value !== undefined) {
        setAdvancedOption(key, value)
      }
    }

    const nextPrompt =
      draftInitialPrompt === undefined
        ? undefined
        : draftInitialPrompt === (defaults?.initial_prompt ?? null)
          ? undefined
          : draftInitialPrompt

    setInitialPrompt(nextPrompt)
    setIsAdvancedOpen(false)
  }

  function handleDraftOptionChange(key: string, value: AdvancedOptionValue | undefined): void {
    setDraftAdvancedOptions((previous) => applyAdvancedDraftChange(previous, key, value))
  }

  function handleResetDraftToDefaults(): void {
    setDraftAdvancedOptions({})
    setDraftInitialPrompt(defaults?.initial_prompt ?? null)
  }

  async function refreshDefaultsView(): Promise<boolean> {
    try {
      await refreshAppConfig()
      return true
    } catch (error: unknown) {
      logger.error('config.defaults.refreshFailed', { context: 'save', error })
      return false
    }
  }

  async function handleSaveAsDefault(): Promise<void> {
    if (!defaults || isSavingDefaults || disabled) return

    setIsSavingDefaults(true)

    try {
      const engineDefaults = (await fetchEngineDefaults()).defaults
      const nextEffectiveDefaults = buildEffectiveDefaults({
        defaults,
        language,
        task,
        initialPrompt: draftInitialPrompt,
        advancedOptions: buildAppliedAdvancedOptions(draftAdvancedOptions, defaults),
      })

      const payload = buildDefaultsPatchPayload({
        engineDefaults,
        previousEffectiveDefaults: defaults,
        nextEffectiveDefaults,
      })

      await patchTranscriptionDefaults(payload)
      const refreshed = await refreshDefaultsView()

      if (refreshed) {
        resetOptionOverrides()
        setDraftAdvancedOptions({})
        setDraftInitialPrompt(nextEffectiveDefaults.initial_prompt)
      }

      toast.success(t('options.defaults.saved'))
    } catch (error: unknown) {
      logger.error('config.defaults.saveFailed', { error })
      const appError = toAppError(error)
      toast.error(t(appError.i18nKey, appError.params ?? {}))
    } finally {
      setIsSavingDefaults(false)
    }
  }

  return (
    <section data-slot="task-workbench-session-config" className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-foreground text-lg font-semibold tracking-tight">
          {t('tasks.workbench.sections.sessionConfig.title')}
        </h2>
        <p className="text-muted-foreground text-xs">
          {t('tasks.workbench.sessionConfig.globalSettings')}
        </p>
      </div>

      <Card className="gap-0 py-0 shadow-sm">
        <CardContent className="space-y-6 px-5 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="task-workbench-language-select">
                {t(schemaUiModel.languageControl.labelKey)}
              </Label>
              <Select
                value={language ?? '__auto__'}
                onValueChange={(value) => setLanguage(value === '__auto__' ? undefined : value)}
                disabled={controlsDisabled}
              >
                <SelectTrigger id="task-workbench-language-select" aria-label="Language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {schemaUiModel.languageControl.options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {t(option.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="task-workbench-task-select">
                {t(schemaUiModel.taskControl.labelKey)}
              </Label>
              <Select
                value={task}
                onValueChange={(value) => {
                  if (supportedTaskValues.has(value)) {
                    setTask(value)
                  }
                }}
                disabled={controlsDisabled}
              >
                <SelectTrigger id="task-workbench-task-select" aria-label="Task">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {schemaUiModel.taskControl.options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {t(option.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="bg-surface-container-low space-y-4 rounded-xl border px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-[11px] font-semibold tracking-[0.22em] uppercase">
                {t('tasks.workbench.sessionConfig.executionEngine')}
              </h3>
              <span className="text-muted-foreground text-[10px] italic">
                {t('tasks.workbench.sessionConfig.sessionOverride')}
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="task-workbench-model-select">
                  {t('tasks.workbench.sessionConfig.model.label')}
                </Label>
                <span className="text-muted-foreground text-[10px] font-semibold tracking-[0.18em] uppercase">
                  {t('tasks.workbench.sessionConfig.model.badge')}
                </span>
              </div>
              <Select value={selectedModelValue} disabled>
                <SelectTrigger id="task-workbench-model-select" aria-label="Model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {modelOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t('tasks.workbench.sessionConfig.device.label')}</Label>
                <div className="bg-background text-muted-foreground flex min-h-10 items-center rounded-lg border px-3 text-sm">
                  {formatEngineValue(config?.engine.device) ||
                    t('tasks.workbench.sessionConfig.unavailable')}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>{t('tasks.workbench.sessionConfig.computeType.label')}</Label>
                <div className="bg-background text-muted-foreground flex min-h-10 items-center rounded-lg border px-3 text-sm">
                  {formatEngineValue(config?.engine.compute_type) ||
                    t('tasks.workbench.sessionConfig.unavailable')}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-t pt-4">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground px-0"
              onClick={handleOpenAdvanced}
              disabled={controlsDisabled}
            >
              <SlidersHorizontal className="size-4" />
              {t('tasks.workbench.sessionConfig.advanced.button')}
            </Button>
            <span
              className={cn(
                'bg-surface-container text-muted-foreground inline-flex min-h-6 items-center rounded-md px-2 py-0.5 text-[11px] font-semibold tracking-[0.18em] uppercase',
                advancedOverrideCount > 0 && 'bg-foreground text-background',
              )}
            >
              {t('tasks.workbench.sessionConfig.advanced.overrides', {
                count: advancedOverrideCount,
              })}
            </span>
          </div>

          <Button
            type="button"
            className="w-full gap-2"
            onClick={() => void handleStart()}
            disabled={startDisabled}
          >
            <Play className="size-4 fill-current" />
            {isCreating
              ? t('options.creating')
              : fileIds.length > 0
                ? t('options.start', { count: fileIds.length })
                : t('options.startDisabled')}
          </Button>
        </CardContent>
      </Card>

      <DetailSheet
        open={isAdvancedOpen}
        onOpenChange={setIsAdvancedOpen}
        title={t('tasks.workbench.advancedSheet.title')}
        description={t('tasks.workbench.advancedSheet.description')}
        closeLabel={t('tasks.workbench.advancedSheet.close')}
        headerAdornment={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={handleResetDraftToDefaults}
            disabled={controlsDisabled}
          >
            <RotateCcw className="size-4" />
            {t('tasks.workbench.advancedSheet.reset')}
          </Button>
        }
        footer={
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleSaveAsDefault()}
              disabled={controlsDisabled || defaults === null}
            >
              {isSavingDefaults
                ? t('tasks.workbench.advancedSheet.savingDefault')
                : t('tasks.workbench.advancedSheet.saveDefault')}
            </Button>

            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAdvancedOpen(false)}
                disabled={controlsDisabled}
              >
                {t('tasks.workbench.advancedSheet.cancel')}
              </Button>
              <Button
                type="button"
                onClick={handleApplyAdvancedChanges}
                disabled={controlsDisabled}
              >
                {t('tasks.workbench.advancedSheet.apply')}
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="task-workbench-initial-prompt">
              {t(schemaUiModel.initialPromptControl.labelKey)}
            </Label>
            <Textarea
              id="task-workbench-initial-prompt"
              value={resolveInitialPromptValue(draftInitialPrompt)}
              placeholder={
                typeof defaults?.initial_prompt === 'string' ? defaults.initial_prompt : undefined
              }
              disabled={controlsDisabled}
              onChange={(event) => {
                const next = event.target.value
                setDraftInitialPrompt(next === '' ? null : next)
              }}
            />
          </div>

          <AdvancedOptions
            schema={schemaUiModel.advancedSchema}
            advancedOptions={draftAdvancedOptions}
            defaults={defaults}
            onOptionChange={handleDraftOptionChange}
            onReset={handleResetDraftToDefaults}
            showToggle={false}
            showReset={false}
            defaultOpen
            disabled={controlsDisabled}
          />
        </div>
      </DetailSheet>
    </section>
  )
}
