import type { Preview } from '@storybook/react-vite'
import { createElement, useEffect, type ReactNode } from 'react'

import '../src/index.css'

type StorybookTheme = 'light' | 'dark'

type StorybookGlobals = {
  theme?: unknown
  backgrounds?: unknown
}

function applyDocumentTheme(theme: StorybookTheme): void {
  if (typeof document === 'undefined') {
    return
  }

  document.documentElement.classList.remove('light', 'dark')
  document.documentElement.classList.add(theme)
  document.documentElement.style.colorScheme = theme
}

function resolveBackgroundTheme(backgrounds: unknown): StorybookTheme | null {
  if (!backgrounds || typeof backgrounds !== 'object' || !('value' in backgrounds)) {
    return null
  }

  const value = (backgrounds as { value?: unknown }).value
  if (typeof value !== 'string') {
    return null
  }

  return value.toLowerCase().includes('dark') ? 'dark' : 'light'
}

function resolveStorybookTheme(globals: StorybookGlobals): StorybookTheme {
  if (globals.theme === 'dark' || globals.theme === 'light') {
    return globals.theme
  }

  return resolveBackgroundTheme(globals.backgrounds) ?? 'light'
}

function StorybookThemeBridge({ children, theme }: { children: ReactNode; theme: StorybookTheme }) {
  useEffect(() => {
    applyDocumentTheme(theme)
  }, [theme])

  return children
}

const preview: Preview = {
  globalTypes: {
    theme: {
      description: 'Nola theme',
      toolbar: {
        title: 'Theme',
        icon: 'circlehollow',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    theme: 'light',
  },
  decorators: [
    (Story, context) => {
      const theme = resolveStorybookTheme(context.globals as StorybookGlobals)
      applyDocumentTheme(theme)

      return createElement(StorybookThemeBridge, { theme }, Story())
    },
  ],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
}

export default preview
