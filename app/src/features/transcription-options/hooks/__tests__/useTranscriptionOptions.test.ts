// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useTranscriptionOptions } from '../useTranscriptionOptions'
import type { UseAppConfigReturn } from '@/config/use-app-config'
import type { TranscriptionDefaults } from '@/shared/types'

const useAppConfigMock = vi.fn<() => UseAppConfigReturn>()

vi.mock('@/config/use-app-config', () => ({
  useAppConfig: (...args: unknown[]) => useAppConfigMock(...(args as [])),
}))

function buildAppConfigReturn(defaults: Record<string, unknown> = {}): UseAppConfigReturn {
  return {
    config: {
      engine: {
        model_size: 'small',
        device: 'cpu',
        compute_type: 'default',
        is_multilingual: true,
      },
      transcription: { defaults: defaults as TranscriptionDefaults, schema: [] },
      file: { allowed_extensions: [], allowed_mime_types: [], max_file_size: 0 },
      effective_languages: [],
    },
    fileValidationConfig: { allowedExtensions: [], allowedMimeTypes: [], maxFileSize: 0 },
    isLoading: false,
  }
}

function buildLoadingReturn(): UseAppConfigReturn {
  return {
    config: null,
    fileValidationConfig: { allowedExtensions: [], allowedMimeTypes: [], maxFileSize: 0 },
    isLoading: true,
  }
}

async function renderTranscriptionOptions(defaults: Record<string, unknown> = {}) {
  useAppConfigMock.mockReturnValue(buildAppConfigReturn(defaults))

  const hook = renderHook(() => useTranscriptionOptions())

  await waitFor(() => {
    expect(hook.result.current.defaults).toEqual(defaults)
  })

  return hook
}

describe('useTranscriptionOptions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns correct initial state and loads backend defaults', async () => {
    const defaults = { beam_size: 5, temperature: [0, 0.2, 0.4] }
    const { result } = await renderTranscriptionOptions(defaults)

    expect(result.current.language).toBeUndefined()
    expect(result.current.task).toBe('transcribe')
    expect(result.current.advancedOptions).toEqual({})
    expect(result.current.initialPrompt).toBeUndefined()
    expect(result.current.defaults).toEqual(defaults)
  })

  it('hydrates language and task from persisted defaults', async () => {
    const defaults = { language: 'ja', task: 'translate' }
    const { result } = await renderTranscriptionOptions(defaults)

    expect(result.current.language).toBe('ja')
    expect(result.current.task).toBe('translate')
  })

  it('updates language via setLanguage', async () => {
    const { result } = await renderTranscriptionOptions()

    act(() => {
      result.current.setLanguage('zh')
    })

    expect(result.current.language).toBe('zh')
  })

  it('updates task via setTask', async () => {
    const { result } = await renderTranscriptionOptions()

    act(() => {
      result.current.setTask('translate')
    })

    expect(result.current.task).toBe('translate')
  })

  it('updates initialPrompt via setInitialPrompt', async () => {
    const { result } = await renderTranscriptionOptions()

    act(() => {
      result.current.setInitialPrompt('context text')
    })

    expect(result.current.initialPrompt).toBe('context text')
  })

  it('updates advanced options and enforces mutual exclusion', async () => {
    const { result } = await renderTranscriptionOptions()

    act(() => {
      result.current.setAdvancedOption('word_timestamps', true)
    })
    expect(result.current.advancedOptions.word_timestamps).toBe(true)

    act(() => {
      result.current.setAdvancedOption('without_timestamps', true)
    })
    expect(result.current.advancedOptions.without_timestamps).toBe(true)
    expect(result.current.advancedOptions.word_timestamps).toBe(false)

    // Reverse: setting word_timestamps clears without_timestamps.
    act(() => {
      result.current.setAdvancedOption('word_timestamps', true)
    })
    expect(result.current.advancedOptions.word_timestamps).toBe(true)
    expect(result.current.advancedOptions.without_timestamps).toBe(false)
  })

  it('resets advanced options without affecting other state', async () => {
    const { result } = await renderTranscriptionOptions()

    act(() => {
      result.current.setLanguage('en')
      result.current.setInitialPrompt('keep me')
      result.current.setAdvancedOption('beam_size', 5)
    })

    act(() => {
      result.current.resetAdvancedOptions()
    })

    expect(result.current.advancedOptions).toEqual({})
    expect(result.current.language).toBe('en')
    expect(result.current.initialPrompt).toBe('keep me')
  })

  it('resets local option overrides to backend defaults', async () => {
    const defaults = { language: 'ja', task: 'translate' }
    const { result } = await renderTranscriptionOptions(defaults)

    act(() => {
      result.current.setLanguage('en')
      result.current.setTask('transcribe')
      result.current.setAdvancedOption('beam_size', 5)
      result.current.setInitialPrompt('keep me')
    })

    act(() => {
      result.current.resetOptionOverrides()
    })

    expect(result.current.language).toBe('ja')
    expect(result.current.task).toBe('translate')
    expect(result.current.advancedOptions).toEqual({})
    expect(result.current.initialPrompt).toBeUndefined()
  })

  it('builds a correctly typed CreateTaskPayload', async () => {
    const { result } = await renderTranscriptionOptions()

    act(() => {
      result.current.setLanguage('ja')
      result.current.setTask('translate')
      result.current.setInitialPrompt('prompt')
      result.current.setAdvancedOption('beam_size', 3)
    })

    const payload = result.current.buildRequest('file-1')

    expect(payload).toEqual({
      file_id: 'file-1',
      language: 'ja',
      task: 'translate',
      initial_prompt: 'prompt',
      beam_size: 3,
    })
  })

  it('keeps defaults null when config has not loaded', () => {
    useAppConfigMock.mockReturnValue(buildLoadingReturn())

    const { result } = renderHook(() => useTranscriptionOptions())

    expect(result.current.defaults).toBeNull()
  })
})
