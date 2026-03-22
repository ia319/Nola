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
})
