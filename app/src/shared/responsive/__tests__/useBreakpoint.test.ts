// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useBreakpoint } from '../useBreakpoint'
import { useViewMode } from '../useViewMode'

type MatchMediaController = {
  setWidth: (width: number) => void
  restore: () => void
}

type MediaQueryListener = (event: MediaQueryListEvent) => void

type MockQueryList = MediaQueryList & {
  __notify: (matches: boolean) => void
}

function evaluateQuery(query: string, width: number): boolean {
  const match = query.match(/min-width:\s*(\d+)px/)
  if (!match) return false
  return width >= Number(match[1])
}

function installMatchMedia(initialWidth: number): MatchMediaController {
  let width = initialWidth
  const originalMatchMedia = window.matchMedia
  const originalInnerWidth = window.innerWidth
  const queries = new Set<MockQueryList>()

  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: width,
    writable: true,
  })

  window.matchMedia = vi.fn((query: string) => {
    const listeners = new Set<MediaQueryListener>()
    let matches = evaluateQuery(query, width)

    const mediaQueryList = {
      media: query,
      onchange: null,
      addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
        listeners.add(listener as MediaQueryListener)
      },
      removeEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
        listeners.delete(listener as MediaQueryListener)
      },
      addListener: (listener: MediaQueryListener) => {
        listeners.add(listener)
      },
      removeListener: (listener: MediaQueryListener) => {
        listeners.delete(listener)
      },
      dispatchEvent: () => true,
      __notify: (nextMatches: boolean) => {
        if (matches === nextMatches) return
        matches = nextMatches
        const event = { matches: nextMatches, media: query } as MediaQueryListEvent
        for (const listener of listeners) listener(event)
      },
    } as unknown as MockQueryList

    Object.defineProperty(mediaQueryList, 'matches', {
      configurable: true,
      enumerable: true,
      get: () => matches,
    })

    queries.add(mediaQueryList)
    return mediaQueryList
  }) as typeof window.matchMedia

  return {
    setWidth(nextWidth: number) {
      width = nextWidth
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        value: width,
        writable: true,
      })

      for (const query of queries) {
        query.__notify(evaluateQuery(query.media, width))
      }
    },
    restore() {
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        value: originalInnerWidth,
        writable: true,
      })
      window.matchMedia = originalMatchMedia
    },
  }
}

describe('useBreakpoint', () => {
  let controller: MatchMediaController | null = null

  beforeEach(() => {
    controller = installMatchMedia(640)
  })

  afterEach(() => {
    controller?.restore()
    controller = null
  })

  it('reads the initial breakpoint from the current viewport width', () => {
    const { result } = renderHook(() => useBreakpoint())
    expect(result.current).toBe('sm')
  })

  it('updates when the viewport crosses breakpoint thresholds', () => {
    const { result } = renderHook(() => useBreakpoint())

    act(() => {
      controller?.setWidth(768)
    })
    expect(result.current).toBe('md')

    act(() => {
      controller?.setWidth(1280)
    })
    expect(result.current).toBe('lg')

    act(() => {
      controller?.setWidth(767)
    })
    expect(result.current).toBe('sm')
  })
})

describe('useViewMode', () => {
  let controller: MatchMediaController | null = null

  beforeEach(() => {
    controller = installMatchMedia(1024)
  })

  afterEach(() => {
    controller?.restore()
    controller = null
  })

  it('maps breakpoints to the expected structural view modes', () => {
    const { result } = renderHook(() => useViewMode())
    expect(result.current).toBe('desktop')

    act(() => {
      controller?.setWidth(900)
    })
    expect(result.current).toBe('tablet')

    act(() => {
      controller?.setWidth(480)
    })
    expect(result.current).toBe('mobile')
  })
})
