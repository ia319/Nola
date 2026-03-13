import { useCallback, useState } from 'react'
import type { CreateTaskPayload, TranscriptionDefaults } from '@/shared/types'
import type {
  AdvancedOptionValue,
  AdvancedTranscriptionOptions,
  TranscriptionTaskType,
  UseTranscriptionOptionsReturn,
} from '@/features/transcription/types'
import { useAppConfig } from '@/config/use-app-config'
import { setValueByPath } from '@/features/transcription/lib/object-path'

/** Keep option state and build task payloads. */
export function useTranscriptionOptions(): UseTranscriptionOptionsReturn {
  const [languageOverride, setLanguageOverride] = useState<string | null | undefined>(undefined)
  const [taskOverride, setTaskOverride] = useState<TranscriptionTaskType | undefined>(undefined)
  const [advancedOptions, setAdvancedOptions] = useState<AdvancedTranscriptionOptions>({})
  const [initialPrompt, setInitialPrompt] = useState<string | undefined>(undefined)

  const { config } = useAppConfig()
  const defaults: TranscriptionDefaults | null = config?.transcription.defaults ?? null

  const language =
    languageOverride === undefined
      ? (defaults?.language ?? undefined)
      : (languageOverride ?? undefined)
  const task = taskOverride ?? defaults?.task ?? 'transcribe'

  const setLanguage = useCallback((next: string | undefined) => {
    setLanguageOverride(next ?? null)
  }, [])

  const setTask = useCallback((next: TranscriptionTaskType) => {
    setTaskOverride(next)
  }, [])

  const setAdvancedOption = useCallback((key: string, value: AdvancedOptionValue | undefined) => {
    setAdvancedOptions((prev) => {
      const next: AdvancedTranscriptionOptions = { ...prev, [key]: value }

      if (key === 'word_timestamps' && value === true) {
        next.without_timestamps = false
      }
      if (key === 'without_timestamps' && value === true) {
        next.word_timestamps = false
      }

      return next
    })
  }, [])

  const resetAdvancedOptions = useCallback(() => {
    setAdvancedOptions({})
  }, [])

  const resetOptionOverrides = useCallback(() => {
    setLanguageOverride(undefined)
    setTaskOverride(undefined)
    setInitialPrompt(undefined)
    setAdvancedOptions({})
  }, [])

  const buildRequest = useCallback(
    (fileId: string) => {
      const payload: CreateTaskPayload = { file_id: fileId }

      if (languageOverride !== undefined) payload.language = languageOverride
      if (taskOverride !== undefined) payload.task = taskOverride
      if (initialPrompt !== undefined) payload.initial_prompt = initialPrompt

      const advancedPayload: Record<string, unknown> = {}

      for (const [key, value] of Object.entries(advancedOptions)) {
        if (value !== undefined) {
          setValueByPath(advancedPayload, key, value)
        }
      }

      Object.assign(payload, advancedPayload as Partial<CreateTaskPayload>)

      return payload
    },
    [advancedOptions, initialPrompt, languageOverride, taskOverride],
  )

  return {
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
  }
}
