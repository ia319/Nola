import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AppConfig } from '@/shared/types'
import { _resetConfigCache, refreshAppConfig, useAppConfig } from '../use-app-config'

const { fetchAppConfigMock } = vi.hoisted(() => ({
  fetchAppConfigMock: vi.fn(),
}))

vi.mock('../api', () => ({
  fetchAppConfig: (...args: unknown[]) => fetchAppConfigMock(...(args as [])),
}))

vi.mock('../logger', () => ({
  default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

function buildConfig(overrides?: Partial<AppConfig>): AppConfig {
  return {
    engine: {
      model_size: 'small',
      device: 'cpu',
      compute_type: 'default',
      is_multilingual: true,
    },
    transcription: {
      defaults: {
        language: null,
        task: 'transcribe',
        beam_size: 5,
        best_of: 5,
        patience: 1,
        length_penalty: 1,
        repetition_penalty: 1,
        no_repeat_ngram_size: 0,
        temperature: [0, 0.2, 0.4, 0.6, 0.8, 1],
        compression_ratio_threshold: 2.4,
        log_prob_threshold: -1,
        no_speech_threshold: 0.6,
        condition_on_previous_text: true,
        prompt_reset_on_temperature: 0.5,
        initial_prompt: null,
        prefix: null,
        hotwords: null,
        suppress_blank: true,
        suppress_tokens: [-1],
        max_new_tokens: null,
        without_timestamps: false,
        max_initial_timestamp: 1,
        word_timestamps: false,
        prepend_punctuations: `"'“¿([{-`,
        append_punctuations: `"'.。,，!！?？:：”)]}、`,
        vad_filter: false,
        vad_parameters: {
          threshold: 0.5,
          neg_threshold: null,
          min_speech_duration_ms: 0,
          max_speech_duration_s: 'inf',
          min_silence_duration_ms: 2000,
          speech_pad_ms: 400,
          min_silence_at_max_speech: 98,
          use_max_poss_sil_at_max_speech: true,
        },
        multilingual: false,
        chunk_length: null,
        clip_timestamps: '0',
        hallucination_silence_threshold: null,
        language_detection_threshold: 0.5,
        language_detection_segments: 1,
      },
      schema: [],
    },
    file: {
      allowed_extensions: ['.mp3'],
      allowed_mime_types: ['audio/mpeg'],
      max_file_size: 500 * 1024 * 1024,
    },
    effective_languages: [{ code: 'en', label_key: 'options.language.en' }],
    ...overrides,
  }
}

describe('useAppConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    _resetConfigCache()
  })

  it('fetches config once on first mount and exposes values', async () => {
    const config = buildConfig()
    fetchAppConfigMock.mockResolvedValue(config)

    const { result } = renderHook(() => useAppConfig())

    expect(result.current.config).toBeNull()
    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.config).toEqual(config)
    })

    expect(fetchAppConfigMock).toHaveBeenCalledTimes(1)
    expect(result.current.isLoading).toBe(false)
  })

  it('shares the same in-flight request across multiple consumers', async () => {
    let resolveFetch: (value: AppConfig) => void = () => undefined
    fetchAppConfigMock.mockImplementation(
      () =>
        new Promise<AppConfig>((resolve) => {
          resolveFetch = resolve
        }),
    )

    const first = renderHook(() => useAppConfig())
    const second = renderHook(() => useAppConfig())

    expect(fetchAppConfigMock).toHaveBeenCalledTimes(1)

    act(() => {
      resolveFetch(buildConfig())
    })

    await waitFor(() => {
      expect(first.result.current.config).not.toBeNull()
      expect(second.result.current.config).not.toBeNull()
    })
  })

  it('updates mounted consumers after refreshAppConfig', async () => {
    const initial = buildConfig({
      file: {
        allowed_extensions: ['.wav'],
        allowed_mime_types: ['audio/wav'],
        max_file_size: 100,
      },
    })
    const refreshed = buildConfig({
      file: {
        allowed_extensions: ['.flac'],
        allowed_mime_types: ['audio/flac'],
        max_file_size: 200,
      },
    })

    fetchAppConfigMock.mockResolvedValueOnce(initial).mockResolvedValueOnce(refreshed)

    const { result } = renderHook(() => useAppConfig())

    await waitFor(() => {
      expect(result.current.config).toEqual(initial)
    })

    await act(async () => {
      await refreshAppConfig()
    })

    await waitFor(() => {
      expect(result.current.config).toEqual(refreshed)
    })

    expect(fetchAppConfigMock).toHaveBeenCalledTimes(2)
  })
})
