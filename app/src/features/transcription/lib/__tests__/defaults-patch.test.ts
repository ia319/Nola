import { describe, expect, it } from 'vitest'

import {
  buildDefaultsPatchPayload,
  buildEffectiveDefaults,
} from '@/features/transcription/lib/defaults-patch'
import type { TranscriptionDefaults } from '@/shared/types'

function defaults(value: Record<string, unknown>): TranscriptionDefaults {
  return value as unknown as TranscriptionDefaults
}

describe('defaults-patch', () => {
  it('builds effective defaults by applying local option overrides', () => {
    const effective = buildEffectiveDefaults({
      defaults: defaults({
        language: null,
        task: 'transcribe',
        beam_size: 3,
        vad_parameters: { threshold: 0.6, speech_pad_ms: 400 },
      }),
      language: 'en',
      task: 'translate',
      initialPrompt: undefined,
      advancedOptions: {
        beam_size: 4,
        'vad_parameters.threshold': 0.7,
      },
    })

    expect(effective).toEqual({
      language: 'en',
      task: 'translate',
      beam_size: 4,
      vad_parameters: { threshold: 0.7, speech_pad_ms: 400 },
    })
  })

  it('builds patch payload with nested removals and additions', () => {
    const payload = buildDefaultsPatchPayload({
      engineDefaults: defaults({
        language: null,
        task: 'transcribe',
        beam_size: 5,
        vad_parameters: { threshold: 0.5, speech_pad_ms: 400 },
      }),
      previousEffectiveDefaults: defaults({
        language: 'ja',
        task: 'transcribe',
        beam_size: 3,
        vad_parameters: { threshold: 0.6, speech_pad_ms: 400 },
      }),
      nextEffectiveDefaults: defaults({
        language: null,
        task: 'translate',
        beam_size: 5,
        vad_parameters: { threshold: 0.5, speech_pad_ms: 450 },
      }),
    })

    expect(payload).toEqual({
      language: null,
      beam_size: null,
      task: 'translate',
      vad_parameters: {
        threshold: null,
        speech_pad_ms: 450,
      },
    })
  })

  it('keeps explicit null clears when building effective defaults and patch payload', () => {
    const engineDefaults = defaults({
      language: null,
      task: 'transcribe',
      beam_size: 5,
      initial_prompt: null,
      hotwords: null,
    })
    const previousEffective = defaults({
      language: null,
      task: 'transcribe',
      beam_size: 3,
      initial_prompt: 'keep context',
      hotwords: 'brand name',
    })
    const nextEffective = buildEffectiveDefaults({
      defaults: previousEffective,
      language: undefined,
      task: 'transcribe',
      initialPrompt: null,
      advancedOptions: {
        beam_size: null,
        hotwords: null,
      },
    })

    const payload = buildDefaultsPatchPayload({
      engineDefaults,
      previousEffectiveDefaults: previousEffective,
      nextEffectiveDefaults: nextEffective,
    })

    expect(nextEffective.initial_prompt).toBeNull()
    expect(nextEffective.hotwords).toBeNull()
    expect(payload).toEqual({
      beam_size: null,
      initial_prompt: null,
      hotwords: null,
    })
  })
})
