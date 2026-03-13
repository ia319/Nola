import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import logger from '@/config/logger'
import {
  deleteTranscriptionDefaults,
  fetchEngineDefaults,
  patchTranscriptionDefaults,
} from '@/config/api'
import { refreshAppConfig, useAppConfig } from '@/config/use-app-config'
import { createTask } from '@/features/transcription/api'
import { useTranscriptionOptions } from '@/features/transcription/hooks/useTranscriptionOptions'
import {
  buildDefaultsPatchPayload,
  buildEffectiveDefaults,
} from '@/features/transcription/lib/defaults-patch'
import { isAppError } from '@/shared/lib/error-factory'
import type { AppError, LanguageOption } from '@/shared/types'

import { AdvancedOptions } from './AdvancedOptions'

/** Represent a per-file task creation result. */
export interface TaskCreateResult {
  fileId: string
  taskId?: string
  ok: boolean
  error?: AppError
}

/** Synthetic auto-detect entry prepended to the language list. */
const AUTO_DETECT: LanguageOption = { code: '__auto__', label_key: 'options.language.auto' }

export interface OptionsBarProps {
  /** File IDs available for task creation (success && !taskCreated). */
  fileIds: string[]
  /** Callback after batch task creation attempt. */
  onTasksCreated: (results: TaskCreateResult[]) => void
  disabled?: boolean
}

/**
 * Render language/task selectors, an advanced-options panel, and the
 * "Start Transcription" button.
 *
 * Delegate error display to the container layer via onTasksCreated results.
 */
export function OptionsBar({ fileIds, onTasksCreated, disabled }: OptionsBarProps) {
  const { t } = useTranslation()
  const [isCreating, setIsCreating] = useState(false)
  const [isSavingDefaults, setIsSavingDefaults] = useState(false)
  const [isResettingDefaults, setIsResettingDefaults] = useState(false)
  // Synchronous lock to prevent double-click reentry before React re-renders.
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

  // Build language list: auto-detect + backend effective_languages.
  const languages: LanguageOption[] = config
    ? [AUTO_DETECT, ...config.effective_languages]
    : [AUTO_DETECT]
  const transcriptionSchema = config?.transcription.schema ?? []

  function toAppError(err: unknown): AppError {
    if (isAppError(err)) return err
    return {
      code: 'API_SERVER_UNKNOWN',
      i18nKey: 'error.api.serverError',
      retriable: true,
    }
  }

  /** Create tasks for all available file IDs, collecting per-file results. */
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
          const res = await createTask(payload)
          results.push({ fileId, taskId: res.task_id, ok: true })
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
      await refreshAppConfig()
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
    if (isResettingDefaults || disabled) return

    setIsResettingDefaults(true)
    try {
      // Load engine defaults to keep reset flow aligned with backend source.
      await fetchEngineDefaults()
      await deleteTranscriptionDefaults()
      resetOptionOverrides()
      await refreshAppConfig()
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
      {/* Basic options row */}
      <div className="flex flex-wrap items-end gap-4">
        {/* Language selector */}
        <div className="space-y-1.5">
          <Label htmlFor="language-select">{t('options.language.label')}</Label>
          <Select
            value={language ?? '__auto__'}
            onValueChange={(v) => setLanguage(v === '__auto__' ? undefined : v)}
            disabled={controlsDisabled}
          >
            <SelectTrigger id="language-select" className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {languages.map((lang) => (
                <SelectItem key={lang.code} value={lang.code}>
                  {t(lang.label_key)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Task type selector */}
        <div className="space-y-1.5">
          <Label htmlFor="task-select">{t('options.task.label')}</Label>
          <Select
            value={task}
            onValueChange={(v) => setTask(v as 'transcribe' | 'translate')}
            disabled={controlsDisabled}
          >
            <SelectTrigger id="task-select" className="w-[260px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="transcribe">{t('options.task.transcribe')}</SelectItem>
              <SelectItem value="translate">{t('options.task.translate')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Start button */}
        {/* NOTE: add type="button" to all buttons when wrapping in <form> */}
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

      {/* Initial prompt */}
      <div className="space-y-1.5">
        <Label htmlFor="initial-prompt">{t('options.field.initialPrompt')}</Label>
        <Textarea
          id="initial-prompt"
          disabled={controlsDisabled}
          value={initialPrompt ?? ''}
          placeholder={
            typeof defaults?.initial_prompt === 'string' ? defaults.initial_prompt : undefined
          }
          onChange={(e) => setInitialPrompt(e.target.value || undefined)}
        />
      </div>

      {/* Advanced options */}
      <AdvancedOptions
        schema={transcriptionSchema}
        advancedOptions={advancedOptions}
        defaults={defaults}
        onOptionChange={setAdvancedOption}
        onReset={resetAdvancedOptions}
        disabled={controlsDisabled}
      />
    </div>
  )
}
