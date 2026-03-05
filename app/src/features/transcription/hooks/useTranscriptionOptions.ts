import { useCallback, useEffect, useState } from 'react'
import type { CreateTaskPayload } from '@/shared/types'
import type {
  AdvancedTranscriptionOptions,
  TranscriptionTaskType,
  UseTranscriptionOptionsReturn,
} from '@/features/transcription/types'
import { getDefaultOptions } from '@/features/transcription/api'
import logger from '@/config/logger'

/**
 * Manage transcription option state and build the createTask payload.
 *
 * Loads backend defaults on mount for placeholder display.
 * Enforces mutual-exclusion between word_timestamps and without_timestamps.
 */
export function useTranscriptionOptions(): UseTranscriptionOptionsReturn {
  const [language, setLanguage] = useState<string | undefined>(undefined)
  const [task, setTask] = useState<TranscriptionTaskType>('transcribe')
  const [advancedOptions, setAdvancedOptions] = useState<AdvancedTranscriptionOptions>({})
  const [defaults, setDefaults] = useState<Record<string, unknown> | null>(null)

  // Load backend defaults on mount for placeholder/label display.
  useEffect(() => {
    let cancelled = false
    getDefaultOptions()
      .then((data) => {
        if (!cancelled) setDefaults(data)
      })
      .catch((err) => {
        logger.warn('Failed to load default transcription options', err)
      })
    return () => {
      cancelled = true
    }
  }, [])

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

      // Merge only defined advanced options into payload.
      for (const [k, v] of Object.entries(advancedOptions)) {
        if (v !== undefined) {
          Object.assign(payload, { [k]: v })
        }
      }

      return payload
    },
    [language, task, advancedOptions],
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
  }
}
