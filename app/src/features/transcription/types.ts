import type { CreateTaskPayload, TranscriptionDefaults } from '@/shared/types'

/** Leaf value types emitted by schema-driven transcription controls. */
export type AdvancedOptionValue = string | number | boolean | number[] | null

/**
 * Dot-path keyed option state (for example: `beam_size`,
 * `suppress_tokens`, `vad_parameters.threshold`).
 */
export type AdvancedTranscriptionOptions = Record<string, AdvancedOptionValue | undefined>

/** Treat task values as backend-driven option codes. */
export type TranscriptionTaskType = string

/** Define the stable contract consumed by option UI and task-creation orchestration. */
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
