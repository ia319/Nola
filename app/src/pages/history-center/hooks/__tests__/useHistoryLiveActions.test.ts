// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  batchDeleteLiveSessionRecords,
  batchExportLiveSessions,
  deleteLiveSessionRecord,
  downloadLiveSessionExport,
  saveLiveSessionExport,
} from '@/features/realtime/api'
import { downloadBlob } from '@/shared/lib/utils'
import { useHistoryLiveActions } from '../useHistoryLiveActions'
import { toast } from 'sonner'

vi.mock('@/features/realtime/api', () => ({
  batchDeleteLiveSessionRecords: vi.fn(),
  batchExportLiveSessions: vi.fn(),
  deleteLiveSessionRecord: vi.fn(),
  downloadLiveSessionExport: vi.fn(),
  saveLiveSessionExport: vi.fn(),
}))

vi.mock('@/shared/lib/utils', () => ({
  downloadBlob: vi.fn(),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}))

const batchDeleteLiveMock = vi.mocked(batchDeleteLiveSessionRecords)
const batchExportLiveMock = vi.mocked(batchExportLiveSessions)
const deleteLiveMock = vi.mocked(deleteLiveSessionRecord)
const downloadLiveMock = vi.mocked(downloadLiveSessionExport)
const saveLiveMock = vi.mocked(saveLiveSessionExport)
const downloadBlobMock = vi.mocked(downloadBlob)

afterEach(() => {
  vi.clearAllMocks()
})

describe('useHistoryLiveActions', () => {
  it('exports one live session with a downloaded file', async () => {
    const blob = new Blob(['srt-content'], { type: 'application/x-subrip' })
    downloadLiveMock.mockResolvedValue({
      blob,
      filename: null,
    })

    const { result } = renderHook(() =>
      useHistoryLiveActions({
        refresh: vi.fn().mockResolvedValue(undefined),
      }),
    )

    await act(async () => {
      await result.current.exportLiveSession(
        {
          session_id: 'live-1',
          title: 'Daily review',
        },
        {
          filename: 'custom-live',
          format: 'srt',
          include_timestamps: true,
        },
      )
    })

    expect(downloadLiveMock).toHaveBeenCalledWith('live-1', {
      filename: 'custom-live',
      format: 'srt',
      include_timestamps: true,
    })
    expect(downloadBlobMock).toHaveBeenCalledWith(blob, 'custom-live.srt')
    expect(toast.success).toHaveBeenCalledWith('history.live.toast.export.one')
  })

  it('saves one live session export to the server', async () => {
    saveLiveMock.mockResolvedValue({
      saved_path: 'exports/live-1.txt',
    })

    const { result } = renderHook(() =>
      useHistoryLiveActions({
        refresh: vi.fn().mockResolvedValue(undefined),
      }),
    )

    await act(async () => {
      const response = await result.current.exportLiveSession(
        {
          session_id: 'live-1',
          title: null,
        },
        {
          format: 'txt',
          include_timestamps: false,
          target: 'save',
        },
      )

      expect(response).toEqual({
        mode: 'save',
        savedPath: 'exports/live-1.txt',
      })
    })

    expect(saveLiveMock).toHaveBeenCalledWith('live-1', {
      format: 'txt',
      include_timestamps: false,
    })
    expect(downloadBlobMock).not.toHaveBeenCalled()
  })

  it('exports selected live sessions as a zip', async () => {
    const blob = new Blob(['zip-content'], { type: 'application/zip' })
    batchExportLiveMock.mockResolvedValue({
      blob,
      filename: 'live.zip',
    })

    const { result } = renderHook(() =>
      useHistoryLiveActions({
        refresh: vi.fn().mockResolvedValue(undefined),
      }),
    )

    await act(async () => {
      await result.current.exportLiveSessions(['live-1', 'live-2', 'live-1'], {
        format: 'srt',
        include_timestamps: true,
        zip_name: '  live-archive  ',
      })
    })

    expect(batchExportLiveMock).toHaveBeenCalledWith({
      format: 'srt',
      include_timestamps: true,
      session_ids: ['live-1', 'live-2'],
      zip_name: 'live-archive',
    })
    expect(downloadBlobMock).toHaveBeenCalledWith(blob, 'live.zip')
    expect(toast.success).toHaveBeenCalledWith('history.live.toast.batchExport.success')
  })

  it('deletes one live session and refreshes history', async () => {
    const refresh = vi.fn().mockResolvedValue(undefined)
    deleteLiveMock.mockResolvedValue({
      message: 'Live session record deleted',
      session_id: 'live-1',
    })

    const { result } = renderHook(() =>
      useHistoryLiveActions({
        refresh,
      }),
    )

    await act(async () => {
      await result.current.deleteLiveSession({ session_id: 'live-1' })
    })

    expect(deleteLiveMock).toHaveBeenCalledWith('live-1')
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(toast.success).toHaveBeenCalledWith('history.live.toast.deleted')
  })

  it('deletes selected live sessions with summary toast', async () => {
    const refresh = vi.fn().mockResolvedValue(undefined)
    batchDeleteLiveMock.mockResolvedValue({
      action: 'delete_record',
      results: [],
      summary: {
        failed: 0,
        requested: 2,
        succeeded: 2,
      },
    })

    const { result } = renderHook(() =>
      useHistoryLiveActions({
        refresh,
      }),
    )

    await act(async () => {
      await result.current.deleteLiveSessions(['live-1', 'live-2', 'live-1'])
    })

    expect(batchDeleteLiveMock).toHaveBeenCalledWith({
      session_ids: ['live-1', 'live-2'],
    })
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(toast.success).toHaveBeenCalledWith('history.live.toast.batchDelete.success')
  })
})
