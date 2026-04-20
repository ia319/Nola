// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AppTopBar } from '../AppTopBar'

const topBarMocks = vi.hoisted(() => ({
  breakpoint: 'lg' as 'lg' | 'md' | 'sm',
  pathname: '/',
  resolvedTheme: 'light' as 'light' | 'dark',
  setTheme: vi.fn<(theme: string) => void>(),
  theme: 'system' as 'system' | 'light' | 'dark',
}))

vi.mock('@/shared/responsive', () => ({
  useBreakpoint: () => topBarMocks.breakpoint,
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const messages: Record<string, string> = {
        'shell.navigation.tasks': 'Tasks',
        'shell.navigation.history': 'History',
        'shell.navigation.models': 'Models',
        'shell.navigation.settings': 'Settings',
        'shell.topBar.actions.activity': 'Activity',
        'shell.topBar.actions.toggleTheme': 'Toggle theme',
        'shell.topBar.actions.help': 'Help',
      }

      if (key === 'shell.topBar.actions.activityWithCount') {
        return `Activity (${String(params?.count)})`
      }

      return messages[key] ?? key
    },
  }),
}))

vi.mock('@tanstack/react-router', () => ({
  useLocation: ({ select }: { select?: (location: { pathname: string }) => string } = {}) =>
    select ? select({ pathname: topBarMocks.pathname }) : { pathname: topBarMocks.pathname },
}))

vi.mock('@/components/use-theme', () => ({
  useTheme: () => ({
    resolvedTheme: topBarMocks.resolvedTheme,
    setTheme: topBarMocks.setTheme,
    theme: topBarMocks.theme,
  }),
}))

describe('AppTopBar', () => {
  beforeEach(() => {
    topBarMocks.breakpoint = 'lg'
    topBarMocks.pathname = '/'
    topBarMocks.resolvedTheme = 'light'
    topBarMocks.theme = 'system'
    topBarMocks.setTheme.mockReset()
  })

  it('renders the planned top bar structure with the route title and action buttons', () => {
    render(<AppTopBar activityCount={2} />)

    const topBar = screen.getByText('Tasks').closest('[data-slot="app-topbar"]')
    const activityButton = screen.getByRole('button', { name: 'Activity (2)' })

    expect(topBar).toHaveAttribute('data-breakpoint', 'lg')
    expect(activityButton).toHaveClass('text-destructive')
    expect(screen.getByRole('button', { name: 'Toggle theme' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Help' })).toBeTruthy()
    expect(screen.getByText('2')).toBeTruthy()
  })

  it('maps the current route to the matching shell title', () => {
    topBarMocks.pathname = '/models/library'

    render(<AppTopBar />)

    expect(screen.getByText('Models')).toBeTruthy()
  })

  it('renders the settings tab slot only on settings routes', () => {
    topBarMocks.pathname = '/settings/general'

    const { rerender } = render(<AppTopBar settingsTabs={<div>Settings tabs</div>} />)

    expect(screen.getByText('Settings')).toBeTruthy()
    expect(screen.getByText('Settings tabs').closest('[data-slot="settings-tabs"]')).toBeTruthy()

    topBarMocks.pathname = '/history'
    rerender(<AppTopBar settingsTabs={<div>Settings tabs</div>} />)

    expect(screen.queryByText('Settings tabs')).toBeNull()
  })

  it('uses the full width layout when the desktop sidebar is not visible', () => {
    topBarMocks.breakpoint = 'md'

    render(<AppTopBar />)

    expect(screen.getByText('Tasks').closest('[data-slot="app-topbar"]')).toHaveAttribute(
      'data-breakpoint',
      'md',
    )
  })

  it('toggles to the opposite explicit theme from the resolved app theme', () => {
    topBarMocks.theme = 'system'
    topBarMocks.resolvedTheme = 'dark'

    render(<AppTopBar />)

    fireEvent.click(screen.getByRole('button', { name: 'Toggle theme' }))

    expect(topBarMocks.setTheme).toHaveBeenCalledTimes(1)
    expect(topBarMocks.setTheme).toHaveBeenCalledWith('light')
  })
})
