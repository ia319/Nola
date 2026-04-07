import { describe, expect, it } from 'vitest'

import { BREAKPOINTS, resolveBreakpoint } from '../breakpoints'

describe('resolveBreakpoint', () => {
  it('returns sm below the md threshold', () => {
    expect(resolveBreakpoint(BREAKPOINTS.md - 1)).toBe('sm')
  })

  it('returns md between md and lg thresholds', () => {
    expect(resolveBreakpoint(BREAKPOINTS.md)).toBe('md')
    expect(resolveBreakpoint(BREAKPOINTS.lg - 1)).toBe('md')
  })

  it('returns lg at and above the lg threshold', () => {
    expect(resolveBreakpoint(BREAKPOINTS.lg)).toBe('lg')
    expect(resolveBreakpoint(BREAKPOINTS.lg + 320)).toBe('lg')
  })
})
