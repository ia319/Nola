// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createSSEConnection, type SSEOptions, type SSEvent } from '@/shared/lib/sse-client'

import { cancelDownload, startDownload } from '../../api'
import type { ModelDownloadSSEPayload } from '../../types'
import { toDownloadState, useModelDownload } from '../useModelDownload'

vi.mock('../../api', () => ({
  startDownload: vi.fn(),
  cancelDownload: vi.fn(),
}))

vi.mock('@/shared/lib/sse-client', () => ({
  createSSEConnection: vi.fn(),
}))

const startDownloadMock = vi.mocked(startDownload)
const cancelDownloadMock = vi.mocked(cancelDownload)
const createSSEConnectionMock = vi.mocked(createSSEConnection)

let cleanupMock: ReturnType<typeof vi.fn>
let onProgressMessage: ((event: SSEvent<ModelDownloadSSEPayload>) => void) | null

beforeEach(() => {
  vi.clearAllMocks()
  cleanupMock = vi.fn()
  onProgressMessage = null
  createSSEConnectionMock.mockImplementation(((_path, options) => {
    onProgressMessage = options.onMessage as SSEOptions<ModelDownloadSSEPayload>['onMessage']
    return cleanupMock
  }) as typeof createSSEConnection)
})

describe('useModelDownload', () => {
  it('hydrates from list state and lets SSE updates override stale snapshots', async () => {
    const onTerminal = vi.fn()
    const initialDownloads = new Map([
      [
        'small',
        toDownloadState({
          percent: 25,
          downloaded_bytes: 250,
          total_bytes: 1_000,
          speed_bps: 50,
          error: null,
        }),
      ],
    ])

    const { result, rerender } = renderHook(({ seed }) => useModelDownload(seed, onTerminal), {
      initialProps: { seed: initialDownloads },
    })

    expect(createSSEConnectionMock).toHaveBeenCalledWith(
      '/api/models/events',
      expect.objectContaining({ eventNames: ['progress'] }),
    )
    expect(result.current.downloads.get('small')?.percent).toBe(25)

    act(() => {
      onProgressMessage?.({
        event: 'progress',
        data: {
          model_id: 'small',
          status: 'downloading',
          percent: 55,
          downloaded_bytes: 550,
          total_bytes: 1_000,
          speed_bps: 90,
          error: null,
        },
      })
    })

    expect(result.current.downloads.get('small')?.percent).toBe(55)

    rerender({
      seed: new Map([
        [
          'small',
          toDownloadState({
            percent: 30,
            downloaded_bytes: 300,
            total_bytes: 1_000,
            speed_bps: 10,
            error: null,
          }),
        ],
        [
          'large-v3',
          toDownloadState({
            percent: 10,
            downloaded_bytes: 100,
            total_bytes: 1_000,
            speed_bps: 20,
            error: null,
          }),
        ],
      ]),
    })

    expect(result.current.downloads.get('small')?.percent).toBe(55)
    expect(result.current.downloads.get('large-v3')?.percent).toBe(10)

    act(() => {
      onProgressMessage?.({
        event: 'progress',
        data: {
          model_id: 'small',
          status: 'completed',
          percent: 100,
          downloaded_bytes: 1_000,
          total_bytes: 1_000,
          speed_bps: 0,
          error: null,
        },
      })
    })

    await waitFor(() => {
      expect(onTerminal).toHaveBeenCalledTimes(1)
    })
    expect(result.current.downloads.has('small')).toBe(false)
    expect(result.current.downloads.get('large-v3')?.percent).toBe(10)
  })

  it('uses the start and cancel APIs without seeding fake zero progress', async () => {
    startDownloadMock.mockResolvedValue({
      model_id: 'small',
      status: 'downloading',
      message: 'started',
    })
    cancelDownloadMock.mockResolvedValue({
      model_id: 'small',
      message: 'cancelled',
    })

    const { result } = renderHook(() => useModelDownload(new Map()))

    await act(async () => {
      await result.current.download('small')
    })

    expect(startDownloadMock).toHaveBeenCalledWith('small')
    expect(result.current.downloads.size).toBe(0)

    await act(async () => {
      await result.current.cancel('small')
    })

    expect(cancelDownloadMock).toHaveBeenCalledWith('small')
  })

  it('closes the SSE connection on unmount', () => {
    const { unmount } = renderHook(() => useModelDownload(new Map()))

    unmount()

    expect(cleanupMock).toHaveBeenCalledTimes(1)
  })
})
