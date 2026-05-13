// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { UseExportDefaultsResult } from '@/features/export/hooks/useExportDefaults'
import type * as ExportFeatureModule from '@/features/export'
import type { LiveSessionSummary } from '@/shared/types'
import { useHistoryLiveExportDialog } from '../useHistoryLiveExportDialog'

const historyLiveExportDialogMocks = vi.hoisted(() => ({
  clearSelection: vi.fn(),
  onExportLiveSession: vi.fn(),
  refreshDefaults: vi.fn<UseExportDefaultsResult['refresh']>(),
  resetDefaults: vi.fn<UseExportDefaultsResult['resetDefaults']>(),
  updateDefaults: vi.fn<UseExportDefaultsResult['updateDefaults']>(),
  useExportDefaults: vi.fn<() => UseExportDefaultsResult>(),
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
  },
}))

vi.mock('@/features/export', async () => {
  const actual = await vi.importActual<typeof ExportFeatureModule>('@/features/export')

  return {
    ...actual,
    useExportDefaults: historyLiveExportDialogMocks.useExportDefaults,
  }
})

function createLiveSession(overrides: Partial<LiveSessionSummary> = {}): LiveSessionSummary {
  return {
    audio_format: null,
    created_at: '2026-01-01T00:00:00Z',
    ended_at: '2026-01-01T00:01:00Z',
    error: null,
    language_hint: null,
    mode: 'streaming',
    model_id: null,
    runtime: 'mock',
    session_id: 'live-session-1',
    started_at: '2026-01-01T00:00:00Z',
    status: 'finished',
    title: 'Live Session',
    updated_at: '2026-01-01T00:01:00Z',
    ...overrides,
  }
}

describe('useHistoryLiveExportDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    historyLiveExportDialogMocks.useExportDefaults.mockReturnValue({
      defaults: {
        format: 'srt',
        include_timestamps: true,
      },
      isLoading: false,
      refresh: historyLiveExportDialogMocks.refreshDefaults,
      resetDefaults: historyLiveExportDialogMocks.resetDefaults,
      updateDefaults: historyLiveExportDialogMocks.updateDefaults,
    })
  })

  it('ignores duplicate live export confirmations while a request is pending', async () => {
    let resolveExport: (value: { mode: 'download' }) => void = () => {}
    const pendingExport = new Promise<{ mode: 'download' }>((resolve) => {
      resolveExport = resolve
    })
    historyLiveExportDialogMocks.onExportLiveSession.mockReturnValue(pendingExport)

    const { result } = renderHook(() =>
      useHistoryLiveExportDialog({
        clearSelection: historyLiveExportDialogMocks.clearSelection,
        onExportLiveSession: historyLiveExportDialogMocks.onExportLiveSession,
      }),
    )

    await act(async () => {
      await result.current.openSingleExportDialog(createLiveSession())
    })

    let firstConfirmation: Promise<void> | undefined
    let secondConfirmation: Promise<void> | undefined
    act(() => {
      firstConfirmation = result.current.confirmExport()
      secondConfirmation = result.current.confirmExport()
    })

    expect(historyLiveExportDialogMocks.onExportLiveSession).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveExport({ mode: 'download' })
      await firstConfirmation
      await secondConfirmation
    })
  })
})
