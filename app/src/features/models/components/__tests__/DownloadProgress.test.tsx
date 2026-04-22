// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { DownloadState } from '@/features/models/hooks/useModelDownload'

import { DownloadProgress } from '../DownloadProgress'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => String(params?.defaultValue ?? key),
  }),
}))

function createState(overrides: Partial<DownloadState> = {}): DownloadState {
  return {
    status: 'downloading',
    percent: 42.5,
    downloadedBytes: 1_250_000_000,
    totalBytes: 3_100_000_000,
    speedBps: 35_000_000,
    error: null,
    ...overrides,
  }
}

describe('DownloadProgress', () => {
  it('falls back to the downloading label when speed is zero', () => {
    render(<DownloadProgress state={createState({ speedBps: 0 })} />)

    expect(screen.getByText('models.actions.downloading')).toBeTruthy()
  })
})
