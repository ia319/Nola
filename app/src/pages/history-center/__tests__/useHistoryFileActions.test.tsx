// @vitest-environment jsdom

import { createElement, type PropsWithChildren } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const historyFileActionMocks = vi.hoisted(() => ({
  logger: {
    error: vi.fn(),
  },
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
  deleteFile: vi.fn(),
  requestTaskRefresh: vi.fn(),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (key === 'history.files.toast.deleted') {
        return `File deleted: ${String(params?.filename)}`
      }

      if (key === 'history.files.toast.deleteFailed') {
        return 'File delete failed, please retry'
      }

      return key
    },
  }),
}))

vi.mock('sonner', () => ({
  toast: historyFileActionMocks.toast,
}))

vi.mock('@/config/logger', () => ({
  default: historyFileActionMocks.logger,
}))

vi.mock('@/features/tasks', () => ({
  requestTaskRefresh: historyFileActionMocks.requestTaskRefresh,
}))

vi.mock('@/features/upload/api', () => ({
  deleteFile: historyFileActionMocks.deleteFile,
}))

import { queryKeys } from '@/shared/lib/query-keys'
import { useHistoryFileActions } from '../useHistoryFileActions'

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

describe('useHistoryFileActions', () => {
  beforeEach(() => {
    historyFileActionMocks.logger.error.mockReset()
    historyFileActionMocks.toast.success.mockReset()
    historyFileActionMocks.toast.error.mockReset()
    historyFileActionMocks.deleteFile.mockReset()
    historyFileActionMocks.requestTaskRefresh.mockReset()
  })

  it('refreshes related history queries after a successful delete', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries')
    historyFileActionMocks.deleteFile.mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => useHistoryFileActions(), {
      wrapper: createWrapper(queryClient),
    })

    await act(async () => {
      await result.current.deleteHistoryFile({
        file_id: 'file-0',
        filename: 'meeting.wav',
        size: 4096,
        content_type: 'audio/wav',
        created_at: '2026-04-12T09:00:00.000Z',
      })
    })

    expect(historyFileActionMocks.requestTaskRefresh).toHaveBeenCalledTimes(1)
    expect(invalidateQueriesSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: queryKeys.files.lists() }),
    )
    expect(invalidateQueriesSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: queryKeys.files.details() }),
    )
    expect(invalidateQueriesSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: queryKeys.tasks.lists() }),
    )
    expect(historyFileActionMocks.toast.success).toHaveBeenCalledWith('File deleted: meeting.wav')
  })

  it('logs delete failures before showing the generic file delete toast', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    historyFileActionMocks.deleteFile.mockRejectedValueOnce(new Error('delete failed'))

    const { result } = renderHook(() => useHistoryFileActions(), {
      wrapper: createWrapper(queryClient),
    })

    await expect(
      result.current.deleteHistoryFile({
        file_id: 'file-1',
        filename: 'archive.wav',
        size: 1024,
        content_type: 'audio/wav',
        created_at: '2026-04-12T10:00:00.000Z',
      }),
    ).rejects.toThrow('delete failed')

    await waitFor(() => {
      expect(historyFileActionMocks.logger.error).toHaveBeenCalledWith(
        'history.deleteFileFailed',
        expect.objectContaining({
          error: expect.any(Error),
          fileId: 'file-1',
        }),
      )
    })
    expect(historyFileActionMocks.toast.error).toHaveBeenCalledWith(
      'File delete failed, please retry',
    )
  })

  it('clears the deleting state after the mutation settles', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    let resolveDelete: (() => void) | null = null
    historyFileActionMocks.deleteFile.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveDelete = () => resolve(undefined)
        }),
    )

    const { result } = renderHook(() => useHistoryFileActions(), {
      wrapper: createWrapper(queryClient),
    })

    let deletePromise: Promise<void> = Promise.resolve()
    act(() => {
      deletePromise = result.current.deleteHistoryFile({
        file_id: 'file-2',
        filename: 'briefing.wav',
        size: 2048,
        content_type: 'audio/wav',
        created_at: '2026-04-12T11:00:00.000Z',
      })
    })

    await waitFor(() => {
      expect(result.current.deletingFileId).toBe('file-2')
    })

    await act(async () => {
      resolveDelete?.()
      await deletePromise
    })

    expect(result.current.deletingFileId).toBeNull()
  })
})
