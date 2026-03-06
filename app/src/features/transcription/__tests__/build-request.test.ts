import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getDefaultOptions } from '@/features/transcription/api'
import { useTranscriptionOptions } from '@/features/transcription/hooks/useTranscriptionOptions'

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
})
