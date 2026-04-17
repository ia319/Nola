import type { TFunction } from 'i18next'
import { describe, expect, it } from 'vitest'

import {
  formatBytes,
  formatMegabytes,
  formatMegabytesPerSecond,
  formatPercent,
  formatSpeed,
  getModelActionState,
  resolveModelDescription,
  sortModelsForDisplay,
  splitModelLanguages,
} from '../model-helpers'

describe('model helpers', () => {
  it('formats sizes, speeds, and percentages', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(-1)).toBe('0 B')
    expect(formatBytes(Number.NaN)).toBe('0 B')
    expect(formatBytes(1_536)).toBe('1.5 KB')
    expect(formatMegabytes(0)).toBe('0.0 MB')
    expect(formatMegabytes(1_536)).toBe('0.0 MB')
    expect(formatSpeed(2_048)).toBe('2.0 KB/s')
    expect(formatMegabytesPerSecond(2_048)).toBe('0.0 MB/s')
    expect(formatPercent(12.34)).toBe('12.3%')
  })

  it('sorts configured models first, then by accuracy, then by size', () => {
    const models = [
      { model_id: 'base', is_configured: false, accuracy_rank: 1, size_bytes: 100 },
      { model_id: 'large', is_configured: false, accuracy_rank: 3, size_bytes: 500 },
      { model_id: 'small', is_configured: true, accuracy_rank: 2, size_bytes: 200 },
      { model_id: 'medium', is_configured: false, accuracy_rank: 3, size_bytes: 300 },
    ] as const

    expect(sortModelsForDisplay(models).map((model) => model.model_id)).toEqual([
      'small',
      'medium',
      'large',
      'base',
    ])
  })

  it('derives shared action state from cache and live download status', () => {
    expect(
      getModelActionState({
        status: 'downloaded',
      }),
    ).toMatchObject({
      status: 'downloaded',
      isDownloading: false,
      isDownloaded: true,
      isPartialDownload: false,
      canDownload: false,
      canDelete: true,
    })

    expect(
      getModelActionState(
        {
          status: 'partial_download',
        },
        {
          status: 'downloading',
          percent: 12,
          downloadedBytes: 12,
          totalBytes: 100,
          speedBps: 1,
          error: null,
        },
      ),
    ).toMatchObject({
      status: 'downloading',
      hasLiveDownload: true,
      isDownloading: true,
      isDownloaded: false,
      isPartialDownload: false,
      canDownload: false,
      canDelete: false,
    })
  })

  it('splits language strings into stable tokens', () => {
    expect(splitModelLanguages('en, zh, multilingual ')).toEqual(['en', 'zh', 'multilingual'])
    expect(splitModelLanguages('')).toEqual([])
  })

  it('prefers translated catalog copy and falls back to backend text', () => {
    const t = ((key: string) =>
      key == 'models.catalog.largeV3.description' ? 'Localized description' : key) as TFunction

    expect(
      resolveModelDescription(t, {
        description: 'Fallback description',
        description_key: 'models.catalog.largeV3.description',
      }),
    ).toBe('Localized description')

    expect(
      resolveModelDescription(t, {
        description: 'Fallback description',
        description_key: 'models.catalog.unknown.description',
      }),
    ).toBe('Fallback description')
  })
})
