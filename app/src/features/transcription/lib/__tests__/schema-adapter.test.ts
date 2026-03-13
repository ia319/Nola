import { describe, expect, it } from 'vitest'

import { buildTranscriptionSchemaUiModel } from '../schema-adapter'
import type { LanguageOption, TranscriptionOptionGroup } from '@/shared/types'

describe('buildTranscriptionSchemaUiModel', () => {
  it('extracts top-level controls from schema metadata', () => {
    const schema: TranscriptionOptionGroup[] = [
      {
        group: 'general',
        group_label_key: 'options.group.general',
        fields: [
          {
            key: 'language',
            label_key: 'options.language.label',
            type: 'select',
            options_source: 'effective_languages',
          },
          {
            key: 'task',
            label_key: 'options.task.label',
            type: 'select',
            options: [
              { value: 'transcribe', label_key: 'options.task.transcribe' },
              { value: 'translate', label_key: 'options.task.translate' },
            ],
          },
          {
            key: 'initial_prompt',
            label_key: 'options.field.initialPrompt',
            type: 'text',
          },
        ],
      },
      {
        group: 'decoding',
        group_label_key: 'options.group.decoding',
        fields: [
          {
            key: 'beam_size',
            label_key: 'options.field.beamSize',
            type: 'slider',
            min: 1,
            max: 10,
            step: 1,
          },
        ],
      },
    ]

    const effectiveLanguages: LanguageOption[] = [
      { code: 'en', label_key: 'options.language.en' },
      { code: 'zh', label_key: 'options.language.zh' },
    ]

    const result = buildTranscriptionSchemaUiModel({ schema, effectiveLanguages })

    expect(result.languageControl.options.map((option) => option.value)).toEqual([
      '__auto__',
      'en',
      'zh',
    ])
    expect(result.taskControl.options.map((option) => option.value)).toEqual([
      'transcribe',
      'translate',
    ])
    expect(result.initialPromptControl.key).toBe('initial_prompt')
    expect(result.advancedSchema).toHaveLength(1)
    expect(result.advancedSchema[0]?.group).toBe('decoding')
  })

  it('builds fallback controls when schema omits select fields', () => {
    const schema: TranscriptionOptionGroup[] = [
      {
        group: 'context',
        group_label_key: 'options.group.context',
        fields: [
          {
            key: 'initial_prompt',
            label_key: 'options.field.initialPrompt',
            type: 'text',
          },
        ],
      },
    ]

    const effectiveLanguages: LanguageOption[] = [{ code: 'en', label_key: 'options.language.en' }]

    const result = buildTranscriptionSchemaUiModel({ schema, effectiveLanguages })

    expect(result.languageControl.options.map((option) => option.value)).toEqual(['__auto__', 'en'])
    expect(result.taskControl.options.map((option) => option.value)).toEqual([
      'transcribe',
      'translate',
    ])
    expect(result.advancedSchema).toHaveLength(0)
  })
})
