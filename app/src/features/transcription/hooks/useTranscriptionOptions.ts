import { useCallback, useState } from 'react'
import type { CreateTaskPayload, TranscriptionDefaults } from '@/shared/types'
import type {
  AdvancedTranscriptionOptions,
  TranscriptionTaskType,
  UseTranscriptionOptionsReturn,
} from '@/features/transcription/types'
import { useAppConfig } from '@/config/use-app-config'

/**
 * Manage transcription option state and build the createTask payload.
 *
 * Consume backend defaults from the shared `useAppConfig` hook (no
 * separate fetch — the config singleton handles caching).
 * Enforces mutual-exclusion between word_timestamps and without_timestamps.
 */
export function useTranscriptionOptions(): UseTranscriptionOptionsReturn {
  const [language, setLanguage] = useState<string | undefined>(undefined)
  const [task, setTask] = useState<TranscriptionTaskType>('transcribe')
  const [advancedOptions, setAdvancedOptions] = useState<AdvancedTranscriptionOptions>({})
  const [initialPrompt, setInitialPrompt] = useState<string | undefined>(undefined)

  // Consume defaults from the shared app config singleton.
  const { config } = useAppConfig()
  const defaults: TranscriptionDefaults | null = config?.transcription.defaults ?? null

  const setAdvancedOption = useCallback(
    <K extends keyof AdvancedTranscriptionOptions>(
      key: K,
      value: AdvancedTranscriptionOptions[K] | undefined,
    ) => {
      setAdvancedOptions((prev) => {
        const next: AdvancedTranscriptionOptions = { ...prev, [key]: value }

        // Mutual exclusion: word_timestamps and without_timestamps cannot both be true.
        if (key === 'word_timestamps' && value === true) {
          next.without_timestamps = false
        }
        if (key === 'without_timestamps' && value === true) {
          next.word_timestamps = false
        }

        return next
      })
    },
    [],
  )

  const resetAdvancedOptions = useCallback(() => {
    setAdvancedOptions({})
  }, [])

  const buildRequest = useCallback(
    (fileId: string) => {
      const payload: CreateTaskPayload = { file_id: fileId }

      if (language !== undefined) payload.language = language
      if (task !== 'transcribe') payload.task = task
      if (initialPrompt !== undefined) payload.initial_prompt = initialPrompt

      // Merge only defined advanced options into payload.
      for (const [k, v] of Object.entries(advancedOptions)) {
        if (v !== undefined) {
          Object.assign(payload, { [k]: v })
        }
      }

      return payload
    },
    [language, task, initialPrompt, advancedOptions],
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
    buildRequest,
    initialPrompt,
    setInitialPrompt,
  }
}
