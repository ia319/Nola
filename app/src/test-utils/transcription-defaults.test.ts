import { describe, expect, it } from 'vitest'

import { buildTranscriptionDefaults } from './transcription-defaults'

describe('buildTranscriptionDefaults', () => {
  it('matches the runtime punctuation defaults', () => {
    const defaults = buildTranscriptionDefaults()

    expect(defaults.prepend_punctuations).toBe(`"'“¿([{-`)
    expect(defaults.append_punctuations).toBe(`"'.。,，!！?？:：”)]}、`)
  })

  it('preserves vad defaults when overriding one parameter', () => {
    const defaults = buildTranscriptionDefaults({
      vad_parameters: {
        threshold: 0.7,
      },
    })

    expect(defaults.vad_parameters).toEqual(
      expect.objectContaining({
        threshold: 0.7,
        speech_pad_ms: 400,
        min_silence_duration_ms: 2000,
      }),
    )
  })
})
