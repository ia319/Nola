import { describe, expect, it } from 'vitest'

import {
  formatLiveWorkbenchCount,
  formatLiveWorkbenchDuration,
  formatLiveWorkbenchEmptyValue,
  formatLiveWorkbenchTranscriptTimeRange,
} from '../live-workbench-formatters'

describe('live workbench formatters', () => {
  it('formats empty values consistently', () => {
    expect(formatLiveWorkbenchEmptyValue()).toBe('-')
  })

  it('clamps count display at zero', () => {
    expect(formatLiveWorkbenchCount(3)).toBe('3')
    expect(formatLiveWorkbenchCount(-1)).toBe('0')
  })

  it('formats live transcript time ranges with millisecond precision', () => {
    expect(formatLiveWorkbenchTranscriptTimeRange(92_125, 96_870)).toBe(
      '00:01:32.125 - 00:01:36.870',
    )
    expect(formatLiveWorkbenchTranscriptTimeRange(3_661_005, 3_662_009)).toBe(
      '01:01:01.005 - 01:01:02.009',
    )
  })

  it('formats live session durations with millisecond precision', () => {
    expect(
      formatLiveWorkbenchDuration(
        '2026-05-11T00:00:00.125Z',
        '2026-05-11T00:00:47.789Z',
        Date.parse('2026-05-11T00:00:47.789Z'),
      ),
    ).toBe('00:00:47.664')

    expect(
      formatLiveWorkbenchDuration(
        '2026-05-11T00:00:00.000Z',
        null,
        Date.parse('2026-05-11T01:01:01.005Z'),
      ),
    ).toBe('01:01:01.005')
  })
})
