import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  deleteTranscriptionDefaults,
  fetchEngineDefaults,
  patchTranscriptionDefaults,
} from '@/config/api'
import logger from '@/config/logger'
import { refreshAppConfig, useAppConfig } from '@/config/use-app-config'
import { useTranscriptionOptions } from '@/features/transcription-options/hooks/useTranscriptionOptions'
import {
  buildDefaultsPatchPayload,
  buildEffectiveDefaults,
} from '@/features/transcription-options/lib/defaults-patch'
import { buildTranscriptionSchemaUiModel } from '@/features/transcription-options/lib/schema-adapter'
import { isAppError } from '@/shared/lib/error-factory'
import type { AppError, CreateTaskPayload, CreateTaskResponse } from '@/shared/types'

import { AdvancedOptions } from './AdvancedOptions'

export interface TaskCreateResult {
  fileId: string
  taskId?: string
  filename?: string
  ok: boolean
  error?: AppError
}

export interface OptionsBarProps {
  fileIds: string[]
  onCreateTask: (payload: CreateTaskPayload) => Promise<CreateTaskResponse>
  onTasksCreated: (results: TaskCreateResult[]) => void
  disabled?: boolean
}
export function OptionsBar({ fileIds, onCreateTask, onTasksCreated, disabled }: OptionsBarProps) {
  const { t } = useTranslation()
  const [isCreating, setIsCreating] = useState(false)
  const [isSavingDefaults, setIsSavingDefaults] = useState(false)
  const [isResettingDefaults, setIsResettingDefaults] = useState(false)
  // Prevent double-click reentry before React re-renders.
  const creatingRef = useRef(false)

  const { config } = useAppConfig()

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

  const schema = config?.transcription.schema
  const effectiveLanguages = config?.effective_languages

  const schemaUiModel = useMemo(
    () =>
      buildTranscriptionSchemaUiModel({
        schema: schema ?? [],
        effectiveLanguages: effectiveLanguages ?? [],
      }),
    [schema, effectiveLanguages],
  )

  const supportedTaskValues = useMemo(
    () => new Set(schemaUiModel.taskControl.options.map((option) => option.value)),
    [schemaUiModel.taskControl.options],
  )

  function toAppError(err: unknown): AppError {
    if (isAppError(err)) return err
    return {
      code: 'API_SERVER_UNKNOWN',
      i18nKey: 'error.api.serverError',
      retriable: true,
    }
  }

  async function refreshDefaultsView(context: 'save' | 'reset'): Promise<boolean> {
    try {
      await refreshAppConfig()
      return true
    } catch (err: unknown) {
      logger.error('config.defaults.refreshFailed', { context, error: err })
      return false
    }
  }

  async function handleStart() {
    if (creatingRef.current || fileIds.length === 0) return
    creatingRef.current = true
    setIsCreating(true)

    try {
      const results: TaskCreateResult[] = []

      for (const fileId of fileIds) {
        try {
          const payload = buildRequest(fileId)
          logger.info('task.create', { fileId, optionsCount: Object.keys(payload).length - 1 })
          const res = await onCreateTask(payload)
          results.push({
            fileId,
            taskId: res.task_id,
            filename: res.filename,
            ok: true,
          })
        } catch (err: unknown) {
          logger.error('task.createFailed', { fileId, error: err })
          const appError = toAppError(err)
          results.push({ fileId, ok: false, error: appError })
        }
      }

      onTasksCreated(results)
    } finally {
      creatingRef.current = false
      setIsCreating(false)
    }
  }

  async function handleSaveDefaults() {
    // NOTE: Use state flags as the write gate; add a shared ref lock only if duplicate writes appear in real usage.
    if (!defaults || isSavingDefaults || disabled) return

    setIsSavingDefaults(true)
    try {
      const engineDefaults = (await fetchEngineDefaults()).defaults
      const nextEffectiveDefaults = buildEffectiveDefaults({
        defaults,
        language,
        task,
        initialPrompt,
        advancedOptions,
      })
      const payload = buildDefaultsPatchPayload({
        engineDefaults,
        previousEffectiveDefaults: defaults,
        nextEffectiveDefaults,
      })

      await patchTranscriptionDefaults(payload)
      await refreshDefaultsView('save')
      toast.success(t('options.defaults.saved'))
    } catch (err: unknown) {
      logger.error('config.defaults.saveFailed', { error: err })
      const appError = toAppError(err)
      toast.error(t(appError.i18nKey, appError.params ?? {}))
    } finally {
      setIsSavingDefaults(false)
    }
  }

  async function handleResetDefaults() {
    // NOTE: Use state flags as the write gate; add a shared ref lock only if save/reset overlap appears in real usage.
    if (isResettingDefaults || disabled) return

    setIsResettingDefaults(true)
    try {
      await deleteTranscriptionDefaults()
      const refreshed = await refreshDefaultsView('reset')
      if (refreshed) {
        resetOptionOverrides()
      }
      toast.success(t('options.defaults.resetDone'))
    } catch (err: unknown) {
      logger.error('config.defaults.resetFailed', { error: err })
      const appError = toAppError(err)
      toast.error(t(appError.i18nKey, appError.params ?? {}))
    } finally {
      setIsResettingDefaults(false)
    }
  }

  const controlsDisabled = disabled || isCreating || isSavingDefaults || isResettingDefaults
  const startDisabled = controlsDisabled || fileIds.length === 0
  const defaultsActionDisabled = controlsDisabled || defaults === null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="language-select">{t(schemaUiModel.languageControl.labelKey)}</Label>
          <Select
            value={language ?? '__auto__'}
            onValueChange={(value) => setLanguage(value === '__auto__' ? undefined : value)}
            disabled={controlsDisabled}
          >
            <SelectTrigger id="language-select" className="w-[160px]">
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
          <Label htmlFor="task-select">{t(schemaUiModel.taskControl.labelKey)}</Label>
          <Select
            value={task}
            onValueChange={(value) => {
              if (!supportedTaskValues.has(value)) {
                logger.warn('task.unsupportedTaskOption', { value })
                return
              }
              setTask(value)
            }}
            disabled={controlsDisabled}
          >
            <SelectTrigger id="task-select" className="w-[260px]">
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

        <Button
          id="start-transcription"
          type="button"
          onClick={handleStart}
          disabled={startDisabled}
        >
          {isCreating
            ? t('options.creating')
            : fileIds.length > 0
              ? t('options.start', { count: fileIds.length })
              : t('options.startDisabled')}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          id="save-defaults"
          type="button"
          variant="outline"
          disabled={defaultsActionDisabled}
          onClick={handleSaveDefaults}
        >
          {isSavingDefaults ? t('options.defaults.saving') : t('options.defaults.save')}
        </Button>
        <Button
          id="reset-engine-defaults"
          type="button"
          variant="outline"
          disabled={defaultsActionDisabled}
          onClick={handleResetDefaults}
        >
          {isResettingDefaults
            ? t('options.defaults.resetting')
            : t('options.defaults.resetEngine')}
        </Button>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="initial-prompt">{t(schemaUiModel.initialPromptControl.labelKey)}</Label>
        <Textarea
          id="initial-prompt"
          disabled={controlsDisabled}
          value={initialPrompt ?? ''}
          placeholder={
            typeof defaults?.initial_prompt === 'string' ? defaults.initial_prompt : undefined
          }
          onChange={(e) => {
            const next = e.target.value
            setInitialPrompt(next === '' ? null : next)
          }}
        />
      </div>

      <AdvancedOptions
        schema={schemaUiModel.advancedSchema}
        advancedOptions={advancedOptions}
        defaults={defaults}
        onOptionChange={setAdvancedOption}
        onReset={resetAdvancedOptions}
        disabled={controlsDisabled}
      />
    </div>
  )
}
