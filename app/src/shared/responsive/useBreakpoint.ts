import { useEffect, useState } from 'react'

import { BREAKPOINTS, DEFAULT_BREAKPOINT, type Breakpoint, resolveBreakpoint } from './breakpoints'

type MediaQueryListener = (event: MediaQueryListEvent) => void

type LegacyMediaQueryList = MediaQueryList & {
  addListener?: (listener: MediaQueryListener) => void
  removeListener?: (listener: MediaQueryListener) => void
}

function getCurrentBreakpoint(): Breakpoint {
  if (typeof window === 'undefined') return DEFAULT_BREAKPOINT
  return resolveBreakpoint(window.innerWidth)
}

function subscribe(queryList: LegacyMediaQueryList, listener: MediaQueryListener): () => void {
  if (typeof queryList.addEventListener === 'function') {
    queryList.addEventListener('change', listener)
    return () => queryList.removeEventListener('change', listener)
  }

  queryList.addListener?.(listener)
  return () => queryList.removeListener?.(listener)
}

/**
 * Subscribe to breakpoint threshold changes via matchMedia so components only
 * rerender when the active width bucket changes.
 *
 * @returns The currently active shared breakpoint.
 */
export function useBreakpoint(): Breakpoint {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>(() => getCurrentBreakpoint())

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const handleChange = (): void => {
      setBreakpoint(getCurrentBreakpoint())
    }

    const mdQuery = window.matchMedia(`(min-width: ${BREAKPOINTS.md}px)`)
    const lgQuery = window.matchMedia(`(min-width: ${BREAKPOINTS.lg}px)`)

    const unsubscribeMd = subscribe(mdQuery, handleChange)
    const unsubscribeLg = subscribe(lgQuery, handleChange)

    handleChange()

    return () => {
      unsubscribeMd()
      unsubscribeLg()
    }
  }, [])

  return breakpoint
}
