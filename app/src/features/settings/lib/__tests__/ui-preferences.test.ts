// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'

import { normalizeUiLanguage } from '@/config/ui-preferences'
import { buildTimezoneLabel, formatUtcOffset } from '../ui-preferences'

describe('ui-preferences', () => {
  it('normalizes supported language tags to the bundled locale keys', () => {
    expect(normalizeUiLanguage('en-US')).toBe('en')
    expect(normalizeUiLanguage('zh_CN')).toBe('zh')
    expect(normalizeUiLanguage('fr-FR')).toBeNull()
  })

  it('formats the local timezone label with an explicit UTC offset', () => {
    expect(formatUtcOffset(480)).toBe('UTC+08:00')
    expect(formatUtcOffset(-90)).toBe('UTC-01:30')
    expect(buildTimezoneLabel('Asia/Singapore', 480)).toBe('UTC+08:00 (Asia/Singapore)')
  })
})
