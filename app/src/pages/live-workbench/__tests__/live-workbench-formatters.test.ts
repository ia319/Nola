import { describe, expect, it } from 'vitest'

import {
  formatLiveWorkbenchCount,
  formatLiveWorkbenchEmptyValue,
} from '../live-workbench-formatters'

describe('live workbench formatters', () => {
  it('formats empty values consistently', () => {
    expect(formatLiveWorkbenchEmptyValue()).toBe('-')
  })

  it('clamps count display at zero', () => {
    expect(formatLiveWorkbenchCount(3)).toBe('3')
    expect(formatLiveWorkbenchCount(-1)).toBe('0')
  })
})
