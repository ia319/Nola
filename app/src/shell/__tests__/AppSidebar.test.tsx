// @vitest-environment jsdom

import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useUiPreferencesStore } from '@/app/locale/ui-preferences-store'
import { DEFAULT_UI_PREFERENCES } from '@/config/ui-preferences'
import { AppSidebar } from '../AppSidebar'

const sidebarMocks = vi.hoisted(() => ({
  breakpoint: 'lg' as 'lg' | 'md' | 'sm',
  pathname: '/',
}))

vi.mock('@/shared/responsive', () => ({
  useBreakpoint: () => sidebarMocks.breakpoint,
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      (
        ({
          'shell.navigation.label': 'Primary navigation',
          'shell.navigation.tasks': 'Tasks',
          'shell.navigation.live': 'Live',
          'shell.navigation.history': 'History',
          'shell.navigation.models': 'Models',
          'shell.navigation.settings': 'Settings',
        }) as const
      )[key] ?? key,
  }),
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    className,
    children,
    ...props
  }: {
    to: string
    className?: string
    children: ReactNode
  }) => (
    <a href={to} className={className} {...props}>
      {children}
    </a>
  ),
  useLocation: ({ select }: { select?: (location: { pathname: string }) => string } = {}) =>
    select ? select({ pathname: sidebarMocks.pathname }) : { pathname: sidebarMocks.pathname },
}))

describe('AppSidebar', () => {
  beforeEach(() => {
    useUiPreferencesStore.setState({
      preferences: DEFAULT_UI_PREFERENCES,
      isHydrated: true,
    })
    sidebarMocks.breakpoint = 'lg'
    sidebarMocks.pathname = '/'
  })

  it('renders the desktop sidebar with the planned navigation items', () => {
    render(<AppSidebar />)

    const sidebar = screen.getByText('Nola').closest('[data-slot="app-sidebar"]')
    expect(sidebar).toHaveAttribute('data-breakpoint', 'lg')
    expect(sidebar).toHaveStyle({ width: 'var(--sidebar-width)' })
    expect(screen.getByText('v3.0')).toBeTruthy()
    expect(screen.getByRole('navigation', { name: 'Primary navigation' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Tasks' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Live' })).toHaveAttribute('href', '/live')
    expect(screen.getByRole('link', { name: 'History' })).toHaveAttribute('href', '/history')
    expect(screen.getByRole('link', { name: 'Models' })).toHaveAttribute('href', '/models')
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings')
    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Tasks',
      'Live',
      'History',
      'Models',
      'Settings',
    ])
  })

  it('highlights the active destination from the current path', () => {
    sidebarMocks.pathname = '/live/session'

    render(<AppSidebar />)

    expect(screen.getByRole('link', { name: 'Live' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Live' })).toHaveClass('bg-sidebar-accent')
    expect(screen.getByRole('link', { name: 'Live' })).toHaveClass('font-semibold')
  })

  it.each(['sm', 'md'] as const)(
    'does not render the desktop sidebar at the %s breakpoint',
    (breakpoint) => {
      sidebarMocks.breakpoint = breakpoint

      render(<AppSidebar />)

      expect(screen.queryByText('Nola')).toBeNull()
    },
  )
})
