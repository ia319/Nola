import { describe, expect, it } from 'vitest'

import { formatMillisecondsClock, formatMillisecondsClockRange } from '../time-format'

describe('time format helpers', () => {
  it('formats milliseconds as a fixed clock value', () => {
    expect(formatMillisecondsClock(92_125)).toBe('00:01:32.125')
    expect(formatMillisecondsClock(3_661_005)).toBe('01:01:01.005')
  })

  it('formats milliseconds as a fixed clock range', () => {
    expect(formatMillisecondsClockRange(92_125, 96_870)).toBe('00:01:32.125 - 00:01:36.870')
  })

  it('clamps invalid or negative values to zero', () => {
    expect(formatMillisecondsClock(-1)).toBe('00:00:00.000')
    expect(formatMillisecondsClock(Number.NaN)).toBe('00:00:00.000')
  })
})
