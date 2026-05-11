import { describe, expect, it } from 'vitest'

import {
  buildLiveRealtimeDefaultsPatchPayload,
  buildLiveRealtimeRuntimeOverrides,
  updateLiveRealtimeDraft,
  type LiveRealtimeDraft,
} from '../live-realtime-config-draft'
import type { LiveRealtimeDefaults } from '@/shared/types'

const defaults: LiveRealtimeDefaults = {
  language: null,
  task: 'transcribe',
  context_prompt: null,
  min_chunk_ms: 700,
  buffer_trimming_ms: 15_000,
  prompt_max_chars: 2_000,
  timestamp_tolerance_ms: 80,
  max_duplicate_ngram: 5,
  silence_rms_threshold: 0.01,
  segment_close_silence_ms: 800,
  context_reset_silence_ms: 12_000,
  beam_size: 5,
  best_of: 5,
  temperature: 0,
  compression_ratio_threshold: 2.4,
  log_prob_threshold: -1,
  no_speech_threshold: 0.6,
  condition_on_previous_text: true,
  vad_filter: true,
  vad_parameters: {
    threshold: 0.5,
    neg_threshold: null,
    min_speech_duration_ms: 250,
    max_speech_duration_s: 'inf',
    min_silence_duration_ms: 500,
    speech_pad_ms: 400,
  },
}

describe('live realtime config draft helpers', () => {
  it('removes draft entries that match resolved defaults', () => {
    const draft: LiveRealtimeDraft = {
      language: 'en',
      min_chunk_ms: 900,
    }

    expect(updateLiveRealtimeDraft(draft, defaults, 'language', null)).toEqual({
      min_chunk_ms: 900,
    })
  })

  it('keeps draft entries that differ from resolved defaults', () => {
    const draft = updateLiveRealtimeDraft({}, defaults, 'vad_parameters.threshold', 0.7)

    expect(draft).toEqual({
      'vad_parameters.threshold': 0.7,
    })
  })

  it('builds nested defaults patch payloads from flat draft keys', () => {
    const payload = buildLiveRealtimeDefaultsPatchPayload({
      language: 'en',
      'vad_parameters.threshold': 0.7,
    })

    expect(payload).toEqual({
      language: 'en',
      vad_parameters: {
        threshold: 0.7,
      },
    })
  })

  it('builds nested per-session runtime override payloads from flat draft keys', () => {
    const payload = buildLiveRealtimeRuntimeOverrides({
      task: 'translate',
      'vad_parameters.min_silence_duration_ms': 400,
    })

    expect(payload).toEqual({
      task: 'translate',
      vad_parameters: {
        min_silence_duration_ms: 400,
      },
    })
  })
})
