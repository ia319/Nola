export const BREAKPOINTS = {
  sm: 0,
  md: 768,
  lg: 1024,
} as const

export type Breakpoint = keyof typeof BREAKPOINTS

export const DEFAULT_BREAKPOINT: Breakpoint = 'lg'

/**
 * Resolve width into the shared three-tier breakpoint contract so shell and
 * page widgets make the same structural decisions.
 *
 * @param width Current viewport width in CSS pixels.
 * @returns The active breakpoint bucket.
 */
export function resolveBreakpoint(width: number): Breakpoint {
  if (width >= BREAKPOINTS.lg) return 'lg'
  if (width >= BREAKPOINTS.md) return 'md'
  return 'sm'
}
