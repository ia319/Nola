import type { CreateTaskPayload, TranscriptionDefaults } from '@/shared/types'

export type AdvancedOptionValue = string | number | boolean | number[] | null

export type AdvancedTranscriptionOptions = Record<string, AdvancedOptionValue | undefined>

export type TranscriptionTaskType = NonNullable<CreateTaskPayload['task']>

export interface UseTranscriptionOptionsReturn {
  language: string | undefined
  task: TranscriptionTaskType
  advancedOptions: AdvancedTranscriptionOptions
  defaults: TranscriptionDefaults | null

  setLanguage: (lang: string | undefined) => void
  setTask: (task: TranscriptionTaskType) => void
  setAdvancedOption: (key: string, value: AdvancedOptionValue | undefined) => void
  resetAdvancedOptions: () => void
  resetOptionOverrides: () => void
  buildRequest: (fileId: string) => CreateTaskPayload
  initialPrompt: string | null | undefined
  setInitialPrompt: (value: string | null | undefined) => void
}
