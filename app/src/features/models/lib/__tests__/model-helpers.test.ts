import { describe, expect, it } from 'vitest'

import { formatBytes, formatPercent, formatSpeed, sortModelsForDisplay } from '../model-helpers'

describe('model helpers', () => {
  it('formats sizes, speeds, and percentages', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(1_536)).toBe('1.5 KB')
    expect(formatSpeed(2_048)).toBe('2.0 KB/s')
    expect(formatPercent(12.34)).toBe('12.3%')
  })

  it('sorts configured models first, then by accuracy, then by size', () => {
    const models = [
      { model_id: 'base', is_configured: false, accuracy_rank: 1, size_bytes: 100 },
      { model_id: 'large', is_configured: false, accuracy_rank: 3, size_bytes: 500 },
      { model_id: 'small', is_configured: true, accuracy_rank: 2, size_bytes: 200 },
      { model_id: 'medium', is_configured: false, accuracy_rank: 3, size_bytes: 300 },
    ]

    expect(sortModelsForDisplay(models).map((model) => model.model_id)).toEqual([
      'small',
      'medium',
      'large',
      'base',
    ])
  })
})
