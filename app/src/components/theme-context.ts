import { createContext } from 'react'

import type { UiTheme } from '@/config/ui-preferences'

export type ResolvedTheme = Exclude<UiTheme, 'system'>

export interface ThemeContextValue {
  resolvedTheme: ResolvedTheme
  setTheme: (theme: UiTheme) => void
  systemTheme: ResolvedTheme
  theme: UiTheme
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)
