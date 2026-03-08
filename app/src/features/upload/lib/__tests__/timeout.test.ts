import { describe, expect, it } from 'vitest'

import { computeUploadTimeoutMs } from '../timeout'

describe('computeUploadTimeoutMs', () => {
  it('clamps very small files to the minimum timeout', () => {
    expect(computeUploadTimeoutMs(0)).toBe(30_000)
    expect(computeUploadTimeoutMs(512 * 1024)).toBe(30_000)
  })

  it('scales linearly for medium-sized files', () => {
    expect(computeUploadTimeoutMs(100 * 1024 * 1024)).toBe(260_000)
  })

  it('clamps very large files to the maximum timeout', () => {
    expect(computeUploadTimeoutMs(10 * 1024 * 1024 * 1024)).toBe(1_800_000)
  })
})
