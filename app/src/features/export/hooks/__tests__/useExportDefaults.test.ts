// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { deleteExportDefaults, fetchExportConfig, patchExportDefaults } from '@/features/export/api'
import { useExportDefaults } from '../useExportDefaults'

vi.mock('@/features/export/api', () => ({
  fetchExportConfig: vi.fn(),
  patchExportDefaults: vi.fn(),
  deleteExportDefaults: vi.fn(),
}))

const fetchExportConfigMock = vi.mocked(fetchExportConfig)
const patchExportDefaultsMock = vi.mocked(patchExportDefaults)
const deleteExportDefaultsMock = vi.mocked(deleteExportDefaults)

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('useExportDefaults', () => {
  it('loads export defaults on mount', async () => {
    fetchExportConfigMock.mockResolvedValue({
      defaults: {
        format: 'vtt',
        include_timestamps: false,
      },
    })

    const { result } = renderHook(() => useExportDefaults())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(result.current.defaults).toEqual({
      format: 'vtt',
      include_timestamps: false,
    })
  })

  it('persists updated defaults and syncs local state', async () => {
    fetchExportConfigMock.mockResolvedValue({
      defaults: {
        format: 'srt',
        include_timestamps: true,
      },
    })
    patchExportDefaultsMock.mockResolvedValue({
      defaults: {
        format: 'ass',
        include_timestamps: false,
      },
    })

    const { result } = renderHook(() => useExportDefaults())
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await result.current.updateDefaults({
        format: 'ass',
        include_timestamps: false,
      })
    })

    expect(patchExportDefaultsMock).toHaveBeenCalledWith({
      format: 'ass',
      include_timestamps: false,
    })
    expect(result.current.defaults).toEqual({
      format: 'ass',
      include_timestamps: false,
    })
  })

  it('resets persisted defaults and refreshes from backend', async () => {
    fetchExportConfigMock
      .mockResolvedValueOnce({
        defaults: {
          format: 'txt',
          include_timestamps: false,
        },
      })
      .mockResolvedValueOnce({
        defaults: {
          format: 'srt',
          include_timestamps: true,
        },
      })

    const { result } = renderHook(() => useExportDefaults())
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await result.current.resetDefaults()
    })

    expect(deleteExportDefaultsMock).toHaveBeenCalledTimes(1)
    expect(fetchExportConfigMock).toHaveBeenCalledTimes(2)
    expect(result.current.defaults).toEqual({
      format: 'srt',
      include_timestamps: true,
    })
  })

  it('ignores stale bootstrap response when reset resolves newer defaults', async () => {
    const bootstrap = createDeferred<{
      defaults: {
        format: 'srt' | 'vtt' | 'txt' | 'ass'
        include_timestamps: boolean
      }
    }>()

    fetchExportConfigMock.mockReturnValueOnce(bootstrap.promise).mockResolvedValueOnce({
      defaults: {
        format: 'ass',
        include_timestamps: false,
      },
    })
    deleteExportDefaultsMock.mockResolvedValue(undefined)

    const { result } = renderHook(() => useExportDefaults())

    await act(async () => {
      await result.current.resetDefaults()
    })

    expect(result.current.defaults).toEqual({
      format: 'ass',
      include_timestamps: false,
    })

    await act(async () => {
      bootstrap.resolve({
        defaults: {
          format: 'vtt',
          include_timestamps: true,
        },
      })
      await Promise.resolve()
    })

    expect(result.current.defaults).toEqual({
      format: 'ass',
      include_timestamps: false,
    })
  })

  it('clears loading state when update defaults fails during bootstrap', async () => {
    const bootstrap = createDeferred<{
      defaults: {
        format: 'srt' | 'vtt' | 'txt' | 'ass'
        include_timestamps: boolean
      }
    }>()

    fetchExportConfigMock.mockReturnValueOnce(bootstrap.promise)
    patchExportDefaultsMock.mockRejectedValue(new Error('patch-failed'))

    const { result } = renderHook(() => useExportDefaults())

    await act(async () => {
      await expect(
        result.current.updateDefaults({
          format: 'ass',
          include_timestamps: false,
        }),
      ).rejects.toThrow('patch-failed')
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
  })

  it('clears loading state when reset defaults fails during bootstrap', async () => {
    const bootstrap = createDeferred<{
      defaults: {
        format: 'srt' | 'vtt' | 'txt' | 'ass'
        include_timestamps: boolean
      }
    }>()

    fetchExportConfigMock.mockReturnValueOnce(bootstrap.promise)
    deleteExportDefaultsMock.mockRejectedValue(new Error('delete-failed'))

    const { result } = renderHook(() => useExportDefaults())

    await act(async () => {
      await expect(result.current.resetDefaults()).rejects.toThrow('delete-failed')
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
  })
})
