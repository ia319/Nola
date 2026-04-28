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
