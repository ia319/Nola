// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useTranscriptionOptions } from '@/features/transcription-options/hooks/useTranscriptionOptions'
import type { UseAppConfigReturn } from '@/config/use-app-config'
import type { TranscriptionDefaults } from '@/shared/types'
import { buildTranscriptionDefaults } from '@/test-utils/transcription-defaults'

const useAppConfigMock = vi.fn<() => UseAppConfigReturn>()

vi.mock('@/config/use-app-config', () => ({
  useAppConfig: (...args: unknown[]) => useAppConfigMock(...(args as [])),
}))

function buildAppConfigReturn(overrides: Partial<TranscriptionDefaults> = {}): UseAppConfigReturn {
  const defaults = buildTranscriptionDefaults(overrides)

  return {
    config: {
      engine: {
        model_size: 'small',
        device: 'cpu',
        compute_type: 'default',
        is_multilingual: true,
      },
      transcription: { defaults, schema: [] },
      file: { allowed_extensions: [], allowed_mime_types: [], max_file_size: 0 },
      effective_languages: [],
    },
    fileValidationConfig: { allowedExtensions: [], allowedMimeTypes: [], maxFileSize: 0 },
    isLoading: false,
  }
}

async function renderTranscriptionOptions(overrides: Partial<TranscriptionDefaults> = {}) {
  const defaults = buildTranscriptionDefaults(overrides)
  useAppConfigMock.mockReturnValue(buildAppConfigReturn(overrides))

  const hook = renderHook(() => useTranscriptionOptions())

  await waitFor(() => {
    expect(hook.result.current.defaults).toEqual(defaults)
  })

  return hook
}

describe('buildRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns only file_id when all options are default', async () => {
    const { result } = await renderTranscriptionOptions()

    expect(result.current.buildRequest('f-1')).toEqual({ file_id: 'f-1' })
  })

  it('includes a single modified advanced option', async () => {
    const { result } = await renderTranscriptionOptions()

    act(() => {
      result.current.setAdvancedOption('beam_size', 5)
    })

    expect(result.current.buildRequest('f-2')).toEqual({ file_id: 'f-2', beam_size: 5 })
  })

  it('includes multiple modified advanced options', async () => {
    const { result } = await renderTranscriptionOptions()

    act(() => {
      result.current.setAdvancedOption('beam_size', 3)
      result.current.setAdvancedOption('vad_filter', true)
      result.current.setAdvancedOption('temperature', 0.8)
    })

    expect(result.current.buildRequest('f-3')).toEqual({
      file_id: 'f-3',
      beam_size: 3,
      vad_filter: true,
      temperature: 0.8,
    })
  })

  it('expands dot-path options into nested payload objects', async () => {
    const { result } = await renderTranscriptionOptions()

    act(() => {
      result.current.setAdvancedOption('vad_parameters.threshold', 0.7)
      result.current.setAdvancedOption('vad_parameters.speech_pad_ms', 500)
    })

    expect(result.current.buildRequest('f-3b')).toEqual({
      file_id: 'f-3b',
      vad_parameters: {
        threshold: 0.7,
        speech_pad_ms: 500,
      },
    })
  })

  it('keeps special string values like inf when building nested payload', async () => {
    const { result } = await renderTranscriptionOptions()

    act(() => {
      result.current.setAdvancedOption('vad_parameters.max_speech_duration_s', 'inf')
    })

    expect(result.current.buildRequest('f-3c')).toEqual({
      file_id: 'f-3c',
      vad_parameters: {
        max_speech_duration_s: 'inf',
      },
    })
  })

  it('filters out undefined advanced option values', async () => {
    const { result } = await renderTranscriptionOptions()

    act(() => {
      result.current.setAdvancedOption('beam_size', 5)
      result.current.setAdvancedOption('beam_size', undefined)
      result.current.setAdvancedOption('vad_filter', true)
    })

    const payload = result.current.buildRequest('f-4')

    expect(payload).toEqual({ file_id: 'f-4', vad_filter: true })
    expect(payload).not.toHaveProperty('beam_size')
  })

  it('merges language, task, and initial_prompt into payload', async () => {
    const { result } = await renderTranscriptionOptions()

    act(() => {
      result.current.setLanguage('zh')
      result.current.setTask('translate')
      result.current.setInitialPrompt('hello context')
      result.current.setAdvancedOption('beam_size', 5)
    })

    expect(result.current.buildRequest('f-5')).toEqual({
      file_id: 'f-5',
      language: 'zh',
      task: 'translate',
      initial_prompt: 'hello context',
      beam_size: 5,
    })
  })

  it('sends null language when auto-detect overrides a persisted language default', async () => {
    const { result } = await renderTranscriptionOptions({
      language: 'ja',
      task: 'transcribe',
    })

    act(() => {
      result.current.setLanguage(undefined)
    })

    expect(result.current.buildRequest('f-6')).toEqual({
      file_id: 'f-6',
      language: null,
    })
  })
})
