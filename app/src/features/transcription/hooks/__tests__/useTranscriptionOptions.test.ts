import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getDefaultOptions } from '@/features/transcription/api'
import { useTranscriptionOptions } from '../useTranscriptionOptions'

vi.mock('@/features/transcription/api', () => ({
  getDefaultOptions: vi.fn().mockResolvedValue({}),
}))

vi.mock('@/config/logger', () => ({
  default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const getDefaultOptionsMock = vi.mocked(getDefaultOptions)

async function renderTranscriptionOptions(defaults: Record<string, unknown> = {}) {
  getDefaultOptionsMock.mockResolvedValue(defaults)

  const hook = renderHook(() => useTranscriptionOptions())

  await waitFor(() => {
    expect(getDefaultOptionsMock).toHaveBeenCalledTimes(1)
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
})
