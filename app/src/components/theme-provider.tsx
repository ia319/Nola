import { useEffect, useMemo, useState, type PropsWithChildren } from 'react'

import { useUiPreferencesStore } from '@/app/locale/ui-preferences-store'
import { ThemeContext, type ResolvedTheme, type ThemeContextValue } from './theme-context'

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light'
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyDocumentTheme(theme: ResolvedTheme): void {
  if (typeof document === 'undefined') {
    return
  }

  document.documentElement.classList.remove('light', 'dark')
  document.documentElement.classList.add(theme)
  document.documentElement.style.colorScheme = theme
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const theme = useUiPreferencesStore((state) => state.preferences.theme)
  const persistTheme = useUiPreferencesStore((state) => state.setTheme)
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() => getSystemTheme())
  const resolvedTheme: ResolvedTheme = theme === 'system' ? systemTheme : theme

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const syncSystemTheme = (event?: MediaQueryListEvent) => {
      setSystemTheme((event?.matches ?? mediaQuery.matches) ? 'dark' : 'light')
    }

    syncSystemTheme()
    mediaQuery.addEventListener('change', syncSystemTheme)
    return () => {
      mediaQuery.removeEventListener('change', syncSystemTheme)
    }
  }, [])

  useEffect(() => {
    applyDocumentTheme(resolvedTheme)
  }, [resolvedTheme])

  const value = useMemo<ThemeContextValue>(() => {
    return {
      resolvedTheme,
      setTheme: (nextTheme) => {
        void persistTheme(nextTheme)
      },
      systemTheme,
      theme,
    }
  }, [persistTheme, resolvedTheme, systemTheme, theme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
