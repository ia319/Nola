import { useState } from 'react'
import { useTranslation } from 'react-i18next'

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
import { createTask } from '@/features/transcription/api'
import { useTranscriptionOptions } from '@/features/transcription/hooks/useTranscriptionOptions'
import { isAppError } from '@/shared/lib/error-factory'
import type { AppError } from '@/shared/types'

import { AdvancedOptions } from './AdvancedOptions'

/** Represent a per-file task creation result. */
export interface TaskCreateResult {
  fileId: string
  taskId?: string
  ok: boolean
  error?: AppError
}

/** Hardcoded common language subset; replaced by GET /api/config in a future phase. */
const LANGUAGES = [
  { value: '__auto__', labelKey: 'options.language.auto' },
  { value: 'en', labelKey: 'options.language.en' },
  { value: 'zh', labelKey: 'options.language.zh' },
  { value: 'ja', labelKey: 'options.language.ja' },
  { value: 'ko', labelKey: 'options.language.ko' },
  { value: 'de', labelKey: 'options.language.de' },
  { value: 'fr', labelKey: 'options.language.fr' },
  { value: 'es', labelKey: 'options.language.es' },
  { value: 'ru', labelKey: 'options.language.ru' },
  { value: 'ar', labelKey: 'options.language.ar' },
] as const

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

  const {
    language,
    task,
    advancedOptions,
    defaults,
    setLanguage,
    setTask,
    setAdvancedOption,
    resetAdvancedOptions,
    buildRequest,
    initialPrompt,
    setInitialPrompt,
  } = useTranscriptionOptions()

  /** Create tasks for all available file IDs, collecting per-file results. */
  async function handleStart() {
    if (fileIds.length === 0 || isCreating) return
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
          const appError: AppError = isAppError(err)
            ? err
            : {
                code: 'API_SERVER_UNKNOWN',
                i18nKey: 'error.api.serverError',
                retriable: true,
              }
          results.push({ fileId, ok: false, error: appError })
        }
      }

      onTasksCreated(results)
    } finally {
      setIsCreating(false)
    }
  }

  const controlsDisabled = disabled || isCreating
  const startDisabled = controlsDisabled || fileIds.length === 0

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
              {LANGUAGES.map((lang) => (
                <SelectItem key={lang.value} value={lang.value}>
                  {t(lang.labelKey)}
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
        <Button id="start-transcription" onClick={handleStart} disabled={startDisabled}>
          {isCreating
            ? t('options.creating')
            : fileIds.length > 0
              ? t('options.start', { count: fileIds.length })
              : t('options.startDisabled')}
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
        advancedOptions={advancedOptions}
        defaults={defaults}
        onOptionChange={setAdvancedOption}
        onReset={resetAdvancedOptions}
        disabled={controlsDisabled}
      />
    </div>
  )
}
