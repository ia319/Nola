// @vitest-environment jsdom

import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ThemeProvider } from '../theme-provider'

const nextThemesMocks = vi.hoisted(() => ({
  themeProvider: vi.fn(({ children }: { children: ReactNode }) => (
    <div data-slot="next-themes-provider">{children}</div>
  )),
}))

vi.mock('next-themes', () => ({
  ThemeProvider: nextThemesMocks.themeProvider,
}))

describe('ThemeProvider', () => {
  it('applies the shared theme defaults for the whole app shell', () => {
    render(
      <ThemeProvider>
        <div>Theme content</div>
      </ThemeProvider>,
    )

    expect(screen.getByText('Theme content')).toBeTruthy()
    expect(nextThemesMocks.themeProvider).toHaveBeenCalledTimes(1)
    expect(nextThemesMocks.themeProvider.mock.calls[0]?.[0]).toMatchObject({
      attribute: 'class',
      defaultTheme: 'system',
      enableSystem: true,
      storageKey: 'nola-theme',
      disableTransitionOnChange: true,
    })
  })
})
