// @vitest-environment jsdom

import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { useUiPreferencesStore } from '@/app/locale/ui-preferences-store'
import { DEFAULT_UI_PREFERENCES } from '@/config/ui-preferences'
import { ThemeProvider } from '../theme-provider'
import { useTheme } from '../use-theme'

function ThemeProbe() {
  const { resolvedTheme, theme } = useTheme()

  return (
    <div>
      <span>{theme}</span>
      <span>{resolvedTheme}</span>
    </div>
  )
}

function installMatchMedia(initialMatches: boolean) {
  let matches = initialMatches
  const listeners = new Set<(event: { matches: boolean }) => void>()

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: () => ({
      get matches() {
        return matches
      },
      media: '(prefers-color-scheme: dark)',
      addEventListener: (_event: string, listener: (event: { matches: boolean }) => void) => {
        listeners.add(listener)
      },
      removeEventListener: (_event: string, listener: (event: { matches: boolean }) => void) => {
        listeners.delete(listener)
      },
    }),
  })

  return {
    setMatches(nextMatches: boolean) {
      matches = nextMatches
      for (const listener of listeners) {
        listener({ matches: nextMatches })
      }
    },
  }
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    useUiPreferencesStore.setState({
      preferences: DEFAULT_UI_PREFERENCES,
      isHydrated: true,
    })
    installMatchMedia(false)
    document.documentElement.className = ''
    document.documentElement.style.colorScheme = ''
  })

  it('applies the resolved theme class from the stored preference', () => {
    useUiPreferencesStore.setState((state) => ({
      ...state,
      preferences: {
        ...state.preferences,
        theme: 'dark',
      },
    }))

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    )

    expect(screen.getAllByText('dark')).toHaveLength(2)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.style.colorScheme).toBe('dark')
  })

  it('tracks system theme changes when the stored preference is system', () => {
    const media = installMatchMedia(false)

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    )

    expect(document.documentElement.classList.contains('light')).toBe(true)
    expect(document.documentElement.style.colorScheme).toBe('light')

    act(() => {
      media.setMatches(true)
    })

    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.style.colorScheme).toBe('dark')
  })
})
