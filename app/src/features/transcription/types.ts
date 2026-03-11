import type { CreateTaskPayload, CreateTaskRequest, TranscriptionDefaults } from '@/shared/types'

/** All transcription options excluding top-level state fields and initial_prompt. */
export type AdvancedTranscriptionOptions = Partial<
  Omit<CreateTaskRequest, 'file_id' | 'language' | 'task' | 'initial_prompt'>
>

/** Keep task mode constrained to backend-supported values across UI and payload builders. */
export type TranscriptionTaskType = 'transcribe' | 'translate'

/** Define the stable contract consumed by option UI and task-creation orchestration. */
export interface UseTranscriptionOptionsReturn {
  language: string | undefined
  task: TranscriptionTaskType
  advancedOptions: AdvancedTranscriptionOptions
  defaults: TranscriptionDefaults | null

  setLanguage: (lang: string | undefined) => void
  setTask: (task: TranscriptionTaskType) => void
  setAdvancedOption: <K extends keyof AdvancedTranscriptionOptions>(
    key: K,
    value: AdvancedTranscriptionOptions[K] | undefined,
  ) => void
  resetAdvancedOptions: () => void
  buildRequest: (fileId: string) => CreateTaskPayload
  initialPrompt: string | undefined
  setInitialPrompt: (value: string | undefined) => void
}

/** Supported input control types for data-driven option rendering. */
export type OptionFieldType = 'number' | 'number-list' | 'slider' | 'switch' | 'text' | 'textarea'

/** Describes a single editable field within an option group. */
export interface OptionFieldDef {
  /** Key into AdvancedTranscriptionOptions. */
  key: keyof AdvancedTranscriptionOptions
  /** i18n label key. */
  labelKey: string
  type: OptionFieldType
  /** For number / slider fields. */
  min?: number
  max?: number
  step?: number
}

/** Groups related option fields under a shared section heading. */
export interface OptionGroupDef {
  /** i18n group title key. */
  titleKey: string
  fields: OptionFieldDef[]
}

/** Whitelisted option groups driving the AdvancedOptions UI. */
export const OPTION_GROUPS: OptionGroupDef[] = [
  {
    titleKey: 'options.group.decoding',
    fields: [
      {
        key: 'beam_size',
        labelKey: 'options.field.beamSize',
        type: 'slider',
        min: 1,
        max: 10,
        step: 1,
      },
      { key: 'temperature', labelKey: 'options.field.temperature', type: 'number-list' },
    ],
  },
  {
    titleKey: 'options.group.quality',
    fields: [
      { key: 'vad_filter', labelKey: 'options.field.vadFilter', type: 'switch' },
      {
        key: 'no_speech_threshold',
        labelKey: 'options.field.noSpeechThreshold',
        type: 'slider',
        min: 0,
        max: 1,
        step: 0.05,
      },
    ],
  },
  {
    titleKey: 'options.group.context',
    fields: [
      {
        key: 'condition_on_previous_text',
        labelKey: 'options.field.conditionOnPreviousText',
        type: 'switch',
      },
    ],
  },
  {
    titleKey: 'options.group.timestamps',
    fields: [{ key: 'word_timestamps', labelKey: 'options.field.wordTimestamps', type: 'switch' }],
  },
  {
    titleKey: 'options.group.advanced',
    fields: [{ key: 'multilingual', labelKey: 'options.field.multilingual', type: 'switch' }],
  },
]
