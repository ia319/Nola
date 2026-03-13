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

/**
 * Manage transcription option state and build create-task payloads.
 * Read defaults from shared app config.
 * Enforce `word_timestamps` and `without_timestamps` mutual exclusion.
 * Convert dot-path advanced keys to nested request fields.
 */
export function useTranscriptionOptions(): UseTranscriptionOptionsReturn {
  const [language, setLanguage] = useState<string | undefined>(undefined)
  const [task, setTask] = useState<TranscriptionTaskType>('transcribe')
  const [advancedOptions, setAdvancedOptions] = useState<AdvancedTranscriptionOptions>({})
  const [initialPrompt, setInitialPrompt] = useState<string | undefined>(undefined)

  // Read defaults from the shared app config singleton.
  const { config } = useAppConfig()
  const defaults: TranscriptionDefaults | null = config?.transcription.defaults ?? null

  const setAdvancedOption = useCallback((key: string, value: AdvancedOptionValue | undefined) => {
    setAdvancedOptions((prev) => {
      const next: AdvancedTranscriptionOptions = { ...prev, [key]: value }

      // Keep `word_timestamps` and `without_timestamps` mutually exclusive.
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

  const buildRequest = useCallback(
    (fileId: string) => {
      const payload: CreateTaskPayload = { file_id: fileId }

      if (language !== undefined) payload.language = language
      if (task !== 'transcribe') payload.task = task
      if (initialPrompt !== undefined) payload.initial_prompt = initialPrompt

      // Convert dot-path keys back into nested request objects.
      const advancedPayload: Record<string, unknown> = {}

      for (const [k, v] of Object.entries(advancedOptions)) {
        if (v !== undefined) {
          setValueByPath(advancedPayload, k, v)
        }
      }

      Object.assign(payload, advancedPayload as Partial<CreateTaskPayload>)

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
