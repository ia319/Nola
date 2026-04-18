// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
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

describe('ThemeProvider', () => {
  beforeEach(() => {
    useUiPreferencesStore.setState({
      preferences: DEFAULT_UI_PREFERENCES,
      isHydrated: true,
    })
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: () => ({
        matches: false,
        media: '(prefers-color-scheme: dark)',
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }),
    })
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
})
