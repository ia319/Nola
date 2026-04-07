import { useBreakpoint } from './useBreakpoint'

export type ViewMode = 'desktop' | 'tablet' | 'mobile'

/**
 * Map the low-level breakpoint bucket into the higher-level view mode used by
 * layout components and page widgets.
 *
 * @returns The current view mode contract for structural UI decisions.
 */
export function useViewMode(): ViewMode {
  const breakpoint = useBreakpoint()

  if (breakpoint === 'lg') return 'desktop'
  if (breakpoint === 'md') return 'tablet'
  return 'mobile'
}
