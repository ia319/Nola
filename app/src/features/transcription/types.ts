import type { CreateTaskRequest } from '@/shared/types'

/** Fields the user can modify via the AdvancedOptions panel. */
export type AdvancedTranscriptionOptions = Pick<
  CreateTaskRequest,
  | 'beam_size'
  | 'temperature'
  | 'vad_filter'
  | 'no_speech_threshold'
  | 'initial_prompt'
  | 'condition_on_previous_text'
  | 'word_timestamps'
  | 'multilingual'
>

/** Supported input control types for data-driven option rendering. */
export type OptionFieldType = 'number' | 'number-list' | 'slider' | 'switch' | 'text'

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

/** Whitelisted option groups driving the AdvancedOptions UI (AD-2). */
export const OPTION_GROUPS: OptionGroupDef[] = [
  {
    titleKey: 'options.group.decoding',
    fields: [
      {
        key: 'beam_size',
        labelKey: 'options.field.beamSize',
        type: 'number',
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
      { key: 'initial_prompt', labelKey: 'options.field.initialPrompt', type: 'text' },
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
